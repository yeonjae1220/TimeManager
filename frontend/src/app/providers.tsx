'use client'

import { I18nProvider } from '@/i18n/I18nProvider'
import type { UiLanguage } from '@/i18n/messages/index'

export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode
  initialLanguage: UiLanguage
}) {
  return <I18nProvider initialLanguage={initialLanguage}>{children}</I18nProvider>
}
