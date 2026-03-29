/**
 * index.ts — Price fetcher dispatcher
 *
 * Iterates all active symbols (global and household-specific), routes each to
 * the appropriate fetcher by symbol type, writes results to `exchange_rates`,
 * and logs each attempt in `price_fetch_log`.
 *
 * Uses the service-role client so it can write to both tables (which have no
 * authenticated-user INSERT policy — only the service role may write).
 *
 * Dispatch rules by symbol type:
 *   fiat_currency      → fiat.ts  (TCMB EVDS + Frankfurter fallback)
 *   tefas_fund         → tefas.ts (TEFAS unofficial API, one call per fund)
 *   stock              → stocks.ts (yahoo-finance2, one call per ticker)
 *   cryptocurrency     → crypto.ts (Binance.US public REST, one call per pair)
 *   physical_commodity → gold.ts  (CollectAPI, batched — all gold variants in one call)
 *   custom             → skipped (no automated fetch)
 *
 * Market-hours gating (Istanbul time = UTC+3, no DST):
 *   fiat_currency: weekdays only
 *   tefas_fund:    weekdays, 10:00–17:00 Istanbul
 *   stock:         no restriction
 *   cryptocurrency: no restriction
 *   physical_commodity: no restriction
 *
 * CollectAPI rate limit: max 3 successful calls per calendar day (Istanbul time).
 * Checked via price_fetch_log before each gold batch. See goldDailyLimitReached().
 *
 * COLLECTAPI_ENABLED: set to false to skip all gold fetches without calling the API.
 * Set to false in .env.local while the Google Sheets integration is still active
 * (to avoid consuming the 100 req/month free-plan quota). Set to true in Vercel
 * once the Google Sheets integration is decommissioned.
 *
 * Fallback policy: on fetch error, log the error and retain the most recent
 * exchange_rates row (do not insert a new row). The next successful fetch
 * will insert a new row.
 */

import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchFiatRates } from './fiat'
import { fetchTefasPrice } from './tefas'
import { fetchStockPrice } from './stocks'
import { fetchCryptoPrice } from './crypto'
import { fetchGoldPrices, GOLD_SYMBOL_NAMES } from './gold'

interface Symbol {
  id: string
  code: string
  type: string
  household_id: string | null
  is_active: boolean
  fetch_config: Record<string, unknown> | null
}

interface DispatchResult {
  symbolId: string
  symbolCode: string
  status: 'success' | 'error' | 'skipped'
  message?: string
}

// ── Istanbul time helpers ─────────────────────────────────────────────────────

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC+3, no DST

interface IstanbulTime {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number
  hour: number
  minute: number
}

