/**
 * tefas.ts — TEFAS mutual fund price fetcher
 *
 * Source: TEFAS unofficial JSON API (no key required)
 *   - URL: https://www.tefas.gov.tr/api/DB/BindHistoryInfo
 *   - Method: POST, Content-Type: application/x-www-form-urlencoded; charset=UTF-8
 *   - Payload fields: fontip, fonkod, bastarih, bittarih (DD.MM.YYYY format)
 *   - Response: { data: [{ FIYAT: number|string, ... }] }
 *   - FIYAT field may use comma as decimal separator (Turkish format)
 *
 * fetch_config shape for tefas_fund symbols:
 *   { "tefasCode": "TI1" }  — TEFAS fund code (e.g. "TI1", "MAC", "AAK")
 */

export interface TefasFetchResult {
  /** TEFAS fund code (e.g. "TI1") */
  tefasCode: string
  /** NAV (net asset value) in TRY */
  price: number
  source: 'tefas'
}

const TEFAS_URL = 'https://www.tefas.gov.tr/api/DB/BindHistoryInfo'

function todayTefas(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

/** Fetch the current NAV for a single TEFAS fund code. */
export async function fetchTefasPrice(
  tefasCode: string
): Promise<TefasFetchResult> {
  const dateStr = todayTefas()

  const params = new URLSearchParams({
    fontip: 'YAT',
    sfontur: '',
    fonkod: tefasCode,
    fongrup: '',
    bastarih: dateStr,
    bittarih: dateStr,
    fonturkod: '',
    fonunvantip: '',
  })

  const res = await fetch(TEFAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: params.toString(),
  })

  if (!res.ok) throw new Error(`TEFAS HTTP ${res.status}`)

  const json = (await res.json()) as { data: Record<string, unknown>[] }
  if (!json.data || json.data.length === 0) {
    throw new Error(`TEFAS: no data for fund ${tefasCode} on ${dateStr}`)
  }

  const raw = json.data[0].FIYAT
  const price =
    typeof raw === 'string'
      ? parseFloat(raw.replace(',', '.'))
      : Number(raw)

  if (isNaN(price) || price <= 0) {
    throw new Error(`TEFAS: invalid price for ${tefasCode}: ${raw}`)
  }

  return { tefasCode, price, source: 'tefas' }
}
