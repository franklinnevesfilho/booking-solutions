import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <NextTopLoader color="#15803d" showSpinner={false} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
