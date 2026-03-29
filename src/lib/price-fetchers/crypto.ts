/**
 * crypto.ts — Cryptocurrency price fetcher
 *
 * Source: Binance.US Public REST API (no authentication required)
 *   - URL: https://www.binance.us/api/v3/ticker/price?symbol={pair}
 *   - Method: GET
 *   - Response: { "symbol": "BTCUSDT", "price": "68432.10" }
 *   - Underscores and spaces are stripped from the pair before the request
 *
 * fetch_config shape for cryptocurrency symbols:
 *   { "binancePair": "BTCUSDT" }  — Binance.US trading pair (e.g. "BTCUSDT", "ETHUSDT", "PAXGTRY")
 *
 * Note: Binance pairs are quoted against USDT or TRY depending on the pair.
 * The returned price is in the quote currency of the pair. The dispatcher
 * stores this as the `rate` and records the source currency via `primary_conversion_fiat`
 * on the symbol (e.g. BTC → USD, so a BTCUSDT pair gives USD price).
 */

const BINANCE_BASE_URL = 'https://www.binance.us/api/v3/ticker/price'

export interface CryptoFetchResult {
  /** Binance trading pair (formatted, e.g. "BTCUSDT") */
  binancePair: string
  /** Price in the quote currency of the pair */
  price: number
  source: 'binance'
}

/** Fetch the current price for a single Binance.US trading pair. */
export async function fetchCryptoPrice(
  binancePair: string
): Promise<CryptoFetchResult> {
  // Strip underscores, spaces; uppercase — matches reference script behaviour
  const formattedPair = binancePair.replace(/[_\s]/g, '').toUpperCase()
  const url = `${BINANCE_BASE_URL}?symbol=${formattedPair}`

  const res = await fetch(url)

  if (res.status === 400) {
    throw new Error(
      `Binance.US: invalid symbol or pair not supported: ${formattedPair}`
    )
  }
  if (!res.ok) {
    throw new Error(`Binance.US HTTP ${res.status} for ${formattedPair}`)
  }

  const json = (await res.json()) as { symbol?: string; price?: string }
  if (!json.price) {
    throw new Error(`Binance.US: no price in response for ${formattedPair}`)
  }

  const price = parseFloat(json.price)
  if (isNaN(price) || price <= 0) {
    throw new Error(
      `Binance.US: invalid price for ${formattedPair}: ${json.price}`
    )
  }

  return { binancePair: formattedPair, price, source: 'binance' }
}
