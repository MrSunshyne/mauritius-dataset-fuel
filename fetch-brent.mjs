// Zero-dependency Brent crude oil monthly price fetcher
// Primary source: datasets/oil-prices on GitHub (public domain, served from raw.githubusercontent.com)
// Fallback: existing data/brent.json is kept if fetch fails

const BRENT_CSV_URL = 'https://raw.githubusercontent.com/datasets/oil-prices/main/data/brent-monthly.csv'

function parseCSV(csv) {
  const lines = csv.trim().split('\n')
  // Header: Date,Price
  return lines.slice(1)
    .map(line => {
      const [dateStr, valueStr] = line.split(',')
      if (!dateStr || !valueStr) return null
      const price = parseFloat(valueStr)
      if (isNaN(price)) return null
      // Convert "2002-01-15" to "2002-01"
      const date = dateStr.slice(0, 7)
      return { date, price: Math.round(price * 100) / 100 }
    })
    .filter(Boolean)
}

async function main() {
  const fs = await import('fs')

  // Read existing data first — we'll keep it if the fetch fails
  let existing = []
  try {
    existing = JSON.parse(fs.readFileSync('./data/brent.json', 'utf-8'))
  }
  catch {
    // No existing file
  }

  let fetched = []
  try {
    console.log('Fetching Brent crude monthly prices from datasets/oil-prices...')
    const response = await fetch(BRENT_CSV_URL, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    const csv = await response.text()
    fetched = parseCSV(csv)
    console.log(`Parsed ${fetched.length} monthly entries`)
  }
  catch (err) {
    console.warn(`Fetch failed: ${err.message}`)
    if (existing.length > 0) {
      console.log(`Keeping existing brent.json (${existing.length} entries)`)
      return
    }
    throw err
  }

  // Filter to 2002+ to match Mauritius fuel price data range
  const filtered = fetched.filter(p => p.date >= '2002-01')

  if (filtered.length === 0) {
    console.warn('No data after filtering — keeping existing brent.json')
    return
  }

  // Merge: fetched data takes precedence, but keep any dates only in existing
  // (e.g. manually added recent months not yet in the upstream dataset)
  const fetchedDates = new Set(filtered.map(p => p.date))
  const manualOnly = existing.filter(e => !fetchedDates.has(e.date))
  if (manualOnly.length > 0) {
    console.log(`Preserving ${manualOnly.length} entries not in upstream: ${manualOnly.map(e => e.date).join(', ')}`)
  }
  const merged = [...filtered, ...manualOnly].sort((a, b) => a.date.localeCompare(b.date))

  fs.writeFileSync('./data/brent.json', JSON.stringify(merged, null, 2))
  console.log(`Written ${merged.length} entries to brent.json`)

  const latest = merged[merged.length - 1]
  console.log(`Latest: ${latest.date} — $${latest.price}/bbl`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
