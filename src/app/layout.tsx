import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EvdekiHesap',
  description: 'Household investment portfolio tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
