'use client'

import { I18nProvider } from '@/i18n/I18nProvider'
import type { UiLanguage } from '@/i18n/messages/index'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { NativeShell } from '@/components/NativeShell'
import { ConnectivityWatcher } from '@/components/ConnectivityWatcher'

export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode
  initialLanguage: UiLanguage
}) {
  return (
    <ThemeProvider>
      <I18nProvider initialLanguage={initialLanguage}>
        {children}
        <NativeShell />
        <ConnectivityWatcher />
      </I18nProvider>
    </ThemeProvider>
  )
}
