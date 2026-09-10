# Vessel Positions API

NestJS REST API for ingesting and querying AIS vessel position reports. Data is stored in SQLite (`positions.sqlite`).

The Vue client for this API lives here: https://github.com/ioannvlac-hub/vessels-pos-api

**Stack:** Node 20 · NestJS 10 · TypeORM · SQLite (`better-sqlite3`)

## Quick start

```bash
npm install
npm run start:dev    # http://localhost:3000, hot reload
```

Load the sample dataset (API must be running):

```bash
npm run ingest -- ./data-fs-exercise.csv
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/positions` | Create one position or a batch |
| `GET` | `/positions/trips` | Vessel trip summaries (no full position lists) |
| `GET` | `/positions/trips/:vesselId/positions` | Paginated positions for one vessel |

CORS is enabled for `http://localhost:5173` by default (Vue client).

### Create positions — `POST /positions`

**Body:** a single object or an array of:

```json
{
  "vesselId": 5091,
  "receivedTimeUtc": "2017-12-20T22:59:12.000Z",
  "latitude": 25.91658,
  "longitude": -79.50869
}
```

**Two modes:**

| Caller | Header | Behaviour |
|--------|--------|-----------|
| Web client | *(none)* | **All-or-nothing** — any invalid row → `400`, nothing saved |
| CSV ingest script | `X-Ingest-Partial: true` | Valid rows inserted, invalid rows in `errors[]`, `201` |

**Success (`201`):**

```json
{
  "received": 2,
  "inserted": 2,
  "duplicates": 0,
  "rejected": 0,
  "errors": []
}
```

**Client validation failure (`400`):** same counters with `inserted: 0` and per-row `errors[{ index, reasons }]`.

Duplicates on `(vesselId, receivedTimeUtc)` are idempotent (`duplicates` count, not an error).

**Business rules (summary):**

- ISO-8601 UTC timestamp, not in the future
- Latitude/longitude in valid ranges
- Same timestamp + different coordinates → rejected
- Implausible jumps between reports → rejected (max distance **50,000 km**)

### Trip summaries — `GET /positions/trips`

One entry per vessel: `vesselId`, `total`, `firstPosition`, `lastPosition`.

### Paginated positions — `GET /positions/trips/:vesselId/positions`

| Query | Description |
|-------|-------------|
| `limit` | Page size, 1–500 (default `50`) |
| `offset` | Skip rows (default `0`) |
| `from` | ISO datetime — inclusive start |
| `to` | ISO datetime — inclusive end |
| `region` | Ocean region name (e.g. `Caribbean Sea`) |

Response: `{ items, total, limit, offset }`.

## CSV ingest

```bash
npm run ingest -- ./data-fs-exercise.csv
```

| Variable | Default |
|----------|---------|
| `CSV_PATH` | `./data-fs-exercise.csv` |
| `API_URL` | `http://localhost:3000/positions` |
| `BATCH_SIZE` | `500` |

The script sends `X-Ingest-Partial: true` so bad rows in a batch do not block valid ones.

Expected first run on the provided CSV: ~26,979 inserted, ~3 rejected. A second run should report all rows as duplicates.

## Configuration

| Variable | Default |
|----------|---------|
| `PORT` | `3000` |
| `CORS_ORIGIN` | `http://localhost:5173` |

## Tests

```bash
npm run test          # unit + e2e
npm run test:unit     # unit only
npm run test:e2e      # e2e only
npm run typecheck
```

```
test/
  unit/              # DTO + pure logic (<200 lines each)
  e2e/               # HTTP integration, one feature per file
  create-test-app.ts # shared Nest bootstrap (e2e only)
  fixtures.ts        # shared test data
```

## Project layout

```
src/
  controllers/   HTTP layer
  services/      Validation and business logic
  repositories/  TypeORM data access
  dto/           Request validation
  utils/         Movement checks, ocean regions
scripts/
  ingest.ts      CSV → POST /positions
```

## MIT Licensed
