import json
import math
from datetime import datetime, timezone
from pyflink.common import Time
from pyflink.datastream.window import TumblingEventTimeWindows
from pyflink.datastream.functions import AggregateFunction
from pyflink.datastream.window import TumblingProcessingTimeWindows
from pyflink.datastream.functions import ProcessWindowFunction
from pyflink.common import WatermarkStrategy, Duration, Types
from pyflink.common.watermark_strategy import TimestampAssigner
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.common import RestartStrategies
from pyflink.datastream.functions import KeyedProcessFunction
from pyflink.datastream.state import ValueStateDescriptor
from pyflink.datastream.connectors.kafka import (
    KafkaSource, KafkaOffsetsInitializer,
    KafkaSink, KafkaRecordSerializationSchema, DeliveryGuarantee
)
# from pyflink.datastream.functions import BroadcastProcessFunction
# from pyflink.datastream.state import MapStateDescriptor
import config

# CONFIG_STATE = MapStateDescriptor(
#     "config_state", Types.STRING(), Types.FLOAT())

LOW_MS  = int(datetime(2011, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
HIGH_MS = int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)

B32 = "0123456789bcdefghjkmnpqrstuvwxyz"
LEVEL_RANK = {"safe": 0, "warning": 1, "elevated": 2, "high": 3}

def _num(x):
    try:
        v = float(x)
        return None if math.isnan(v) else v
    except (TypeError, ValueError):
        return None


def parse_time(s):
    s = str(s).strip()
    if s == "" or s.lower() in ("nat", "nan", "none"):
        return None
    fmt = "%Y-%m-%d %H:%M:%S.%f" if "." in s else "%Y-%m-%d %H:%M:%S"
    dt = datetime.strptime(s, fmt)
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def parse(raw: str):
    try:
        d = json.loads(raw)
        return {
            "captured_at": parse_time(d.get("captured_time")),
            "uploaded_at": d.get("uploaded_time"),
            "latitude":    _num(d.get("latitude")),
            "longitude":   _num(d.get("longitude")),
            "cpm":         _num(d.get("value")),
            "unit":        str(d.get("unit", "")).strip().lower(),
            "device_id":   str(d.get("device_id", "")).strip(),
            "location_name": str(d.get("location_name") or "").strip(), 
            "md5":           str(d.get("md5") or "").strip(),                        
        }
    except (ValueError, TypeError):
        return None


def enrich(e):
    e = dict(e)
    cpm = e["cpm"]
    t   = config.ALERT_THRESHOLD_CPM
    if   cpm >= t * 3: e["level"] = "high"
    elif cpm >= t * 2: e["level"] = "elevated"
    elif cpm >= t:     e["level"] = "warning"
    else:              e["level"] = "safe"
    return e

def sensor_key(e):
    lat = e.get("latitude")
    lon = e.get("longitude")
    if lat is None or lon is None:
        return "unknown"
    return "loc:%.4f_%.4f" % (lat, lon)

def geohash_encode(lat, lon, precision):
    lat_r, lon_r = [-90.0, 90.0], [-180.0, 180.0]
    out, bit, ch, even = [], 0, 0, True
    while len(out) < precision:
        if even:
            mid = (lon_r[0] + lon_r[1]) / 2
            if lon > mid: ch = (ch << 1) | 1; lon_r[0] = mid
            else:         ch = ch << 1;       lon_r[1] = mid
        else:
            mid = (lat_r[0] + lat_r[1]) / 2
            if lat > mid: ch = (ch << 1) | 1; lat_r[0] = mid
            else:         ch = ch << 1;       lat_r[1] = mid
        even = not even
        bit += 1
        if bit == 5:
            out.append(B32[ch]); bit, ch = 0, 0
    return "".join(out), (lat_r[0] + lat_r[1]) / 2, (lon_r[0] + lon_r[1]) / 2

def add_geohash(e):
    e = dict(e)
    gh, clat, clon = geohash_encode(e["latitude"], e["longitude"], config.GEOHASH_PRECISION)
    e["geohash"], e["cell_lat"], e["cell_lon"] = gh, clat, clon
    return e

# def in_bounding_box(e):
#     """
#     Returns True if bounding box is disabled OR
#     the reading falls within the configured lat/lon box.
#     """
#     if not config.BBOX_ENABLED:
#         return True
#     return (
#         config.BBOX_LAT_MIN <= e["latitude"]  <= config.BBOX_LAT_MAX
#         and config.BBOX_LON_MIN <= e["longitude"] <= config.BBOX_LON_MAX
#     )


class CapturedTimestampAssigner(TimestampAssigner):
    def extract_timestamp(self, value, record_timestamp):
        return value["captured_at"]


class LatestPerSensor(KeyedProcessFunction):

    def open(self, runtime_context):
        self.last_ts = runtime_context.get_state(
            ValueStateDescriptor("last_captured", Types.LONG())
        )

    def process_element(self, e, ctx):
        prev = self.last_ts.value()
        if prev is None or e["captured_at"] > prev:
            self.last_ts.update(e["captured_at"])
            yield dict(e, sensor_key=sensor_key(e))

class AlertDedup(KeyedProcessFunction):
    """
    Per sensor: emit alert only if cooldown expired OR severity changed.
    """
    COOLDOWN_MS = 10 * 60 * 1000  #10 minutes cool down period

    def open(self, runtime_context):
        self.last_ts = runtime_context.get_state(
            ValueStateDescriptor("alert_last_ts", Types.LONG()))
        self.last_level = runtime_context.get_state(
            ValueStateDescriptor("alert_last_level", Types.STRING()))

    def process_element(self, e, ctx):
        now      = e["captured_at"]
        prev_ts  = self.last_ts.value()
        prev_lvl = self.last_level.value()
        cur_lvl  = e["level"]

        cooldown_expired = (prev_ts is None or (now - prev_ts) > self.COOLDOWN_MS)
        level_changed    = (prev_lvl != cur_lvl)

        if cooldown_expired or level_changed:
            self.last_ts.update(now)
            self.last_level.update(cur_lvl)
            yield e

        
class GlobalStatsAggregate(AggregateFunction):
    """
    Tumbling 30-second window over all sensors.
    Emits one JSON stats message when each window closes.
    """
    def create_accumulator(self):
        return {
            "count":   0,
            "total":   0.0,
            "max_cpm": 0.0,
            "devices": set(),
            "alerts":  0,
        }

    def add(self, value, acc):
        acc["count"]   += 1
        acc["total"]   += value["cpm"]
        acc["max_cpm"]  = max(acc["max_cpm"], value["cpm"])
        acc["devices"].add(sensor_key(value))
        if value["level"] != "safe":
            acc["alerts"] += 1
        return acc

    def get_result(self, acc):
        avg = round(acc["total"] / acc["count"], 2) if acc["count"] else 0.0
        return json.dumps({
            "type":           "global_stats",
            "avg_cpm":        avg,
            "max_cpm":        round(acc["max_cpm"], 2),
            "active_sensors": len(acc["devices"]),
            "alert_count":    acc["alerts"],
        
        })

    def merge(self, a, b):
        a["count"]   += b["count"]
        a["total"]   += b["total"]
        a["max_cpm"]  = max(a["max_cpm"], b["max_cpm"])
        a["devices"].update(b["devices"])
        a["alerts"]  += b["alerts"]
        return a
    

class SpikeDetector(KeyedProcessFunction):
    """
    Per sensor: detects sudden CPM increases using two signals:
      1. Point-to-point: current reading vs immediately previous reading
      2. Rolling average: current reading vs sensor's exponential moving average
    Emits a spike event when EITHER ratio is exceeded.
    """
    def open(self, runtime_context):
        self.prev_cpm = runtime_context.get_state(
            ValueStateDescriptor("spike_prev_cpm", Types.FLOAT()))
        self.rolling_avg = runtime_context.get_state(
            ValueStateDescriptor("spike_rolling_avg", Types.FLOAT()))

    def process_element(self, e, ctx):
        cpm  = e["cpm"]
        prev = self.prev_cpm.value()
        avg  = self.rolling_avg.value()

        point_jump = False
        avg_jump   = False

        if prev is not None and prev > 0:
            point_jump = (cpm / prev) >= config.SPIKE_JUMP_RATIO

        if avg is not None and avg > 0:
            avg_jump = (cpm / avg) >= config.SPIKE_AVG_RATIO

        if point_jump or avg_jump:
            spike = dict(e)
            spike["spike_type"]      = "point_and_average" if (point_jump and avg_jump) else (
                                        "point_to_point" if point_jump else "rolling_average")
            spike["previous_cpm"]    = prev
            spike["rolling_avg_cpm"] = round(avg, 2) if avg is not None else None
            spike["jump_ratio"]      = round(cpm / prev, 2) if prev else None
            yield spike

        self.prev_cpm.update(cpm)
        new_avg = cpm if avg is None else (
            config.SPIKE_EMA_ALPHA * cpm + (1 - config.SPIKE_EMA_ALPHA) * avg)
        self.rolling_avg.update(new_avg)


class HeatmapAggregate(AggregateFunction):
    def create_accumulator(self):
        return {"count": 0, "total": 0.0, "max_cpm": 0.0,
                "worst": "safe", "clat": 0.0, "clon": 0.0}
    def add(self, e, acc):
        acc["count"]  += 1
        acc["total"]  += e["cpm"]
        acc["max_cpm"] = max(acc["max_cpm"], e["cpm"])
        if LEVEL_RANK[e["level"]] > LEVEL_RANK[acc["worst"]]:
            acc["worst"] = e["level"]
        acc["clat"], acc["clon"] = e["cell_lat"], e["cell_lon"]
        return acc
    def get_result(self, acc):
        return acc
    def merge(self, a, b):
        a["count"]  += b["count"]
        a["total"]  += b["total"]
        a["max_cpm"] = max(a["max_cpm"], b["max_cpm"])
        if LEVEL_RANK[b["worst"]] > LEVEL_RANK[a["worst"]]:
            a["worst"] = b["worst"]
        return a

class AttachCellMeta(ProcessWindowFunction):
    def process(self, key, ctx, aggregations):
        acc = next(iter(aggregations))
        avg = round(acc["total"] / acc["count"], 2) if acc["count"] else 0.0
        yield json.dumps({
            "type": "heatmap_cell",
            "geohash": key,
            "cell_lat": round(acc["clat"], 5),
            "cell_lon": round(acc["clon"], 5),
            "avg_cpm": avg,
            "max_cpm": round(acc["max_cpm"], 2),
            "count": acc["count"],
            "level": acc["worst"]
        })
        
# class DynamicConfig(BroadcastProcessFunction):
#     """
#     Listens to radiation-config topic for runtime config changes.
#     Applies updated threshold and bounding box to the enriched stream.
    
#     Config message format (from P4 settings panel):
#         {"threshold": 50.0}
#         {"bbox_enabled": 1.0, "bbox_lat_min": 30.0, "bbox_lat_max": 46.0,
#          "bbox_lon_min": 129.0, "bbox_lon_max": 146.0}
#     """

#     def process_element(self, e, ctx, out):
#         # Called for every radiation reading
#         state = ctx.get_broadcast_state(CONFIG_STATE)

#         # Read threshold — fall back to config.py value if not set yet
#         threshold = state.get("threshold")
#         if threshold is None:
#             threshold = config.ALERT_THRESHOLD_CPM

#         # Read bbox settings
#         bbox_enabled = state.get("bbox_enabled")

#         # Apply bounding box if enabled via broadcast
#         if bbox_enabled:
#             lat_min = state.get("bbox_lat_min") or config.BBOX_LAT_MIN
#             lat_max = state.get("bbox_lat_max") or config.BBOX_LAT_MAX
#             lon_min = state.get("bbox_lon_min") or config.BBOX_LON_MIN
#             lon_max = state.get("bbox_lon_max") or config.BBOX_LON_MAX
#             if not (lat_min <= e["latitude"]  <= lat_max
#                     and lon_min <= e["longitude"] <= lon_max):
#                 return   # outside box — drop silently

#         # Re-apply threshold with current dynamic value
#         cpm = e["cpm"]
#         if   cpm >= threshold * 3: e["level"] = "high"
#         elif cpm >= threshold * 2: e["level"] = "elevated"
#         elif cpm >= threshold:     e["level"] = "warning"
#         else:                      e["level"] = "safe"

#         out.collect(e)

    # def process_broadcast_element(self, config_msg, ctx, out):
    #     # Called when a new config message arrives from radiation-config topic
    #     try:
    #         msg = json.loads(config_msg)
    #         state = ctx.get_broadcast_state(CONFIG_STATE)

    #         if "threshold" in msg:
    #             new_t = float(msg["threshold"])
    #             state.put("threshold", new_t)
    #             print(f"[CONFIG] Threshold updated to {new_t} CPM")

    #         if "bbox_enabled" in msg:
    #             state.put("bbox_enabled", float(msg["bbox_enabled"]))
    #             print(f"[CONFIG] BBox enabled: {msg['bbox_enabled']}")

    #         if "bbox_lat_min" in msg:
    #             state.put("bbox_lat_min", float(msg["bbox_lat_min"]))
    #             state.put("bbox_lat_max", float(msg["bbox_lat_max"]))
    #             state.put("bbox_lon_min", float(msg["bbox_lon_min"]))
    #             state.put("bbox_lon_max", float(msg["bbox_lon_max"]))
    #             print(f"[CONFIG] BBox updated: {msg}")

    #     except (ValueError, KeyError) as ex:
    #         print(f"[CONFIG] Bad config message: {ex}")


def make_sink(topic):
    return (
        KafkaSink.builder()
        .set_bootstrap_servers(config.KAFKA_BOOTSTRAP)
        .set_record_serializer(
            KafkaRecordSerializationSchema.builder()
            .set_topic(topic)
            .set_value_serialization_schema(SimpleStringSchema())
            .build()
        )
        .set_delivery_guarantee(DeliveryGuarantee.AT_LEAST_ONCE)
        .build()
    )


def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_restart_strategy(RestartStrategies.fixed_delay_restart(5, 10000)) 
    env.set_parallelism(config.PARALLELISM)
    env.add_jars(config.KAFKA_CONNECTOR_JAR)


    source = (
        KafkaSource.builder()
        .set_bootstrap_servers(config.KAFKA_BOOTSTRAP)
        .set_topics(config.KAFKA_INPUT_TOPIC)
        .set_group_id("flink-radiation")
        .set_starting_offsets(KafkaOffsetsInitializer.earliest())
        .set_property("default.api.timeout.ms", "120000")     
        .set_property("request.timeout.ms", "120000")     
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )
    raw_stream = env.from_source(
        source, WatermarkStrategy.no_watermarks(), "kafka-raw-radiation"
    )

    # # Config source — reads runtime config changes from radiation-config topic
    # config_source = env.from_source(
    #     KafkaSource.builder()
    #     .set_bootstrap_servers(config.KAFKA_BOOTSTRAP)
    #     .set_topics(config.KAFKA_CONFIG_TOPIC)
    #     .set_group_id("flink-config-consumer")
    #     .set_starting_offsets(KafkaOffsetsInitializer.latest())
    #     .set_value_only_deserializer(SimpleStringSchema())
    #     .build(),
    #     WatermarkStrategy.no_watermarks(),
    #     "config-source"
    # )

    # Operator: parse, drop missing & junk data, attach event times
    parsed = (
        raw_stream
        .map(parse, output_type=Types.PICKLED_BYTE_ARRAY())
        .filter(lambda e: e is not None and e["captured_at"] is not None)
        .filter(lambda e: LOW_MS <= e["captured_at"] <= HIGH_MS)
    )
    watermark = (
        WatermarkStrategy
        .for_bounded_out_of_orderness(Duration.of_seconds(120))
        .with_timestamp_assigner(CapturedTimestampAssigner())
        .with_idleness(Duration.of_seconds(10))
    )
    timed = parsed.assign_timestamps_and_watermarks(watermark)

    # Operator: discard empty & invalid readings
    clean = timed.filter(
    lambda e: (
        e["unit"] == "cpm"
        and e["cpm"] is not None
        and e["cpm"] > 0
        and e["cpm"] < 10_000
        and e["latitude"]  is not None
        and e["longitude"] is not None
        and -90  <= e["latitude"]  <= 90
        and -180 <= e["longitude"] <= 180
        and not (e["latitude"] == 0.0
                 and e["longitude"] == 0.0)
    )
)

    # Operator: geospatial bounding-box filter
    # bounded = clean.filter(in_bounding_box)

    enriched = clean.map(enrich, output_type=Types.PICKLED_BYTE_ARRAY())

    # Broadcast config stream to all parallel instances
    # config_broadcast = config_source.broadcast(CONFIG_STATE)

    # Apply dynamic config operator
    # dynamic = (
    #     enriched
    #     .connect(config_broadcast)
    #     .process(DynamicConfig(), output_type=Types.PICKLED_BYTE_ARRAY())
    # )

    # Operator: latest radiation per location 
    latest = (
        enriched
        .key_by(sensor_key, key_type=Types.STRING())
        .process(LatestPerSensor(), output_type=Types.PICKLED_BYTE_ARRAY())
    )

    # Sink A: all clean readings -> radiation-clean topic
    (enriched
        .map(lambda e: json.dumps(e), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_NORMAL_TOPIC)))

    # Sink B: readings above threshold -> radiation-alerts topic

    (enriched
    .filter(lambda e: e["level"] != "safe")
    .key_by(sensor_key, key_type=Types.STRING())
    .process(AlertDedup(), output_type=Types.PICKLED_BYTE_ARRAY())
    .map(lambda e: json.dumps(e), output_type=Types.STRING())
    .sink_to(make_sink(config.KAFKA_ALERT_TOPIC))
)

    # Sink C: latest reading per sensor from each location-> radiation-current topic
    (latest
        .map(lambda e: json.dumps(e), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_LATEST_TOPIC)))
    
    # Sink D: global stats every 30 seconds
    (
    enriched
    .window_all(TumblingEventTimeWindows.of(Time.seconds(30)))
    .aggregate(GlobalStatsAggregate(),
               accumulator_type=Types.PICKLED_BYTE_ARRAY(), 
               output_type=Types.STRING())
    .sink_to(make_sink(config.KAFKA_STATS_TOPIC))
    )

    # Sink E: spike detection — sudden CPM increases per sensor
    (
    enriched
    .key_by(sensor_key, key_type=Types.STRING())
    .process(SpikeDetector(), output_type=Types.PICKLED_BYTE_ARRAY())
    .map(lambda e: json.dumps(e), output_type=Types.STRING())
    .sink_to(make_sink(config.KAFKA_SPIKE_TOPIC))
    )

    # Sink F: geohash heatmap — per-cell blobs
    (
    enriched
    .map(add_geohash, output_type=Types.PICKLED_BYTE_ARRAY())
    .key_by(lambda e: e["geohash"], key_type=Types.STRING())
    .window(TumblingProcessingTimeWindows.of(Time.seconds(30)))
    .aggregate(HeatmapAggregate(),
               window_function=AttachCellMeta(),
               accumulator_type=Types.PICKLED_BYTE_ARRAY(),
               output_type=Types.STRING())
    .sink_to(make_sink(config.KAFKA_HEATMAP_TOPIC))
    )


    env.execute("safecast-processing-pipeline")


if __name__ == "__main__":
    main()