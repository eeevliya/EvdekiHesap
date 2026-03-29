import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PriceStatusWidget from '@/components/settings/price-status-widget'

export default async function PriceStatusPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Load active symbols — primary_conversion_fiat needed for rate derivation
  const { data: symbols } = await supabase
    .from('symbols')
    .select('id, code, name, type, is_active, primary_conversion_fiat')
    .eq('is_active', true)
    .order('type')
    .order('code')

  // Latest rate per symbol (ordered desc so first occurrence per symbol_id is most recent)
  const { data: latestRates } = await supabase
    .from('exchange_rates')
    .select('symbol_id, rate, fetched_at, source')
    .order('fetched_at', { ascending: false })

  // Latest log entry per symbol (most recent status)
  const { data: latestLogs } = await supabase
    .from('price_fetch_log')
    .select('symbol_id, status, message, fetched_at')
    .order('fetched_at', { ascending: false })

  // Deduplicate: keep only the most recent rate/log per symbol
  const rateBySymbol = new Map<string, { rate: number; fetched_at: string; source: string | null }>()
  for (const row of latestRates ?? []) {
    if (!rateBySymbol.has(row.symbol_id)) {
      rateBySymbol.set(row.symbol_id, {
        rate: row.rate,
        fetched_at: row.fetched_at,
        source: row.source,
      })
    }
  }

  const logBySymbol = new Map<string, { status: string; message: string | null; fetched_at: string }>()
  for (const row of latestLogs ?? []) {
    if (!logBySymbol.has(row.symbol_id)) {
      logBySymbol.set(row.symbol_id, {
        status: row.status,
        message: row.message,
        fetched_at: row.fetched_at,
      })
    }
  }

  // USD/TRY and EUR/TRY are needed to derive display-currency values for all symbols.
  // fiat symbols store TRY rates (convention: null primary_conversion_fiat = TRY).
  const usdSymbol = (symbols ?? []).find((s) => s.code === 'USD')
  const eurSymbol = (symbols ?? []).find((s) => s.code === 'EUR')
  const usdTryRate = usdSymbol ? (rateBySymbol.get(usdSymbol.id)?.rate ?? null) : null
  const eurTryRate = eurSymbol ? (rateBySymbol.get(eurSymbol.id)?.rate ?? null) : null

  const rows = (symbols ?? []).map((sym) => ({
    id: sym.id as string,
    code: sym.code as string,
    name: sym.name as string | null,
    type: sym.type as string,
    primaryConversionFiat: sym.primary_conversion_fiat as string | null,
    latestRate: rateBySymbol.get(sym.id) ?? null,
    lastLog: logBySymbol.get(sym.id) ?? null,
  }))

  return <PriceStatusWidget rows={rows} usdTryRate={usdTryRate} eurTryRate={eurTryRate} />
}
