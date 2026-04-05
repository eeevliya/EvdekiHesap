import { redirect } from 'next/navigation'

// Route moved to /rates/symbols per UI_PLAN.md §4.1
export default function SymbolsSettingsRedirect() {
  redirect('/rates/symbols')
}
