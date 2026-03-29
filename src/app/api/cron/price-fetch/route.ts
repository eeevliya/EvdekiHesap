/**
 * /api/cron/price-fetch — Price fetch cron Route Handler
 *
 * Schedule (vercel.json): every 15 min, Mon–Fri 06:00–15:00 UTC (09:00–18:00 Istanbul)
 * Crypto runs unconditionally (24/7); weekday restriction applies only via the cron schedule.
 *
 * Security: expects the Vercel-injected Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 * When CRON_SECRET is not set (local development), the check is skipped with a warning.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runPriceFetch } from '@/lib/price-fetchers/index'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[price-fetch] CRON_SECRET not set — skipping auth check (dev mode)')
  }

  try {
    const results = await runPriceFetch()

    const summary = {
      total: results.length,
      success: results.filter((r) => r.status === 'success').length,
      error: results.filter((r) => r.status === 'error').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
    }

    console.log('[price-fetch] completed', summary)
    return NextResponse.json({ ok: true, summary, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[price-fetch] fatal error', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
