// Zero-dependency STC fuel price scraper
// Fetches the retail prices table from stcmu.com and outputs JSON

const URL = 'https://www.stcmu.com/ppm/retail-prices'

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09',
  oct: '10', nov: '11', dec: '12', fev: '02',
}

function parseDate(raw) {
  // Handle various STC date formats:
  // "03-March-2026", "6-Dec-2013", "6-Jul-12", "4-Fev-10", "Before APM (01 July 2002)"
  const trimmed = raw.trim()
  if (!trimmed) return null

  // "Before APM (01 July 2002)" → extract date from parentheses
  const parenMatch = trimmed.match(/\((\d{1,2})\s+(\w+)\s+(\d{4})\)/)
  if (parenMatch) {
    const [, day, monthStr, year] = parenMatch
    const month = MONTHS[monthStr.toLowerCase()]
    if (!month) return null
    return `${year}-${month}-${day.padStart(2, '0')}`
  }

  // "03-March-2026" or "6-Jul-12"
  const parts = trimmed.split('-')
  if (parts.length !== 3) return null

  const [dayStr, monthStr, yearStr] = parts
  const month = MONTHS[monthStr.toLowerCase()]
  if (!month) return null

  const day = dayStr.padStart(2, '0')
  let year = yearStr.length === 2 ? `20${yearStr}` : yearStr

  return `${year}-${month}-${day}`
}

function extractTable(html) {
  // Find the retail prices table and extract rows
  // The table has columns: Date | Mogas (Rs/Litre) | Gas Oil (Rs/Litre)
  const rows = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi

  let match
  while ((match = rowRegex.exec(html)) !== null) {
    const cells = []
    let cellMatch
    const rowHtml = match[1]
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      // Strip HTML tags and decode entities
      const text = cellMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim()
      cells.push(text)
    }
    if (cells.length >= 3) {
      rows.push(cells)
    }
  }

  return rows
}

async function fetchHtml(attempts = 3) {
  // The STC site intermittently serves a 200 response with no price table
  // (seen 2026-08-14). Retry before giving up so a transient blip is not
  // mistaken for "the table is gone".
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(URL)
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      const html = await response.text()

      const rows = extractTable(html)
      if (rows.length > 0) return { html, rows }

      throw new Error(`response contained no table rows (${html.length} bytes)`)
    } catch (err) {
      console.error(`Attempt ${attempt}/${attempts} failed: ${err.message}`)
      if (attempt === attempts) throw err
      await new Promise(resolve => setTimeout(resolve, attempt * 5000))
    }
  }
}

function readExisting(fs, path) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function main() {
  const fs = await import('fs')

  console.log(`Fetching ${URL}...`)
  const { rows } = await fetchHtml()
  console.log(`Found ${rows.length} table rows`)

  // Skip header rows (contain "Rs/Litre" or non-numeric price values)
  const dataRows = rows.filter(row => {
    const petrol = parseFloat(row[1])
    const diesel = parseFloat(row[2])
    return !isNaN(petrol) && !isNaN(diesel) && petrol > 0
  })

  // Output in the existing format (backward compatible)
  const legacy = dataRows.map(row => ({
    date: row[0],
    petrol: row[1],
    diesel: row[2],
  }))

  // Output in clean format (ISO dates, numeric values)
  const clean = dataRows
    .map(row => {
      const date = parseDate(row[0])
      if (!date) return null
      return {
        date,
        petrol: parseFloat(row[1]),
        diesel: parseFloat(row[2]),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date)) // newest first

  // Never overwrite good data with a bad scrape. The STC table only ever grows,
  // so an empty or shrinking result means the scrape failed, not that prices vanished.
  if (clean.length === 0) {
    throw new Error(`Parsed 0 price rows from ${rows.length} table rows — refusing to write`)
  }

  const existing = readExisting(fs, './data/prices.json')
  if (clean.length < existing.length && process.env.ALLOW_SHRINK !== '1') {
    throw new Error(
      `Parsed ${clean.length} rows but ${existing.length} already exist — refusing to overwrite. ` +
        `Set ALLOW_SHRINK=1 if the STC table genuinely shrank.`
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  fs.writeFileSync('./data/latest.json', JSON.stringify(legacy))
  fs.writeFileSync(`./data/history/${today}.json`, JSON.stringify(legacy))
  fs.writeFileSync('./data/prices.json', JSON.stringify(clean, null, 2))

  console.log(`Written ${legacy.length} entries to latest.json`)
  console.log(`Written ${clean.length} entries to prices.json (clean format)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
