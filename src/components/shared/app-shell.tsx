import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { TopHeader } from './top-header'

interface AppShellProps {
  children: React.ReactNode
  /** Current page title — shown in the mobile top header */
  title: string
  /** Display name of the logged-in user — shown in the desktop sidebar footer */
  displayName: string
}

export function AppShell({ children, title, displayName }: AppShellProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      {/* Desktop sidebar */}
      <Sidebar displayName={displayName} />

      {/* Mobile top header */}
      <TopHeader title={title} />

      {/* Main content */}
      <main className="md:ml-[220px] px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
