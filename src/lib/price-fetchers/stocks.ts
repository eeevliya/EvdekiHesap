/**
 * stocks.ts — BIST stock price fetcher
 *
 * Source: yahoo-finance2 npm package
 *   - Covers all BIST-listed stocks via the ".IS" suffix (e.g. "THYAO.IS", "XU100.IS")
 *   - Prices returned in TRY by Yahoo Finance
 *   - No API key required
 *
 * fetch_config shape for stock symbols:
 *   { "yahooTicker": "THYAO.IS" }  — Yahoo Finance ticker (must include ".IS" suffix for BIST)
 */

import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

export interface StockFetchResult {
  /** Yahoo Finance ticker (e.g. "THYAO.IS") */
  yahooTicker: string
  /** Market price in the instrument's currency (TRY for BIST stocks) */
  price: number
  source: 'yahoo_finance'
}

/** Fetch the current market price for a single Yahoo Finance ticker. */
export async function fetchStockPrice(
  yahooTicker: string
): Promise<StockFetchResult> {
  const quote = await yahooFinance.quote(yahooTicker)

  const price = quote.regularMarketPrice
  if (price == null || price <= 0) {
    throw new Error(
      `yahoo-finance2: no valid price for ${yahooTicker} (got ${price})`
    )
  }

  return { yahooTicker, price, source: 'yahoo_finance' }
}
