// Zero-dependency Mauritius inflation fetcher
// Inflation rates: Bank of Mauritius, DF_INF dataflow (https://bomstats.bom.mu), from 2007-07
// CPI index:       IMF, IMF.STA:CPI dataflow (https://data.imf.org), from 2001-01
// The BoM publishes rates only, not the index level needed to adjust prices for
// inflation, so the index comes from the IMF (both are compiled from Statistics Mauritius).

const BOM_URL = 'https://bomstats.bom.mu/datamanager/ws/nsi_ws/rest/data/MU2,DF_INF,1.0/all/ALL/'
const IMF_URL = 'https://api.imf.org/external/sdmx/2.1/data/IMF.STA,CPI/MUS.CPI._T.IX.M?startPeriod=2001-01'
const SDMX_CSV = 'application/vnd.sdmx.data+csv;version=1.0.0'

// An IMF month whose implied year-on-year change is further than this from the
// BoM's published rate is treated as bad data (e.g. 2026-04, which repeats the 2025-04 value)
const MAX_YOY_GAP = 1

function parseCSV(text) {
  // Quote-aware: IMF CSV has quoted description fields containing commas
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    }
    else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }

  const [header, ...body] = rows.filter(r => r.length > 1)
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

async function fetchCSV(url) {
  // The BoM server returns HTTP 500 for Node's default "Accept-Language: *"
  const headers = { Accept: SDMX_CSV, 'Accept-Language': 'en' }
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText} (${url})`)
  return parseCSV(await response.text())
}

function monthsBefore(month, n) {
  const [y, m] = month.split('-').map(Number)
  const t = y * 12 + (m - 1) - n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places

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

  console.log('Fetching inflation rates from the Bank of Mauritius...')
  const headline = new Map()
  const yoy = new Map()
  for (const row of await fetchCSV(BOM_URL)) {
    if (row.FREQ !== 'M' || row.OBS_VALUE === '') continue
    if (row.INF_INDIC === 'H_INF') headline.set(row.TIME_PERIOD, round(parseFloat(row.OBS_VALUE), 1))
    if (row.INF_INDIC === 'Y_INF') yoy.set(row.TIME_PERIOD, round(parseFloat(row.OBS_VALUE), 1))
  }
  console.log(`Parsed ${headline.size} headline and ${yoy.size} year-on-year months`)

  console.log('Fetching CPI index from the IMF...')
  const cpi = new Map()
  for (const row of await fetchCSV(IMF_URL)) {
    // TIME_PERIOD is "2026-M07"
    const match = row.TIME_PERIOD?.match(/^(\d{4})-M(\d{2})$/)
    if (match && row.OBS_VALUE !== '') cpi.set(`${match[1]}-${match[2]}`, parseFloat(row.OBS_VALUE))
  }
  console.log(`Parsed ${cpi.size} CPI months`)

  if (yoy.size === 0 || cpi.size === 0) {
    throw new Error('A source returned no data — refusing to write')
  }

  // Derive the index from the BoM rate where the IMF month is missing (the BoM
  // publishes first) or disagrees with the published rate
  const months = [...new Set([...cpi.keys(), ...yoy.keys()])].sort()
  for (const month of months) {
    const rate = yoy.get(month)
    const base = cpi.get(monthsBefore(month, 12))
    if (rate === undefined || base === undefined) continue
    const imf = cpi.get(month)
    if (imf !== undefined && Math.abs((imf / base - 1) * 100 - rate) <= MAX_YOY_GAP) continue
    const derived = base * (1 + rate / 100)
    console.log(`${month}: CPI ${imf ?? 'missing'} → ${round(derived, 2)} from BoM year-on-year ${rate}%`)
    cpi.set(month, derived)
  }

  const inflation = months.map(date => ({
    date,
    cpi: cpi.has(date) ? round(cpi.get(date), 2) : null,
    headline: headline.get(date) ?? null,
    yoy: yoy.get(date) ?? null,
  }))

  const existing = readExisting(fs, './data/inflation.json')
  if (inflation.length < existing.length) {
    throw new Error(`Built ${inflation.length} months but ${existing.length} already exist — refusing to overwrite`)
  }

  fs.writeFileSync('./data/inflation.json', JSON.stringify(inflation, null, 2))
  console.log(`Written ${inflation.length} months to inflation.json`)

  const latest = inflation[inflation.length - 1]
  console.log(`Latest: ${latest.date} — CPI ${latest.cpi}, headline ${latest.headline}%, year-on-year ${latest.yoy}%`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
