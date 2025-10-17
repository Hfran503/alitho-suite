import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Calitho Suite',
  description: 'Calitho Suite - Enterprise Business Management Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
