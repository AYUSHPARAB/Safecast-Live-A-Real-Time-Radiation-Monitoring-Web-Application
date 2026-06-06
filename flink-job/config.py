import os

KAFKA_BOOTSTRAP    = os.getenv("KAFKA_BOOTSTRAP",    "kafka:29092")

KAFKA_INPUT_TOPIC  = os.getenv("KAFKA_INPUT_TOPIC",  "raw-radiation")
KAFKA_NORMAL_TOPIC = os.getenv("KAFKA_NORMAL_TOPIC", "processed-radiation")
KAFKA_ALERT_TOPIC  = os.getenv("KAFKA_ALERT_TOPIC",  "radiation-alerts")

ALERT_THRESHOLD_CPM = float(os.getenv("ALERT_THRESHOLD", "100"))

PARALLELISM = int(os.getenv("FLINK_PARALLELISM", "4"))

KAFKA_CONNECTOR_JAR = "file:///opt/flink/lib/flink-sql-connector-kafka-1.17.1.jar"