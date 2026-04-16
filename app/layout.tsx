import type { Metadata, Viewport } from 'next'
import NextTopLoader from 'nextjs-toploader'

import './globals.css'

export const metadata: Metadata = {
  title: 'CleanSchedule',
  description: 'Scheduling system for cleaning businesses.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <NextTopLoader color="#15803d" showSpinner={false} />
        {children}
      </body>
    </html>
  )
}
