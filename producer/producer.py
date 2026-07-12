import csv
import json
import logging
import time
from datetime import datetime

import redis
from confluent_kafka import Producer

import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("producer")


def parse_time(text):
    text = text.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    return None


def make_key(row):
    device = row.get("Device ID", "").strip()
    if device:
        return ("dev:" + device).encode()

    lat = row.get("Latitude", "").strip()
    lon = row.get("Longitude", "").strip()
    if lat and lon:
        try:
            return "geo:{},{}".format(round(float(lat), 4), round(float(lon), 4)).encode()
        except ValueError:
            pass

    md5 = row.get("MD5Sum", "").strip()
    if md5:
        return md5.encode()

    return None


def read_lines_reverse(path):
    block = 1024 * 1024
    with open(path, "rb") as f:
        f.seek(0, 2)
        position = f.tell()
        leftover = b""
        while position > 0:
            step = min(block, position)
            position -= step
            f.seek(position)
            leftover = f.read(step) + leftover
            lines = leftover.split(b"\n")
            leftover = lines[0]
            for line in reversed(lines[1:]):
                line = line.strip()
                if line:
                    yield line.decode("utf-8", "replace")


def read_lines_forward(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        f.readline()
        for line in f:
            line = line.strip()
            if line:
                yield line


def main():
    logger.info("CSV_PATH=%s", config.CSV_PATH)
    logger.info("TOPIC=%s", config.KAFKA_TOPIC)
    logger.info("BOOTSTRAP=%s", config.KAFKA_BOOTSTRAP_SERVERS)
    logger.info("SPEED_MULTIPLIER (start)=%s  MAX_SLEEP=%s", config.SPEED_MULTIPLIER, config.MAX_SLEEP)

    producer = Producer({
        "bootstrap.servers": config.KAFKA_BOOTSTRAP_SERVERS,
        "linger.ms": 100,
        "compression.type": "lz4",
    })

    with open(config.CSV_PATH, "r", encoding="utf-8", errors="replace") as f:
        header = next(csv.reader([f.readline()]))

    if config.REVERSE:
        lines = read_lines_reverse(config.CSV_PATH)
    else:
        lines = read_lines_forward(config.CSV_PATH)

    logger.info("sending to %s topic %s", config.KAFKA_BOOTSTRAP_SERVERS, config.KAFKA_TOPIC)
    r = redis.from_url(config.REDIS_URL, decode_responses=True)
    speed = config.SPEED_MULTIPLIER
    last_speed_check = 0.0

    count = 0
    last_upload = None
    start = time.time()

    for line in lines:
        values = next(csv.reader([line]))
        row = dict(zip(header, values))

        now = time.time()
        if now - last_speed_check > config.SPEED_POLL_SECONDS:
            last_speed_check = now
            try:
                v = r.get(config.SPEED_KEY)
                if v is not None:
                    new_speed = float(v)
                    if new_speed != speed:
                        logger.info(
                            "SPEED CHANGED: %.6f -> %.6f (via Redis key %r)",
                            speed, new_speed, config.SPEED_KEY,
                        )
                        speed = new_speed
            except Exception as e:
                logger.warning("Could not read speed from Redis: %s", e)

        upload_time = parse_time(row.get("Uploaded Time", ""))
        if speed > 0 and last_upload and upload_time:
            gap = (upload_time - last_upload).total_seconds()
            if gap > 0:
                time.sleep(min(gap * speed, config.MAX_SLEEP))
        if upload_time:
            last_upload = upload_time

  
        if config.PAYLOAD_FORMAT == "json":
            msg = {
                "captured_time": row.get("Captured Time", ""),
                "uploaded_time": row.get("Uploaded Time", ""),
                "latitude":      row.get("Latitude", ""),
                "longitude":     row.get("Longitude", ""),
                "value":         row.get("Value", ""),
                "unit":          row.get("Unit", ""),
                "location_name": row.get("Location Name", ""),
                "device_id":     row.get("Device ID", ""),
                "md5":           row.get("MD5Sum", ""),
                "height":        row.get("Height", ""),
                "surface":       row.get("Surface", ""),
                "radiation":     row.get("Radiation", ""),
                "loader_id":     row.get("Loader ID", ""),
            }
            value = json.dumps(msg, ensure_ascii=False).encode("utf-8")
        else:
            value = line.encode("utf-8")

        try:
            producer.produce(config.KAFKA_TOPIC, key=make_key(row), value=value)
        except BufferError:
            producer.poll(1)
            producer.produce(config.KAFKA_TOPIC, key=make_key(row), value=value)

        count += 1
        if count % config.CHUNK_SIZE == 0:
            producer.poll(0)
            rate = count / (time.time() - start)
            logger.info("%d messages sent (%.0f/s), current speed=%.6f", count, rate, speed)

        if config.MAX_ROWS and count >= config.MAX_ROWS:
            break

    producer.flush()
    logger.info("done, sent %d messages", count)


if __name__ == "__main__":
    main()