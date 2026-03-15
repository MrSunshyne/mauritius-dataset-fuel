# Mauritius Fuel Price Dataset

Automatically updated dataset of Mauritius fuel prices, scraped daily from the [State Trading Corporation](https://www.stcmu.com/ppm/retail-prices) website.

Zero dependencies — uses Node.js built-in `fetch` to scrape the STC retail prices table.

## Datasets

### [`data/prices.json`](https://github.com/MrSunshyne/mauritius-dataset-fuel/blob/main/data/prices.json) (recommended)

Clean format with ISO dates and numeric values, sorted newest first:

```json
[
  { "date": "2026-03-03", "petrol": 58.45, "diesel": 58.95 },
  { "date": "2025-11-04", "petrol": 58.45, "diesel": 58.95 }
]
```

**Raw URL** (for fetching in your app):
```
https://raw.githubusercontent.com/MrSunshyne/mauritius-dataset-fuel/main/data/prices.json
```

### [`data/latest.json`](https://github.com/MrSunshyne/mauritius-dataset-fuel/blob/main/data/latest.json)

Legacy format preserving the original STC date strings:

```json
[
  { "date": "03-March-2026", "petrol": "58.45", "diesel": "58.95" }
]
```

### `data/history/`

Daily snapshots in `{YYYY-MM-DD}.json` format, archived since 2022.

## Usage

Fetch the data in any application:

```js
const res = await fetch('https://raw.githubusercontent.com/MrSunshyne/mauritius-dataset-fuel/main/data/prices.json')
const prices = await res.json()
// prices[0] = { date: "2026-03-03", petrol: 58.45, diesel: 58.95 }
```

## Example applications

- [Mauritius Fuel Prices](https://mauritius-fuel-prices.netlify.app/)

## How it works

A GitHub Actions workflow runs daily at midnight UTC:
1. Fetches the STC retail prices HTML page
2. Parses the price table (no browser needed — plain HTML parsing)
3. Outputs `data/latest.json`, `data/prices.json`, and a dated snapshot
4. Commits and pushes if the data changed

## Running locally

```bash
node fetch.mjs
```

## Disclaimers

- The maintainer of this repository is NOT affiliated with the STC.
- The data is automatically fetched from the STC website but not provided directly by them.
- The [source page](https://www.stcmu.com/ppm/retail-prices) is publicly available.
- The data is fetched at a rate of 1 time every 24 hours.
- The data is made available here under fair use.
