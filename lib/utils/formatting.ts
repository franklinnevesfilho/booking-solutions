import type { Locale } from 'date-fns'
import { enUS, es, ptBR } from 'date-fns/locale'

export function getDateFnsLocale(locale: string): Locale {
  if (locale === 'es') return es
  if (locale === 'pt-BR') return ptBR
  return enUS
}

export function formatCurrency(value: number, locale: string): string {
  const intlLocale = locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-419' : 'en-US'
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
