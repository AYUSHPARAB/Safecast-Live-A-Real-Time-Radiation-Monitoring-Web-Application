import json
import math
from datetime import datetime, timezone

from pyflink.common import WatermarkStrategy, Duration, Types
from pyflink.common.watermark_strategy import TimestampAssigner
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import StreamExecutionEnvironment
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
            "lat":         _num(d.get("latitude")),
            "lon":         _num(d.get("longitude")),
            "cpm":         _num(d.get("value")),
            "unit":        str(d.get("unit", "")).strip().lower(),
            "device_id":   str(d.get("device_id", "")).strip(),
        }
    except (ValueError, TypeError):
        return None


def enrich(e):
    e = dict(e)
    e["level"] = "danger" if e["cpm"] >= config.ALERT_THRESHOLD_CPM else "safe"
    return e


class CapturedTimestampAssigner(TimestampAssigner):
    def extract_timestamp(self, value, record_timestamp):
        return value["captured_at"]


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

    # Operator: parse, drop missing & junk data , attach event times
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

    # Operator: Discard empty & invalid readings
    clean = timed.filter(
        lambda e: (
            e["unit"] == "cpm"
            and e["cpm"] is not None
            and e["cpm"] > 0
            and e["lat"] is not None and e["lon"] is not None
            and -90 <= e["lat"] <= 90
            and -180 <= e["lon"] <= 180
        )
    )

    enriched = clean.map(enrich, output_type=Types.PICKLED_BYTE_ARRAY())

    # Sink A: all -> processed-radiation topic
    (enriched
        .map(lambda e: json.dumps(e), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_NORMAL_TOPIC)))

    # Sink B: threshold-alert -> radiation-alerts topic
    alerts = enriched.filter(lambda e: e["level"] == "danger")
    (alerts
        .map(lambda e: json.dumps(e), output_type=Types.STRING())
        .sink_to(make_sink(config.KAFKA_ALERT_TOPIC)))
    alerts.print()

    env.execute("safecast-processing-pipeline")


if __name__ == "__main__":
    main()