/**
 * /api/cron/snapshot — Snapshot cron Route Handler
 *
 * Schedule (vercel.json): 0 0,6,12,18 * * * (00:00, 06:00, 12:00, 18:00 UTC)
 * Iterates all households and creates a 'scheduled' snapshot for each.
 *
 * Security: expects the Vercel-injected Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 * When CRON_SECRET is not set (local development), the check is skipped with a warning.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createSnapshot } from '@/lib/actions/snapshots'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[snapshot] CRON_SECRET not set — skipping auth check (dev mode)')
  }

  try {
    const supabase = createServiceRoleClient()

    const { data: households, error } = await supabase
      .from('households')
      .select('id')

    if (error) throw new Error(`Failed to load households: ${error.message}`)

    const results: { householdId: string; status: 'success' | 'error'; message?: string }[] = []

    for (const household of households ?? []) {
      try {
        await createSnapshot(household.id, 'scheduled')
        results.push({ householdId: household.id, status: 'success' })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[snapshot] failed for household ${household.id}:`, message)
        results.push({ householdId: household.id, status: 'error', message })
      }
    }

    const summary = {
      total: results.length,
      success: results.filter((r) => r.status === 'success').length,
      error: results.filter((r) => r.status === 'error').length,
    }

    console.log('[snapshot] completed', summary)
    return NextResponse.json({ ok: true, summary, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snapshot] fatal error', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
