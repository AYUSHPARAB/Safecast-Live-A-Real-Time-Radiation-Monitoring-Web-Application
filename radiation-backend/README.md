# Radiation Tracking Backend

# Radiation Tracking Backend

A real-time API that serves live radiation sensor data to a web map. This backend powers a project that ingests public Safecast radiation readings, processes them as a live stream, and visualizes them on an interactive map.

This service sits in the middle of the system: it receives processed readings, keeps the latest state in memory, and hands that data to the
frontend over both normal HTTP requests and a live WebSocket connection.

---

## What this does, in one paragraph

Radiation sensors around the world report "counts per minute" (cpm) — higher numbers mean more radiation. Those readings flow through a processing pipeline and arrive here. This backend remembers the **latest reading for every sensor**, keeps a list of **recent dangerous alerts**, and tracks **overall statistics**.
The frontend asks the backend for that data and also keeps a live connection open so new readings appear on the map the instant they arrive —
no page refresh needed.

---

## Where this fits in the bigger system

The full project is built by several sub-teams. Data flows left to right:

```

Kafka producer  ->  Flink stream     ->    Backend   ->  React + Leaflet
(reads Safecast     processing &       (this service)    map frontend
 radiation CSV)     cleaning
```

- **Backend** receives the cleaned and processed data from flink and serves it to the frontend.

Each team only needs to agree on the **shape of the data** passed between them.
Backend can run entirely on its own using built-in fake data (see *Mock mode* below),
so the frontend team is never blocked waiting for the pipeline.

---

## Tech stack

- **Python 3.11+**
- **FastAPI** — the web framework (serves HTTP and WebSocket)
- **Pydantic** — defines and validates the data shapes
- **pydantic-settings** — reads configuration from a `.env` file
- **Uvicorn** — the server that runs the app

---

## Project structure

```
radiation-backend/
├── app/
│   ├── main.py          # Starts the app, wires everything together, /ws endpoint
│   ├── config.py        # Settings read from environment (.env)
│   ├── models.py        # The data shapes (the "contract" with flink)
│   ├── cache.py         # In-memory store of the latest state (fast lookups)
│   ├── mock.py          # Fake-data generator for running without the pipeline
│   ├── ws_manager.py    # Tracks live WebSocket connections and broadcasts
│   └── routes/
│       ├── points.py    # GET /api/points
│       ├── stats.py     # GET /api/stats/current
│       └── alerts.py    # GET /api/alerts
├── requirements.txt
├── .env                 # Local config (NOT committed to Git)
└── README.md
```

---

## Getting started

### 1. Prerequisites

You need **Python 3.11 or newer** installed. Check with:

```bash
python --version
```

### 2. Create and activate a virtual environment

A virtual environment keeps this project's packages separate from the rest of
your computer.

**Windows (PowerShell):**
```bash
python -m venv .venv
.venv\Scripts\activate
```

**macOS / Linux:**
```bash
python -m venv .venv
source .venv/bin/activate
```

When active, your terminal prompt starts with `(.venv)`.

### 3. Install the dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the server

```bash
uvicorn app.main:app --reload
```

You should see:
```
INFO:     Application startup complete.
INFO:app.mock:Mock generator started (interval=1.0s)
```

The backend is now running at **http://localhost:8000**.

### 5. Open the interactive docs

Go to **http://localhost:8000/docs** in your browser. FastAPI auto-generates a
page where you can see and try every endpoint. This is the easiest way to
explore the API.

---

## Configuration

Settings are read from a file named `.env` in the project root. If the file is
missing, sensible defaults are used, so you can run the project with no `.env`
at all.

Create a `.env` file like this to override the defaults:

```bash
# .env
MOCK_MODE=true      # true = generate fake data; false = wait for the real pipeline
MAX_ALERTS=200      # how many recent alerts to keep in memory
```

| Setting      | Default | Meaning                                              |
|--------------|---------|------------------------------------------------------|
| `MOCK_MODE`  | `true`  | Run with built-in fake data instead of the pipeline. |
| `MAX_ALERTS` | `200`   | Maximum recent alerts held in memory at once.        |

> **Note:** `.env` is ignored by Git and should never be committed. Each
> developer keeps their own.

---

## Mock mode

When `MOCK_MODE=true`, the backend runs a background generator that invents
realistic fake readings for three cities (Tokyo, Hamburg, Fukushima) every
second. This means the whole backend works **without** Kafka, Flink, or a
database — so the frontend team can build against a live API immediately.

When the real pipeline is ready, set `MOCK_MODE=false`. The fake generator stays
off, and real data fills the exact same store and endpoints. **No frontend code
needs to change** when the switch happens — only the source of the data does.

