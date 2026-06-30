import os

KAFKA_BOOTSTRAP    = os.getenv("KAFKA_BOOTSTRAP",    "kafka:29092")

KAFKA_INPUT_TOPIC  = os.getenv("KAFKA_INPUT_TOPIC",  "radiation-raw")
KAFKA_NORMAL_TOPIC = os.getenv("KAFKA_NORMAL_TOPIC", "radiation-clean")
KAFKA_ALERT_TOPIC  = os.getenv("KAFKA_ALERT_TOPIC",  "radiation-alerts")
KAFKA_LATEST_TOPIC = os.getenv("KAFKA_LATEST_TOPIC", "radiation-current")

ALERT_THRESHOLD_CPM = float(os.getenv("ALERT_THRESHOLD", "100"))

PARALLELISM = int(os.getenv("FLINK_PARALLELISM", "4"))

KAFKA_CONNECTOR_JAR = "file:///opt/flink/lib/flink-sql-connector-kafka-1.17.1.jar"

KAFKA_STATS_TOPIC = os.getenv("KAFKA_STATS_TOPIC", "radiation-stats")

# Bounding box filter (set to None to disable and process whole world)
BBOX_LAT_MIN = float(os.getenv("BBOX_LAT_MIN", -90))
BBOX_LAT_MAX = float(os.getenv("BBOX_LAT_MAX",  90))
BBOX_LON_MIN = float(os.getenv("BBOX_LON_MIN", -180))
BBOX_LON_MAX = float(os.getenv("BBOX_LON_MAX",  180))
BBOX_ENABLED = os.getenv("BBOX_ENABLED", "false").lower() == "true"

KAFKA_CONFIG_TOPIC = os.getenv("KAFKA_CONFIG_TOPIC", "radiation-config")

SPIKE_JUMP_RATIO = float(os.getenv("SPIKE_JUMP_RATIO", 2.5))
SPIKE_AVG_RATIO  = float(os.getenv("SPIKE_AVG_RATIO", 2.5))
SPIKE_EMA_ALPHA  = float(os.getenv("SPIKE_EMA_ALPHA", 0.2))
KAFKA_SPIKE_TOPIC = os.getenv("KAFKA_SPIKE_TOPIC", "radiation-spikes")