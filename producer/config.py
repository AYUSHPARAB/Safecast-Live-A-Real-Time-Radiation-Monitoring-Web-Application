import os

def _bool(name, default):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "radiation-raw")

CSV_PATH = os.getenv("CSV_PATH", "/data/measurements-out.csv")
REVERSE = _bool("REVERSE", True)

SPEED_MULTIPLIER = float(os.getenv("SPEED_MULTIPLIER", "0.001"))

MAX_SLEEP = float(os.getenv("MAX_SLEEP", "15.0"))

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
SPEED_KEY = os.getenv("SPEED_KEY", "producer:speed_multiplier")
SPEED_POLL_SECONDS = float(os.getenv("SPEED_POLL_SECONDS", "1.0"))

PAYLOAD_FORMAT = os.getenv("PAYLOAD_FORMAT", "json")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "50000"))
MAX_ROWS = int(os.getenv("MAX_ROWS", "0"))