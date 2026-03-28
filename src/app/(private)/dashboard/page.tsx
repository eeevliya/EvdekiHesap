import { createServerClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Çıkış yap
            </Button>
          </form>
        </div>
        <p className="text-muted-foreground">
          Giriş yapıldı: <span className="font-mono text-sm">{user?.email}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          Dashboard — Slice 2+ ile doldurulacak.
        </p>
      </div>
    </div>
  )
}
