# Vessel Positions API

NestJS ingestion API for AIS vessel position reports.

## Setup

```bash
npm install
npm run start
```

The API listens on `http://localhost:3000` and stores data in `positions.sqlite`.

## Endpoints

### `POST /positions`

Accepts a single position object or an array of positions:

```json
{
  "vesselId": 5091,
  "receivedTimeUtc": "2017-12-20T22:59:12.000Z",
  "latitude": 25.91658,
  "longitude": -79.50869
}
```

Returns `201` with a summary:

```json
{
  "received": 1,
  "inserted": 1,
  "duplicates": 0,
  "rejected": 0,
  "errors": []
}
```

Invalid rows are reported in `errors` without failing the whole batch. Duplicate `(vesselId, receivedTimeUtc)` pairs are counted as `duplicates`.

### `GET /positions/trips`

Returns one summary per vessel (no full position list):

```json
[
  {
    "vesselId": 5091,
    "total": 8993,
    "firstPosition": {
      "id": 1,
      "vesselId": 5091,
      "receivedTimeUtc": "2017-12-20T22:59:12.000Z",
      "latitude": 25.91658,
      "longitude": -79.50869
    },
    "lastPosition": {
      "id": 8993,
      "vesselId": 5091,
      "receivedTimeUtc": "2018-01-15T10:00:00.000Z",
      "latitude": 30.1,
      "longitude": -75.2
    }
  }
]
```

### `GET /positions/trips/:vesselId/positions`

Paginated positions for a single vessel. Query params: `limit` (1–500, default 50), `offset` (default 0).

```json
{
  "items": [
    {
      "id": 1,
      "vesselId": 5091,
      "receivedTimeUtc": "2017-12-20T22:59:12.000Z",
      "latitude": 25.91658,
      "longitude": -79.50869
    }
  ],
  "total": 8993,
  "limit": 50,
  "offset": 0
}
```

## Loader

With the API running:

```bash
npm run ingest -- ./data-fs-exercise.csv
```

Environment fallbacks:

- `CSV_PATH` (default `./data-fs-exercise.csv`)
- `API_URL` (default `http://localhost:3000/positions`)
- `BATCH_SIZE` (default `500`)

Expected first-run result on the provided dataset:

- received: 26982
- inserted: 26979
- duplicates: 0
- rejected: 3

A second run should report `inserted: 0`, `duplicates: 26979`.

## Tests

```bash
npm run test:e2e
npm run typecheck
```
