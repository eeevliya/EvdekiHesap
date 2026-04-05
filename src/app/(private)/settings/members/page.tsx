import { redirect } from 'next/navigation'

// Route consolidated into /household per UI_PLAN.md §4.1
export default function MembersSettingsRedirect() {
  redirect('/household')
}
