import json
import math
from datetime import datetime, timezone

from pyflink.common import WatermarkStrategy, Duration, Types
from pyflink.common.watermark_strategy import TimestampAssigner
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.functions import KeyedProcessFunction
from pyflink.datastream.state import ValueStateDescriptor
from pyflink.datastream.connectors.kafka import (
    KafkaSource, KafkaOffsetsInitializer,
    KafkaSink, KafkaRecordSerializationSchema, DeliveryGuarantee
)

import config

LOW_MS  = int(datetime(2011, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
HIGH_MS = int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)


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
    dev = e.get("device_id", "").strip()
    if dev:
        return "dev:" + dev
    lat = e.get("latitude")
    lon = e.get("longitude")
    if lat is not None and lon is not None:
        return "geo:%.4f,%.4f" % (lat, lon)
    return e.get("md5", "unknown")


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
    env.set_parallelism(config.PARALLELISM)
    env.add_jars(config.KAFKA_CONNECTOR_JAR)

    source = (
        KafkaSource.builder()
        .set_bootstrap_servers(config.KAFKA_BOOTSTRAP)
        .set_topics(config.KAFKA_INPUT_TOPIC)
        .set_group_id("flink-radiation")
        .set_starting_offsets(KafkaOffsetsInitializer.earliest())
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

    enriched = clean.map(enrich, output_type=Types.PICKLED_BYTE_ARRAY())

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
    alerts = enriched.filter(lambda e: e["level"] == "danger")
    (alerts
        .map(lambda e: json.dumps(e), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_ALERT_TOPIC)))

    # Sink C: latest reading per sensor from each location-> radiation-current topic
    (latest
        .map(lambda e: json.dumps(e), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_LATEST_TOPIC)))

    env.execute("safecast-processing-pipeline")


if __name__ == "__main__":
    main()