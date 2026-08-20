# Real-Time Radiation Tracking

**BD26 · Team T5 · Topic C** — Institute for Data Engineering, TUHH

A stream-processing pipeline that replays the [Safecast](https://safecast.org/data/download/) radiation data through **Apache Kafka**, analyses it with **Apache Flink**, and displays it live on a world map.

<img width="1600" height="951" alt="image" src="https://github.com/user-attachments/assets/115a446a-b577-4efb-95cf-47a7bb1daa17" />

*The live console zoomed to Japan: green tracks are mobile sensors driving south from Tokyo, the red cluster in the north is the Fukushima exclusion zone. No location is hardcoded — the system surfaces it from raw coordinates and readings.*

---

## Features

- **Live world map** — one marker per sensor location; fixed sensors are replaced, not appended, so the map never grows unbounded.
- **Colour-coded levels** — `safe` / `warning` / `elevated` / `high`.
- **User-configurable threshold** — change the critical CPM value from the UI; implemented inside Flink at runtime.
- **Configurable ingestion speed** — speed up or slow down the data ingestion from kafka.
- **Alerts** — Any reading above the threshold produces an alert.
- **Heatmap** — readings aggregated into geohash cells (data blobs).
- **Top-N hotspots** — the most dangerous cells worldwide are ranked every 30 seconds.
- **Spike detection** — A sudden jump relative to a sensor's own moving average is flagged as a spike.
- **Global statistics** — rolling 30-second window produce global count, average and maximum cpm.
- **Area filter** — The map can be restricted to a region (World, Fukushima, Europe, Japan....) so fewer data items are displayed.
- **Time-window replay** — A separate replay page fetches a historical time window and animates it with play/pause, speed and a timeline scrubber.

All data processing happens in Flink. The backend only caches, persists and forwards; the frontend only renders.

---

## Architecture

```
Safecast CSV → Producer → Kafka → Flink → Backend (FastAPI) → Frontend (React + Leaflet)
                                            ├── Redis        (live state, config)
                                            └── TimescaleDB  (history)
```

| Service          | Port     | Purpose          |
| ---------------- | -------- | ---------------- |
| frontend         | **5173** | Dashboard        |
| backend          | **8000** | REST + WebSocket |
| flink-jobmanager | **8081** | Flink dashboard  |
| kafka-ui         | **8080** | Browse topics    |
| kafka            | **9092** | Broker           |
| redis            | **6379** | Live Cache       |
| timescaledb      | **5432** | History          |

**Kafka topics:** radiation data -> `radiation-raw` (producer) → Flink → `radiation-clean`, `radiation-current`, `radiation-alerts`, `radiation-stats`, `radiation-spikes`, `radiation-heatmap`, `radiation-top`;

**Flink operators** (`flink-job/flink_job.py`): parse → filter invalid/empty readings → event-time watermarks → enrich (level, sensor key, city/country), then:

| Operator                                        | Output topic        |
| ----------------------------------------------- | ------------------- |
| `LatestPerSensor` — newest reading per location | `radiation-current` |
| `AlertDedup` — threshold breach, de-duplicated  | `radiation-alerts`  |
| `GlobalStatsAggregate` — 30 s tumbling window   | `radiation-stats`   |
| `SpikeDetector` — sudden jumps                  | `radiation-spikes`  |
| `HeatmapAggregate` — geohash cells, 30 s window | `radiation-heatmap` |
| `TopNHotspots` — worst N cells, 30 s window     | `radiation-top`     |

---

## Screenshots

### Live monitoring console — world view

<img width="1600" height="889" alt="image" src="https://github.com/user-attachments/assets/0a935069-4e56-45af-b1d1-b918ca0edb92" />


Global view with 284 active sensors, a 35.2 CPM rolling average and a live alert feed. The trend chart (bottom-left) shows a max-CPM spike while the global average stays flat — a single sensor going hot without dragging down the mean. The configuration panel on the left drives the alert threshold, display region and ingestion speed at runtime.

### Live monitoring console — Fukushima region

<img width="1600" height="951" alt="image" src="https://github.com/user-attachments/assets/5a2b2c21-981c-48af-9757-1e8dfb1eeab7" />


Zoomed into Japan: green tracks trace mobile sensors along roads out of Tokyo, while the elevated/high cluster in the north maps the Fukushima area. The live alert feed is all Fukushima-shi readings in the 190–250 CPM range.

### Historical replay

<img width="1600" height="887" alt="image" src="https://github.com/user-attachments/assets/fff17b04-3ebd-4f88-bf9d-d9d590ba8252" />


The separate replay page loads a historical time window from TimescaleDB (here 5,000 readings across a 15-minute window) and animates it with play/pause, a speed control up to 300× and a timeline scrubber — 686 sensors on the map at this frame.

### Kafka UI — topics

<img width="1600" height="898" alt="image" src="https://github.com/user-attachments/assets/7e79f6ae-b392-4c3f-a20e-26b80b8f3e5f" />


Topic view: `radiation-raw` (producer input) and `radiation-clean` (after validation) climb together, with the difference showing how many malformed readings the Flink filters dropped. High-volume topics use 12 partitions; the low-volume 30-second aggregate topics (`radiation-stats`, `radiation-top`) use 1.

### Flink dashboard — running job

<img width="1600" height="883" alt="image" src="https://github.com/user-attachments/assets/d7ec6dec-7ccb-45cc-9266-0a5028767519" />


The `safecast-processing-pipeline` job running with all tasks healthy (15/15) and zero failures. Restart strategy is fixed-delay (5 attempts, 10 s apart).

---

## Quick Start

**Requirements:** Docker ≥ 24, Docker Compose v2, ~8 GB free RAM.

**1. Get the dataset.** Download the measurements archive from <https://safecast.org/data/download/> and place the CSV (original header intact) at:

```
data/measurements-out.csv
```

**2. Run:**

```bash
git clone https://collaborating.tuhh.de/e-19/teaching/bd26_project_t5_c.git
cd bd26_project_t5_c
docker compose up --build
```

**3. Open <http://localhost:5173>.**

Stop with `docker compose down` (add `-v` to wipe the database).

---

## Testing

```bash
docker compose ps                       # all services up
curl http://localhost:8000/api/health   # {"status":"ok","redis":true}
```

1. **Kafka** — <http://localhost:8080>: `radiation-raw` and `radiation-clean` message counts are climbing.
2. **Flink** — <http://localhost:8081>: the job is `RUNNING` with non-zero records sent.
3. **Map** — <http://localhost:5173>: markers, alerts and hotspots appear; stats refresh every 30 s.
4. **Threshold** — lower it in the config panel; markers change colour and new alerts appear within seconds.
5. **Speed** — raise it in the config panel; `docker compose logs -f producer` shows `SPEED CHANGED` and a higher message rate.
6. **Replay** — open the replay page, pick a time window, press play.

---

## Configuration

Set from the UI at runtime, no restart:

| Control                  | Effect                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| Critical threshold (CPM) | Redefines the severity levels and alerts — applied in Flink         |
| Ingestion speed          | `1.0` = real time, `0.001` = medium, `0.0001` = fast, `0` = fastest |

Key environment variables (`docker-compose.yml`):

| Variable                       | Default                     | Purpose                              |
| ------------------------------ | --------------------------- | ------------------------------------ |
| `SPEED_MULTIPLIER`             | `0.001`                     | Producer starting speed              |
| `MAX_ROWS`                     | `0`                         | Stop the producer after N rows       |
| `ALERT_THRESHOLD`              | `100`                       | Flink fallback threshold             |
| `TOP_N` / `GEOHASH_PRECISION`  | `10` / `5`                  | Hotspot count, heatmap cell size     |
| `BACKEND_CORS_ORIGINS`         | `["http://localhost:5173"]` | Must include the frontend origin     |
| `VITE_API_URL` / `VITE_WS_URL` | `localhost:8000`            | Backend URLs baked into the frontend |

---

## API

Swagger(Documentation): <http://localhost:8000/docs>

| Endpoint                                                           | Description                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `GET /api/points`                                                  | Current sensors                                                               |
| `GET /api/stats/current`, `/api/alerts`, `/api/spikes`, `/api/top` | Live state                                                                    |
| `GET /api/points/history?start=&end=`                              | Readings in a time window (replay)                                            |
| `GET /api/stats/timeseries?hours=`                                 | Avg/max CPM over time                                                         |
| `POST /api/config/threshold`                                       | `{"threshold": 100.0}`                                                        |
| `POST /api/config/speed`                                           | `{"multiplier": 0.01}`                                                        |
| `WebSocket /ws`                                                    | Snapshot on connect, then live updates: `{ "channel": "map", "data": {...} }` |

---

## Cloud Deployment (AWS)

Ubuntu 24.04 EC2 instance (**t3.2xlarge**, 8 vCPU / 32 GiB RAM, 60 GiB storage), region **eu-north-1 (Stockholm)**.
Open ports **22, 5173, 8000** (and 8080/8081 for the demo — Kafka UI and Flink dashboard).

**Public URL:** http://13.63.169.164:5173

```bash
# On a fresh Ubuntu EC2 instance:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER && newgrp docker

git clone https://collaborating.tuhh.de/e-19/teaching/bd26_project_t5_c.git
cd bd26_project_t5_c

# Download the full Safecast dataset directly on the instance (do NOT scp it, it's ~30GB):
cd data
curl -o measurements-out.csv "https://api.safecast.org/system/measurements.csv"
cd ..

docker compose up --build -d
```

The frontend URLs are baked in at build time. Before building, create `frontend/.env`:

```bash
VITE_API_URL=http://13.63.169.164:8000
VITE_WS_URL=ws://13.63.169.164:8000/ws
```

And set the backend's CORS origin in `docker-compose.yml` to match your public IP:

```yaml
backend:
  environment:
    BACKEND_CORS_ORIGINS: '["http://13.63.169.164:5173", "http://localhost:5173"]'
```

Then open `http://13.63.169.164:5173`.

> Tip: allocate an **Elastic IP** and associate it with the instance so the public IP stays fixed
> across stop/start cycles — otherwise a restarted instance may get a new IP and break the URLs above.

---

## Docker Images

Published publicly on Docker Hub:

```bash
docker pull roshinroy/radiation-producer:latest
docker pull roshinroy/radiation-flink-job:latest
docker pull roshinroy/radiation-backend:latest
docker pull roshinroy/radiation-frontend:latest
```

To run from these instead of building locally, `docker-compose.yml` already references these
images directly (`image:` instead of `build:`) for `producer`, `flink-jobmanager`,
`flink-taskmanager`, `flink-submitter`, `backend`, and `frontend`. Just run:

```bash
docker compose up -d
```

and Docker will pull the published images automatically instead of building from source.

---

## Repository Layout

```
producer/           Configurable Kafka data provider (Safecast CSV → radiation-raw)
flink-job/          Stream processing topology and operators
radiation-backend/  FastAPI: Kafka consumer, Redis cache, TimescaleDB, REST + WebSocket
frontend/           React + Leaflet GUI
docker-compose.yml  Full stack
data/               Safecast dataset (not in Git)
images/             Screenshots used in this README
```

All development branches are preserved. `main` is the released state; features were merged via GitLab Merge Requests with peer review.

---

## Team

| Member               | Responsibility                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Ayush Parab          | FastAPI backend , Redis, TimescaleDB, REST/WebSocket, replay feature                                           |
| Roshin Roy           | Kafka data provider, Redis, Docker infrastructure / Backend Optimization / Frontend Configuration Features     |
| Roshan S             | Frontend Side Panel Features                                                                                   |
| Mrudula Sachin Rothe | React / Leaflet map and dashboard / Flink Advanced Operators / Frontend WebSocket Integration / Backend models |
| Chanakya Gummidipudi | Frontend Structure / Frontend Leaflet Map                                                                      |
| Moniya Mohan         | Flink topology and operators, React / dashboard features / Backend Optimization                                |

---

## Troubleshooting

| Symptom                                         | Fix                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Map empty                                       | Check the Flink job is `RUNNING` at :8081; `docker compose logs flink-submitter` |
| No live data in UI                              | WebSocket blocked — verify `VITE_WS_URL` and that port 8000 is open              |
| CORS error                                      | Add the frontend origin to `BACKEND_CORS_ORIGINS`                                |
| Kafka/Flink container exits                     | Not enough RAM — lower `KAFKA_HEAP_OPTS` / taskmanager memory                    |
| `FileNotFoundError: /data/measurements-out.csv` | Dataset missing — see Quick Start                                                |
| History endpoints empty                         | TimescaleDB only stores data since startup; let the producer run a few minutes   |
