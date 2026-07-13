'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/index'

const OPTIONS: { value: ThemePreference; key: MessageKey; Icon: typeof Monitor }[] = [
  { value: 'system', key: 'profile.system', Icon: Monitor },
  { value: 'light', key: 'profile.light', Icon: Sun },
  { value: 'dark', key: 'profile.dark', Icon: Moon },
]

/**
 * system/light/dark 3-way 토글. 저장된 선호가 없으면 dark가 기본이지만
 * 사용자는 언제든 system(OS 따름)·light로 바꿀 수 있다.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  const { t } = useI18n()

  return (
    <div
      role="radiogroup"
      aria-label={t('profile.themeAria')}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)',
      }}
    >
      {OPTIONS.map(({ value, key, Icon }) => {
        const selected = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={t(key)}
            onClick={() => setPreference(value)}
            style={{
              position: 'relative',
              width: 30,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid',
              borderColor: selected ? 'var(--accent)' : 'transparent',
              borderRadius: 'calc(var(--radius) - 2px)',
              background: selected ? 'var(--accent-bg)' : 'transparent',
              color: selected ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer',
            }}
          >
            <Icon size={14} aria-hidden />
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {t(key)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
