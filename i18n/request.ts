import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED_LOCALES = ['en', 'es', 'pt-BR'] as const
type Locale = (typeof SUPPORTED_LOCALES)[number]

function isValidLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('APP_LOCALE')?.value ?? ''
  const locale: Locale = isValidLocale(raw) ? raw : 'en'

  const messages =
    locale === 'es'
      ? (await import('../messages/es.json')).default
      : locale === 'pt-BR'
        ? (await import('../messages/pt-BR.json')).default
        : (await import('../messages/en.json')).default

  return { locale, messages }
})