function getIstanbulTime(): IstanbulTime {
  const nowMs = Date.now()
  const shifted = new Date(nowMs + ISTANBUL_OFFSET_MS)
  return {
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

/** Returns the UTC Date corresponding to 00:00:00 today in Istanbul time. */
function istanbulStartOfDay(): Date {
  const nowMs = Date.now()
  const shifted = new Date(nowMs + ISTANBUL_OFFSET_MS)
  // Strip the time-of-day portion in the shifted (Istanbul) clock
  const midnightShiftedMs =
    nowMs +
    ISTANBUL_OFFSET_MS -
    (shifted.getUTCHours() * 3600000 +
      shifted.getUTCMinutes() * 60000 +
      shifted.getUTCSeconds() * 1000 +
      shifted.getUTCMilliseconds())
  // Convert back to UTC
  return new Date(midnightShiftedMs - ISTANBUL_OFFSET_MS)
}

/**
 * Returns true if the current Istanbul time is within the valid fetch window
 * for the given symbol type.
 */
function isWithinWindow(type: string): boolean {
  const { weekday, hour } = getIstanbulTime()
  const isWeekday = weekday >= 1 && weekday <= 5

  switch (type) {
    case 'fiat_currency':
      return isWeekday
    case 'tefas_fund':
      return isWeekday && hour >= 10 && hour < 17
    default:
      // stock, cryptocurrency, physical_commodity: no restriction
      return true
  }
}

// ── DB write helpers ──────────────────────────────────────────────────────────

/** Write one exchange_rate row and one price_fetch_log row for a successful fetch. */
async function writeSuccess(
  supabase: ReturnType<typeof createServiceRoleClient>,
  symbol: Symbol,
  rate: number,
  source: string
): Promise<void> {
  const { error } = await supabase.from('exchange_rates').insert({
    symbol_id: symbol.id,
    household_id: symbol.household_id,
    rate,
    source,
  })
  if (error) throw new Error(`exchange_rates insert: ${error.message}`)

  await supabase.from('price_fetch_log').insert({
    symbol_id: symbol.id,
    household_id: symbol.household_id,
    status: 'success',
    message: `rate=${rate} source=${source}`,
  })
}

/** Write a price_fetch_log error row (no exchange_rates row — retain last successful rate). */
async function writeError(
  supabase: ReturnType<typeof createServiceRoleClient>,
  symbol: Symbol,
  message: string
): Promise<void> {
  await supabase.from('price_fetch_log').insert({
    symbol_id: symbol.id,
    household_id: symbol.household_id,
    status: 'error',
    message,
  })
}

/** Write a price_fetch_log skipped row. */
async function writeSkipped(
  supabase: ReturnType<typeof createServiceRoleClient>,
  symbol: Symbol,
  message: string
): Promise<void> {
  await supabase.from('price_fetch_log').insert({
    symbol_id: symbol.id,
    household_id: symbol.household_id,
    status: 'skipped',
    message,
  })
}

// ── CollectAPI rate-limit check ───────────────────────────────────────────────

/**
 * Returns true if CollectAPI has already been called 3 or more times today
 * (Istanbul calendar day). Uses ALTIN_GRAM as the sentinel: one success log
 * entry for ALTIN_GRAM = one CollectAPI call, because all gold variants are
 * fetched in a single batched request.
 *
 * Falls back to any other gold symbol if ALTIN_GRAM is not in the active list.
 */
async function goldDailyLimitReached(
  supabase: ReturnType<typeof createServiceRoleClient>,
  goldSymbols: Symbol[]
): Promise<boolean> {
  const sentinel =
    goldSymbols.find((s) => s.code === 'ALTIN_GRAM') ?? goldSymbols[0]
  if (!sentinel) return false

  const dayStart = istanbulStartOfDay()

  const { count, error } = await supabase
    .from('price_fetch_log')
    .select('id', { count: 'exact', head: true })
    .eq('symbol_id', sentinel.id)
    .eq('status', 'success')
    .gte('fetched_at', dayStart.toISOString())

  if (error) {
    console.warn('[price-fetch] goldDailyLimitReached query error:', error.message)
    return false // fail open: let the call through rather than silently blocking
  }

  return (count ?? 0) >= 3
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Run price fetching for all active symbols.
 *
 * @param cryptoOnly  When true, only cryptocurrency symbols are fetched.
 *                    Used by the cron job for the unconditional 24/7 crypto pass.
 */
export async function runPriceFetch(cryptoOnly = false): Promise<DispatchResult[]> {
  const supabase = createServiceRoleClient()
  const results: DispatchResult[] = []

  // Load all active symbols
  const { data: symbols, error: symErr } = await supabase
    .from('symbols')
    .select('id, code, type, household_id, is_active, fetch_config')
    .eq('is_active', true)

  if (symErr) throw new Error(`Failed to load symbols: ${symErr.message}`)
  if (!symbols || symbols.length === 0) return results

  const active = symbols as Symbol[]

  // ── fiat_currency ──────────────────────────────────────────────────────────
  if (!cryptoOnly) {
    const fiatSymbols = active.filter((s) => s.type === 'fiat_currency')
    if (fiatSymbols.length > 0) {
      if (!isWithinWindow('fiat_currency')) {
        for (const sym of fiatSymbols) {
          await writeSkipped(supabase, sym, 'Outside market hours')
          results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'Outside market hours' })
        }
      } else {
        try {
          const fiatResults = await fetchFiatRates(fiatSymbols.map((s) => s.code))
          const rateByCode = new Map(fiatResults.map((r) => [r.code, r]))

          for (const sym of fiatSymbols) {
            const fetched = rateByCode.get(sym.code)
            if (fetched) {
              await writeSuccess(supabase, sym, fetched.rate, fetched.source)
              results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'success' })
            } else {
              await writeSkipped(supabase, sym, 'No rate returned for this code')
              results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'No rate returned' })
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          for (const sym of fiatSymbols) {
            await writeError(supabase, sym, msg)
            results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'error', message: msg })
          }
        }
      }
    }
  }

  // ── tefas_fund ─────────────────────────────────────────────────────────────
  if (!cryptoOnly) {
    const tefasSymbols = active.filter((s) => s.type === 'tefas_fund')
    for (const sym of tefasSymbols) {
      const tefasCode = sym.fetch_config?.tefasCode as string | undefined
      if (!tefasCode) {
        await writeSkipped(supabase, sym, 'fetch_config.tefasCode not set')
        results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'tefasCode not set' })
        continue
      }
      if (!isWithinWindow('tefas_fund')) {
        await writeSkipped(supabase, sym, 'Outside market hours')
        results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'Outside market hours' })
        continue
      }
      try {
        const result = await fetchTefasPrice(tefasCode)
        await writeSuccess(supabase, sym, result.price, result.source)
        results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'success' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await writeError(supabase, sym, msg)
        results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'error', message: msg })
      }
    }
  }

  // ── stock — no market-hours restriction ───────────────────────────────────
  if (!cryptoOnly) {
    const stockSymbols = active.filter((s) => s.type === 'stock')
    for (const sym of stockSymbols) {
      const yahooTicker = sym.fetch_config?.yahooTicker as string | undefined
      if (!yahooTicker) {
        await writeSkipped(supabase, sym, 'fetch_config.yahooTicker not set')
        results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'yahooTicker not set' })
        continue
      }
      try {
        const result = await fetchStockPrice(yahooTicker)
        await writeSuccess(supabase, sym, result.price, result.source)
        results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'success' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await writeError(supabase, sym, msg)
        results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'error', message: msg })
      }
    }
  }

  // ── cryptocurrency — always runs (24/7) ───────────────────────────────────
  const cryptoSymbols = active.filter((s) => s.type === 'cryptocurrency')
  for (const sym of cryptoSymbols) {
    const binancePair = sym.fetch_config?.binancePair as string | undefined
    if (!binancePair) {
      await writeSkipped(supabase, sym, 'fetch_config.binancePair not set')
      results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'binancePair not set' })
      continue
    }
    try {
      const result = await fetchCryptoPrice(binancePair)
      await writeSuccess(supabase, sym, result.price, result.source)
      results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await writeError(supabase, sym, msg)
      results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'error', message: msg })
    }
  }

  // ── physical_commodity (gold) — batched, rate-limited ─────────────────────
  if (!cryptoOnly) {
    const goldCodes = Object.keys(GOLD_SYMBOL_NAMES)
    const goldSymbols = active.filter(
      (s) => s.type === 'physical_commodity' && goldCodes.includes(s.code)
    )

    if (goldSymbols.length > 0) {
      // COLLECTAPI_ENABLED=false: skip without calling the API.
      // Set to false in .env.local while the Google Sheets integration is still
      // active to avoid consuming the 100 req/month free-plan quota.
      // Set to true in Vercel once the Google Sheets integration is decommissioned.
      const collectApiEnabled = process.env.COLLECTAPI_ENABLED !== 'false'

      if (!collectApiEnabled) {
        for (const sym of goldSymbols) {
          await writeSkipped(supabase, sym, 'CollectAPI disabled')
          results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'CollectAPI disabled' })
        }
      } else if (await goldDailyLimitReached(supabase, goldSymbols)) {
        for (const sym of goldSymbols) {
          await writeSkipped(supabase, sym, 'Daily CollectAPI limit reached (3/day)')
          results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'Daily CollectAPI limit reached (3/day)' })
        }
      } else {
        try {
          const goldResults = await fetchGoldPrices(goldSymbols.map((s) => s.code))
          const priceByCode = new Map(goldResults.map((r) => [r.symbolCode, r]))

          for (const sym of goldSymbols) {
            const fetched = priceByCode.get(sym.code)
            if (fetched) {
              await writeSuccess(supabase, sym, fetched.price, fetched.source)
              results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'success' })
            } else {
              await writeSkipped(supabase, sym, 'Not returned by CollectAPI')
              results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'Not in API response' })
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          for (const sym of goldSymbols) {
            await writeError(supabase, sym, msg)
            results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'error', message: msg })
          }
        }
      }
    }

    // Other physical_commodity symbols (e.g. XAU, XAG) not handled yet — skip
    const otherCommodities = active.filter(
      (s) => s.type === 'physical_commodity' && !goldCodes.includes(s.code)
    )
    for (const sym of otherCommodities) {
      await writeSkipped(supabase, sym, 'No fetcher configured for this commodity')
      results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'No fetcher' })
    }
  }

  // ── custom — always skipped ────────────────────────────────────────────────
  if (!cryptoOnly) {
    const customSymbols = active.filter((s) => s.type === 'custom')
    for (const sym of customSymbols) {
      await writeSkipped(supabase, sym, 'Custom symbols have no automated fetcher')
      results.push({ symbolId: sym.id, symbolCode: sym.code, status: 'skipped', message: 'Custom symbol' })
    }
  }

  return results
}
