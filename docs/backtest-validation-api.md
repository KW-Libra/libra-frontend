# Backtest validation API

The frontend must not ship raw backtest artifacts in `public/`.

Production ownership should be:

- S3 or database stores raw/final backtest artifacts.
- Backend reads those artifacts, validates access, and maps them into a compact view model.
- Frontend calls one backend endpoint and renders the response.

## Endpoint

```http
GET /api/backtests/public-rss-3y/validation
```

The response shape is defined by `BacktestValidation` in
`src/api/backtestValidation.ts`.

## Storage options

- S3 object prefix: immutable JSON artifacts, cheap and simple for large backtest outputs.
- Database table: useful if runs need indexing, filtering, permissions, or multiple versions.
- Hybrid: raw artifacts in S3, run metadata and latest pointer in DB.

For the current public-rss-3y page, the frontend expects the backend response to
include only display-ready summary data, not full replay JSONL or full fixtures.
