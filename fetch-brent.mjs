// Zero-dependency Brent crude oil monthly price fetcher
// Fetches monthly average spot prices from FRED (Federal Reserve Economic Data)
// Series: DCOILBRENTEU (Europe Brent Spot Price FOB, Dollars per Barrel)

const FRED_CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU&cosd=2002-01-01&fq=Monthly&fam=avg'

function parseCSV(csv) {
  const lines = csv.trim().split('\n')
  // Skip header: DATE,DCOILBRENTEU
  return lines.slice(1)
    .map(line => {
      const [dateStr, valueStr] = line.split(',')
      if (!dateStr || !valueStr || valueStr === '.') return null
      const price = parseFloat(valueStr)
      if (isNaN(price)) return null
      // Convert "2002-01-01" to "2002-01"
      const date = dateStr.slice(0, 7)
      return { date, price: Math.round(price * 100) / 100 }
    })
    .filter(Boolean)
}

async function main() {
  const fs = await import('fs')

  console.log('Fetching Brent crude monthly prices from FRED...')
  const response = await fetch(FRED_CSV_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  const csv = await response.text()

  const prices = parseCSV(csv)
  console.log(`Parsed ${prices.length} monthly entries`)

  if (prices.length === 0) {
    console.error('No data parsed — skipping write')
    process.exit(1)
  }

  // Read existing data to preserve any manual entries not in FRED
  let existing = []
  try {
    existing = JSON.parse(fs.readFileSync('./data/brent.json', 'utf-8'))
  }
  catch {
    // No existing file, start fresh
  }

  // Merge: FRED data takes precedence, but keep any dates only in existing
  const fredDates = new Set(prices.map(p => p.date))
  const manualOnly = existing.filter(e => !fredDates.has(e.date))
  const merged = [...prices, ...manualOnly].sort((a, b) => a.date.localeCompare(b.date))

  fs.writeFileSync('./data/brent.json', JSON.stringify(merged, null, 2))
  console.log(`Written ${merged.length} entries to brent.json`)

  const latest = merged[merged.length - 1]
  console.log(`Latest: ${latest.date} — $${latest.price}/bbl`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
