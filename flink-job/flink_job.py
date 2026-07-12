import json
import os
import math
from datetime import datetime, timezone
import threading
import config
import redis as redis_lib
import hashlib
from confluent_kafka import Consumer as KafkaConsumer
from pyflink.common import Time
from pyflink.datastream.window import TumblingEventTimeWindows, TumblingProcessingTimeWindows
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
from pyflink.datastream.functions import ProcessAllWindowFunction
import pycountry, reverse_geocoder as rg

# ── Geocoder (loads dataset once at startup) 
_GEO = rg.RGeocoder(mode=1, verbose=False)
_location_cache = {}

LOW_MS  = int(datetime(2011, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
HIGH_MS = int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)

B32 = "0123456789bcdefghjkmnpqrstuvwxyz"
LEVEL_RANK = {"safe": 0, "warning": 1, "elevated": 2, "high": 3}


# Redis client — shared across all Flink processes
_redis = None

def get_redis():
    global _redis
    if _redis is None:
        try:
            _redis = redis_lib.Redis(
                host=config.REDIS_HOST,
                port=config.REDIS_PORT,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=1
            )
            # Set default threshold if not already set
            if not _redis.exists("threshold"):
                _redis.set("threshold", config.ALERT_THRESHOLD_CPM)
            print(f"[REDIS] Connected. Threshold = {_redis.get('threshold')}")
        except Exception as ex:
            print(f"[REDIS] Connection failed: {ex}")
    return _redis


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
    """Convert raw Kafka JSON string -> Python dict with typed fields."""
    try:
        d = json.loads(raw)
        return {
            "captured_at": parse_time(d.get("captured_time")),
            "uploaded_at": d.get("uploaded_time"),
            "latitude":    _num(d.get("latitude")),
            "longitude":   _num(d.get("longitude")),
            "cpm":         _num(d.get("value")), 
            "unit":        str(d.get("unit", "")).strip().lower(),                       
        }
    except (ValueError, TypeError):
        return None

def _country_name(cc):
    try:
        return pycountry.countries.get(alpha_2=cc).name   
    except Exception:
        return cc  
    

# ── Helper: lat/lon → city + country 
def _geocode(lat, lon):
    """Returns (city, country) strings. Cached by sensor_key."""
    try:
        r       = _GEO.query([(lat, lon)])[0]
        city    = (r.get("name") or "").strip()
        cc      = (r.get("cc")   or "").strip()
        country = _country_name(cc) if cc else ""
        return city, country
    except Exception:
        return "", "%.6f,%.6f" % (lat, lon)

def sensor_key(e):
    lat = e.get("latitude")
    lon = e.get("longitude")
    if lat is None or lon is None:
        return "00000000"
    ck = "%.6f_%.6f" % (lat, lon)                       
    return hashlib.md5(ck.encode()).hexdigest()[:8].upper()


def enrich(e):
    e   = dict(e)
    e.pop("unit", None) 
    cpm = e["cpm"]

    # Read threshold from Redis — falls back to default if unavailable
    try:
        t = float(get_redis().get("threshold") or config.ALERT_THRESHOLD_CPM)
    except Exception:
        t = config.ALERT_THRESHOLD_CPM

    if   cpm >= t * 3: e["level"] = "high"
    elif cpm >= t * 2: e["level"] = "elevated"
    elif cpm >= t:     e["level"] = "warning"
    else:              e["level"] = "safe"

    sk = sensor_key(e)
    e["sensor_key"] = sk

    # City + country from geocoder (cached per sensor_key)
    if sk not in _location_cache:
        city, country = _geocode(e["latitude"], e["longitude"])
        _location_cache[sk] = (city, country)
    e["city"], e["country"] = _location_cache[sk]

    return e

                             

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

class CapturedTimestampAssigner(TimestampAssigner):
    def extract_timestamp(self, value, record_timestamp):
        return value["captured_at"]

class LatestPerSensor(KeyedProcessFunction):
    """Emit only the most recent reading per sensor  -> radiation-current."""
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
        # Get city/country for cell center
        sk = hashlib.md5(("%.3f_%.3f" % (acc["clat"], acc["clon"])).encode()).hexdigest()[:8].upper()
        if sk not in _location_cache:
            city, country = _geocode(acc["clat"], acc["clon"])
            _location_cache[sk] = (city, country)
        city, country = _location_cache[sk]
        yield {
            "geohash":  key,
            "city":     city,
            "country":  country,
            "city": city,
            "cell_lat": round(acc["clat"], 5),
            "cell_lon": round(acc["clon"], 5),
            "avg_cpm":  avg,
            "max_cpm":  round(acc["max_cpm"], 2),
            "count":    acc["count"],
            "level":    acc["worst"],
        }

        
class TopNHotspots(ProcessAllWindowFunction):
    """Rank all cells in the window by danger, keep worst N (non-safe only)."""
    def process(self, ctx, cells):
        dangerous = [c for c in cells if c["level"] != "safe"]
        ranked = sorted(dangerous, key=lambda c: c["max_cpm"], reverse=True)[:config.TOP_N]
        out = [{
            "rank": i + 1,
            "geohash": c["geohash"],
            "city":    c["city"],
            "country": c["country"],
            "lat": c["cell_lat"],
            "lon": c["cell_lon"],
            "max_cpm": c["max_cpm"],
            "avg_cpm": c["avg_cpm"],
            "level": c["level"],
            "count": c["count"],
        } for i, c in enumerate(ranked)]
        yield json.dumps({
            "count": len(out),
            "hotspots": out,
        })

# ── Kafka sink factory 

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
        .set_property("default.api.timeout.ms", "300000")     
        .set_property("request.timeout.ms", "300000")     
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )
    raw_stream = env.from_source(
        source, WatermarkStrategy.no_watermarks(), "kafka-raw-radiation"
    )

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


    # Enrich: add level, sensor_key, city, country
    enriched = clean.map(enrich, output_type=Types.PICKLED_BYTE_ARRAY())

    # Operator: latest radiation per location 
    latest = (
        enriched
        .key_by(sensor_key, key_type=Types.STRING())
        .process(LatestPerSensor(), output_type=Types.PICKLED_BYTE_ARRAY())
    )

    # Heatmap cells (shared source for heatmap + top-N) ----
    heatmap_cells = (
        enriched
        .map(add_geohash, output_type=Types.PICKLED_BYTE_ARRAY())
        .key_by(lambda e: e["geohash"], key_type=Types.STRING())
        .window(TumblingProcessingTimeWindows.of(Time.seconds(30)))
        .aggregate(HeatmapAggregate(),
                   window_function=AttachCellMeta(),
                   accumulator_type=Types.PICKLED_BYTE_ARRAY(),
                   output_type=Types.PICKLED_BYTE_ARRAY())   
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
    .window_all(TumblingProcessingTimeWindows.of(Time.seconds(30)))
    .aggregate(GlobalStatsAggregate(), output_type=Types.STRING())
    .sink_to(make_sink(config.KAFKA_STATS_TOPIC))
    ).set_parallelism(1)

    # Sink E: spike detection — sudden CPM increases per sensor
    (
    enriched
    .key_by(sensor_key, key_type=Types.STRING())
    .process(SpikeDetector(), output_type=Types.PICKLED_BYTE_ARRAY())
    .map(lambda e: json.dumps(e), output_type=Types.STRING())
    .sink_to(make_sink(config.KAFKA_SPIKE_TOPIC))
    )

    # Sink F: heatmap blobs -> radiation-heatmap
    (heatmap_cells
        .map(lambda e: json.dumps(e), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_HEATMAP_TOPIC)))
    
    # Sink G: top-N dangerous hotspots -> radiation-top
    (heatmap_cells
        .window_all(TumblingProcessingTimeWindows.of(Time.seconds(30)))
        .process(TopNHotspots(), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_TOP_TOPIC)))


    env.execute("safecast-processing-pipeline")


if __name__ == "__main__":
    main()