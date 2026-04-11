/**
 * crypto.ts — Cryptocurrency price fetcher
 *
 * Source: Binance.US Public REST API (no authentication required)
 *   - URL: https://www.binance.us/api/v3/ticker/price?symbol={pair}
 *   - Method: GET
 *   - Response: { "symbol": "BTCUSDT", "price": "68432.10" }
 *
 * The symbol code is the asset identifier only (e.g. "BTC", "ETH", "PAXG").
 * The Binance trading pair is derived at fetch time from code + primary_conversion_fiat
 * using the PCF_TO_BINANCE_QUOTE mapping (e.g. BTC + USD → BTCUSDT).
 *
 * The returned price is in the quote currency of the pair. The dispatcher
 * stores this as the `rate` against `primary_conversion_fiat` on the symbol.
 */

const BINANCE_BASE_URL = 'https://www.binance.us/api/v3/ticker/price'

/**
 * Maps primary_conversion_fiat codes to the Binance quote currency suffix.
 * Add entries here as new pricing currencies are needed.
 */
const PCF_TO_BINANCE_QUOTE: Record<string, string> = {
  USD: 'USDT',
  TRY: 'TRY',
  EUR: 'EUR',
}

export interface CryptoFetchResult {
  /** Binance trading pair used in the request (e.g. "BTCUSDT") */
  binancePair: string
  /** Price in the quote currency of the pair */
  price: number
  source: 'binance'
}

/**
 * Fetch the current price for a cryptocurrency symbol from Binance.US.
 *
 * @param assetCode             The asset identifier (e.g. "BTC", "PAXG")
 * @param primaryConversionFiat The pricing fiat currency (e.g. "USD") — determines Binance quote suffix
 */
export async function fetchCryptoPrice(
  assetCode: string,
  primaryConversionFiat: string
): Promise<CryptoFetchResult> {
  const quoteSuffix = PCF_TO_BINANCE_QUOTE[primaryConversionFiat.toUpperCase()]
  if (!quoteSuffix) {
    throw new Error(
      `No Binance quote suffix defined for primary_conversion_fiat="${primaryConversionFiat}"`
    )
  }
  const formattedPair = (assetCode.replace(/[_\s]/g, '').toUpperCase()) + quoteSuffix
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
