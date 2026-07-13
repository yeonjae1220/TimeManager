'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { THEME_STORAGE_KEY } from '@/utils/theme'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ThemeMode = 'light' | 'dark'

const THEME_QUERY = '(prefers-color-scheme: dark)'
const DEFAULT_PREFERENCE: ThemePreference = 'dark'

type ThemeContextValue = {
  preference: ThemePreference
  resolvedTheme: ThemeMode
  setPreference: (preference: ThemePreference) => void
  // 하위호환: 기존 소비처가 theme/setTheme(2-way)를 사용한다.
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// 저장된 선호가 없거나 무효하면 dark 기본. 'system'은 사용자가 명시적으로 고를 때만.
function normalizePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_PREFERENCE
}

function systemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia(THEME_QUERY).matches ? 'dark' : 'light'
}

function resolve(preference: ThemePreference, sys: ThemeMode = systemTheme()): ThemeMode {
  return preference === 'system' ? sys : preference
}

function applyTheme(resolved: ThemeMode) {
  const root = document.documentElement
  root.classList.add('theme-transition')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  window.setTimeout(() => root.classList.remove('theme-transition'), 240)
}

function getInitialPreference(): ThemePreference {
  if (typeof document === 'undefined') return DEFAULT_PREFERENCE
  return normalizePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
}

function getInitialResolved(): ThemeMode {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ThemeMode>(getInitialResolved)
  const preferenceRef = useRef<ThemePreference>(preference)

  // system 선호일 때 OS 테마 변경을 실시간 반영
  useEffect(() => {
    const media = window.matchMedia(THEME_QUERY)
    const onChange = (e: MediaQueryListEvent) => {
      if (preferenceRef.current !== 'system') return
      const next: ThemeMode = e.matches ? 'dark' : 'light'
      setResolvedTheme(next)
      applyTheme(next)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    preferenceRef.current = next
    setPreferenceState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // 스토리지 불가 시에도 세션 내 변경은 유지
    }
    const resolved = resolve(next)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
      theme: resolvedTheme,
      setTheme: (t: ThemeMode) => setPreference(t),
    }),
    [preference, resolvedTheme, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
