import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'

import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
})

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
    <html lang="en" className={nunito.variable}>
      <body className="font-sans antialiased">
        <NextTopLoader color="#15803d" showSpinner={false} />
        {children}
      </body>
    </html>
  )
}
