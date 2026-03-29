'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { runPriceFetch } from '@/lib/price-fetchers/index'
import type { ActionResult } from '@/lib/types/domain'

interface PriceFetchSummary {
  total: number
  success: number
  error: number
  skipped: number
}

/** Manual "Refresh Now" trigger. Any authenticated household member can call this. */
export async function triggerPriceFetch(): Promise<ActionResult<PriceFetchSummary>> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    const results = await runPriceFetch()

    const summary: PriceFetchSummary = {
      total: results.length,
      success: results.filter((r) => r.status === 'success').length,
      error: results.filter((r) => r.status === 'error').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
    }

    revalidatePath('/settings/price-status')
    return { success: true, data: summary }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
