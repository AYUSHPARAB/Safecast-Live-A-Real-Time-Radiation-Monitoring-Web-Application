import csv
import json
import time
from datetime import datetime

from confluent_kafka import Producer

import config


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
    print(f"CSV_PATH={config.CSV_PATH}")
    print(f"REVERSE={config.REVERSE}")
    print(f"TOPIC={config.KAFKA_TOPIC}")
    print(f"BOOTSTRAP={config.KAFKA_BOOTSTRAP_SERVERS}")

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

    print("sending to", config.KAFKA_BOOTSTRAP_SERVERS, "topic", config.KAFKA_TOPIC)

    count = 0
    last_upload = None
    start = time.time()

    for line in lines:
        values = next(csv.reader([line]))
        row = dict(zip(header, values))


        upload_time = parse_time(row.get("Uploaded Time", ""))
        if config.SPEED_MULTIPLIER > 0 and last_upload and upload_time:
            gap = (upload_time - last_upload).total_seconds()
            if gap > 0:
                time.sleep(min(gap * config.SPEED_MULTIPLIER, config.MAX_SLEEP))
        if upload_time:
            last_upload = upload_time

  
        if config.PAYLOAD_FORMAT == "json":
            value = json.dumps(row, ensure_ascii=False).encode("utf-8")
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
            print(count, "messages sent ({:.0f}/s)".format(rate))

        if config.MAX_ROWS and count >= config.MAX_ROWS:
            break

    producer.flush()
    print("done, sent", count, "messages")


if __name__ == "__main__":
    main()