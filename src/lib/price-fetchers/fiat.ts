/**
 * fiat.ts — Fiat FX rate fetcher
 *
 * Primary source: TCMB EVDS API (Turkish Central Bank)
 *   - Fetches TRY-denominated rates for USD, EUR, GBP
 *   - API key: process.env.TCMBAPI_KEY
 *   - Series: TP.DK.USD.A (buying rate), TP.DK.EUR.A, TP.DK.GBP.A
 *   - URL: https://evds2.tcmb.gov.tr/service/evds/series={series}&startDate={DD-MM-YYYY}&endDate={DD-MM-YYYY}&type=json&key={key}
 *   - Response field map: "TP_DK_USD_A" → USD/TRY, "TP_DK_EUR_A" → EUR/TRY, "TP_DK_GBP_A" → GBP/TRY
 *
 * Fallback source: Frankfurter API (ECB-based, no key required)
 *   - URL: https://api.frankfurter.app/latest?from=USD&to=EUR,GBP
 *   - Used when TCMB is unavailable; derives TRY rates from USD/TRY cross rates
 *   - Also used to obtain EUR/USD and GBP/USD for non-TRY display currency calculations
 *
 * fetch_config shape for fiat symbols:
 *   { "tcmbSeries": "TP.DK.USD.A" }  — EVDS series code
 *   Leave null/omit for TRY itself (rate always 1.0).
 */

export interface FiatFetchResult {
  /** ISO currency code (e.g. "USD") */
  code: string
  /** Price of 1 unit in TRY */
  rate: number
  source: 'tcmb' | 'frankfurter'
}

/** Maps symbol code to TCMB EVDS series code and the response key */
const TCMB_SERIES: Record<string, { series: string; responseKey: string }> = {
  USD: { series: 'TP.DK.USD.A', responseKey: 'TP_DK_USD_A' },
  EUR: { series: 'TP.DK.EUR.A', responseKey: 'TP_DK_EUR_A' },
  GBP: { series: 'TP.DK.GBP.A', responseKey: 'TP_DK_GBP_A' },
}

function todayTcmb(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/** Fetch TRY rates for all supported fiat codes from TCMB EVDS. */
async function fetchFromTcmb(): Promise<Map<string, number>> {
  const key = process.env.TCMBAPI_KEY
  if (!key) throw new Error('TCMBAPI_KEY not set')

  const allSeries = Object.values(TCMB_SERIES)
    .map((s) => s.series)
    .join('-')
  const date = todayTcmb()
  const url = `https://evds2.tcmb.gov.tr/service/evds/series=${allSeries}&startDate=${date}&endDate=${date}&type=json&key=${key}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`TCMB EVDS HTTP ${res.status}`)

  const json = (await res.json()) as { items: Record<string, string>[] }
  const item = json.items?.[0]
  if (!item) throw new Error('TCMB EVDS: no data returned for today')

  const rates = new Map<string, number>()
  for (const [code, { responseKey }] of Object.entries(TCMB_SERIES)) {
    const raw = item[responseKey]
    if (raw == null || raw === '') continue
    const rate = parseFloat(String(raw).replace(',', '.'))
    if (!isNaN(rate) && rate > 0) rates.set(code, rate)
  }
  return rates
}

/**
 * Fallback: fetch USD/TRY equivalent via Frankfurter by deriving from EUR/TRY base.
 * Frankfurter does not have TRY pairs directly, so this is best-effort.
 * In practice the TCMB fallback is attempted on weekdays; over weekends the last
 * successful TCMB rate is retained in exchange_rates (fallback handled by dispatcher).
 */
async function fetchFromFrankfurter(): Promise<Map<string, number>> {
  // Frankfurter: get USD, EUR, GBP all relative to TRY
  const url = 'https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,GBP'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`)

  const json = (await res.json()) as { base: string; rates: Record<string, number> }
  const rates = new Map<string, number>()

  // Frankfurter returns how many USD/EUR/GBP per 1 TRY — invert for TRY per 1 unit
  for (const [code, crossRate] of Object.entries(json.rates ?? {})) {
    if (crossRate > 0) rates.set(code, 1 / crossRate)
  }
  return rates
}

/**
 * Fetch TRY-denominated rates for the given fiat symbol codes.
 * Returns only the codes that were successfully fetched.
 */
export async function fetchFiatRates(
  codes: string[]
): Promise<FiatFetchResult[]> {
  const results: FiatFetchResult[] = []

  // TRY is always 1.0 — no external fetch needed
  if (codes.includes('TRY')) {
    results.push({ code: 'TRY', rate: 1.0, source: 'tcmb' })
  }

  const foreignCodes = codes.filter(
    (c) => c !== 'TRY' && c in TCMB_SERIES
  )
  if (foreignCodes.length === 0) return results

  // Try TCMB first
  let rateMap: Map<string, number> | null = null
  let source: 'tcmb' | 'frankfurter' = 'tcmb'

  try {
    rateMap = await fetchFromTcmb()
  } catch {
    // TCMB failed — try Frankfurter fallback
    try {
      rateMap = await fetchFromFrankfurter()
      source = 'frankfurter'
    } catch {
      rateMap = null
    }
  }

  if (!rateMap) throw new Error('Both TCMB and Frankfurter failed')

  for (const code of foreignCodes) {
    const rate = rateMap.get(code)
    if (rate != null) {
      results.push({ code, rate, source })
    }
  }

  return results
}