---

## REST API reference

All responses are JSON. The base URL during development is
`http://localhost:8000`.

### `GET /api/health`

A simple check that the server is alive.

**Response**
```json
{ "status": "ok", "mock_mode": true }
```

### `GET /api/points`

The latest reading for every sensor. Used to draw markers on the map.

**Optional query parameters**

| Parameter | Example                     | Meaning                                          |
|-----------|-----------------------------|--------------------------------------------------|
| `min_cpm` | `?min_cpm=100`              | Only return readings at or above this cpm.        |
| `bbox`    | `?bbox=139,35,140,36`       | Only return readings inside this map rectangle.   |

`bbox` is `min_lon,min_lat,max_lon,max_lat` — the corners of the visible map.

**Response (one item shown)**
```json
[
  {
    "captured_at": 1782025594814,
    "uploaded_at": null,
    "latitude": 53.59016,
    "longitude": 9.99051,
    "cpm": 172.3,
    "unit": "cpm",
    "device_id": "HAM-3945",
    "location_name": "Hamburg",
    "md5": "",
    "level": "elevated",
    "sensor_key": "dev:HAM-3945",
    "captured_at_dt": "2026-06-21T07:06:34.814000Z",
    "display_name": "Hamburg"
  }
]
```

### `GET /api/alerts`

Recent readings flagged as dangerous (high radiation), most recent first.

**Optional query parameter**

| Parameter | Default | Meaning                                  |
|-----------|---------|------------------------------------------|
| `limit`   | `20`    | How many recent alerts to return (1–500). |

**Response (one item shown)**
```json
[
  {
    "captured_at": 1782025707583,
    "latitude": 37.76907,
    "longitude": 140.50846,
    "cpm": 316.9,
    "device_id": "FUK-6112",
    "location_name": "Fukushima",
    "level": "high",
    "captured_at_dt": "2026-06-21T07:08:27.583000Z",
    "display_name": "Fukushima",
    "alert_text": "Dangerous radiation detected in Fukushima"
  }
]
```

### `GET /api/stats/current`

The latest overall statistics. Returns `null` if no stats exist yet.

**Response**
```json
{
  "type": "global_stats",
  "avg_cpm": 51.0,
  "max_cpm": 155.8,
  "active_sensors": 717,
  "alert_count": 50,
  "reading_count": 2629
}
```

---

## WebSocket API reference

For live updates, connect to:

```
ws://localhost:8000/ws
```

Every message is JSON with two fields: a `channel` (a label saying what kind of
update it is) and `data` (the actual payload). The frontend reads `channel` to
decide what to do.

```json
{ "channel": "current", "data": { ...one reading... } }
```

| Channel   | When it is sent                                  | What `data` contains          |
|-----------|--------------------------------------------------|-------------------------------|
| `map`     | Once, immediately on connect                     | `{ "points": [ ...all... ] }` |
| `current` | Every time a new reading arrives                 | One sensor reading            |
| `alerts`  | Every time a dangerous reading is detected       | One alert                     |
| `stats`   | On connect, then periodically                    | One statistics object         |

The `map` snapshot on connect means the map is never blank — a new client
immediately receives the full current state, then live updates follow.

---

## How to test it manually

No automated test setup is required to verify the service by hand.

### Test the REST endpoints

1. Run the server.
2. Open **http://localhost:8000/docs**.
3. Click any endpoint → **Try it out** → **Execute**.

### Test the WebSocket

1. Open **http://localhost:8000/docs**.
2. Press **F12** and open the **Console** tab.
3. Paste:

   ```javascript
   const ws = new WebSocket("ws://localhost:8000/ws");
   ws.onopen = () => console.log("CONNECTED");
   ws.onmessage = (e) => console.log(JSON.parse(e.data));
   ws.onclose = () => console.log("DISCONNECTED");
   ```

4. You should see a `map` snapshot first, then `current`, `alerts`, and `stats`
   messages streaming in live.
5. To disconnect: `ws.close()`.

---

## Project status

| Feature                                   | Status      |
|-------------------------------------------|-------------|
| Health endpoint                           | Done        |
| Data models (the team contract)           | Done        |
| In-memory cache                           | Done        |
| Mock data generator                       | Done        |
| REST endpoints (points, alerts, stats)    | Done        |
| WebSocket live push                       | Done        |
| Connection to the real Kafka pipeline     | Planned     |
| Permanent storage (TimescaleDB)           | Planned     |
| Historical data endpoints                 | Planned     |

The backend currently runs fully in **mock mode**, which is enough for the
frontend team to build the complete map and dashboard. Connecting the real data
pipeline and adding permanent storage are the next milestones.
