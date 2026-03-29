/**
 * gold.ts — Turkish physical gold price fetcher
 *
 * Source: CollectAPI Economy — goldPrice endpoint
 *   - URL: https://api.collectapi.com/economy/goldPrice
 *   - Method: GET
 *   - Auth header: "authorization: apikey {COLLECTAPI_KEY}"
 *   - API key: process.env.COLLECTAPI_KEY
 *   - Response: { success: boolean, result: [{ name: string, buying: number, selling: number }] }
 *
 * Supported variants (matched by the "name" field in the API response):
 *   ALTIN_GRAM    → "Gram Altın"    (gram gold)
 *   ALTIN_CEYREK  → "Çeyrek Altın"  (quarter gold coin)
 *   ALTIN_YARIM   → "Yarım Altın"   (half gold coin)
 *   ALTIN_TAM     → "Tam Altın"     (full gold coin)
 *
 * Price selection: use the lower of buying/selling (best available market price).
 * All prices are in TRY.
 *
 * fetch_config shape for physical_commodity gold symbols:
 *   { "collectApiName": "Gram Altın" }  — exact name as it appears in the API response
 */

const COLLECTAPI_URL = 'https://api.collectapi.com/economy/goldPrice'

/** Maps our symbol codes to the CollectAPI response name field */
export const GOLD_SYMBOL_NAMES: Record<string, string> = {
  ALTIN_GRAM: 'Gram Altın',
  ALTIN_CEYREK: 'Çeyrek Altın',
  ALTIN_YARIM: 'Yarım Altın',
  ALTIN_TAM: 'Tam Altın',
}

export interface GoldFetchResult {
  /** Our symbol code (e.g. "ALTIN_GRAM") */
  symbolCode: string
  /** Price in TRY */
  price: number
  source: 'collectapi'
}

interface CollectApiGoldItem {
  name: string
  buying: number | string | null
  selling: number | string | null
}

function bestPrice(item: CollectApiGoldItem): number {
  const buy =
    item.buying != null
      ? parseFloat(String(item.buying).replace(',', '.'))
      : NaN
  const sell =
    item.selling != null
      ? parseFloat(String(item.selling).replace(',', '.'))
      : NaN

  if (isNaN(sell) || sell <= 0) return buy
  if (isNaN(buy) || buy <= 0) return sell
  return Math.min(buy, sell)
}

/**
 * Fetch TRY prices for all four Turkish gold variants in a single API call.
 * Returns only the variants found in the response.
 */
export async function fetchGoldPrices(
  symbolCodes: string[]
): Promise<GoldFetchResult[]> {
  const apiKey = process.env.COLLECTAPI_KEY
  if (!apiKey) throw new Error('COLLECTAPI_KEY not set')

  const res = await fetch(COLLECTAPI_URL, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      authorization: `apikey ${apiKey}`,
    },
  })

  if (!res.ok) throw new Error(`CollectAPI HTTP ${res.status}`)

  const json = (await res.json()) as {
    success: boolean
    result: CollectApiGoldItem[]
  }

  if (!json.success) {
    throw new Error('CollectAPI goldPrice: success=false in response')
  }

  const results: GoldFetchResult[] = []

  for (const code of symbolCodes) {
    const apiName = GOLD_SYMBOL_NAMES[code]
    if (!apiName) continue // unknown code — skip

    const item = json.result.find((r) => r.name === apiName)
    if (!item) {
      throw new Error(`CollectAPI: "${apiName}" not found in response`)
    }

    const price = bestPrice(item)
    if (isNaN(price) || price <= 0) {
      throw new Error(`CollectAPI: invalid price for ${code} (${apiName}): ${JSON.stringify(item)}`)
    }

    results.push({ symbolCode: code, price, source: 'collectapi' })
  }

  return results
}
