import os

KAFKA_BOOTSTRAP    = os.getenv("KAFKA_BOOTSTRAP",    "kafka:29092")

KAFKA_INPUT_TOPIC  = os.getenv("KAFKA_INPUT_TOPIC",  "radiation-raw")
KAFKA_NORMAL_TOPIC = os.getenv("KAFKA_NORMAL_TOPIC", "radiation-clean")
KAFKA_ALERT_TOPIC  = os.getenv("KAFKA_ALERT_TOPIC",  "radiation-alerts")
KAFKA_LATEST_TOPIC = os.getenv("KAFKA_LATEST_TOPIC", "radiation-current")
KAFKA_STATS_TOPIC = os.getenv("KAFKA_STATS_TOPIC", "radiation-stats")
KAFKA_CONFIG_TOPIC = os.getenv("KAFKA_CONFIG_TOPIC", "radiation-config")
KAFKA_SPIKE_TOPIC = os.getenv("KAFKA_SPIKE_TOPIC", "radiation-spikes")
KAFKA_HEATMAP_TOPIC = os.getenv("KAFKA_HEATMAP_TOPIC", "radiation-heatmap")
KAFKA_TOP_TOPIC  = os.getenv("KAFKA_TOP_TOPIC", "radiation-top")

ALERT_THRESHOLD_CPM = float(os.getenv("ALERT_THRESHOLD", "100"))

PARALLELISM = int(os.getenv("FLINK_PARALLELISM", "2"))

KAFKA_CONNECTOR_JAR = "file:///opt/flink/lib/flink-sql-connector-kafka-1.17.1.jar"

SPIKE_JUMP_RATIO = float(os.getenv("SPIKE_JUMP_RATIO", 2.5))
SPIKE_AVG_RATIO  = float(os.getenv("SPIKE_AVG_RATIO", 2.5))
SPIKE_EMA_ALPHA  = float(os.getenv("SPIKE_EMA_ALPHA", 0.2))

GEOHASH_PRECISION   = int(os.getenv("GEOHASH_PRECISION", 5))

TOP_N            = int(os.getenv("TOP_N", 10))

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))