'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { messages, resolveUiLang, FALLBACK_LANG, LANG_KEY } from './messages/index'
import type { MessageKey, UiLanguage } from './messages/index'

// HttpOnly를 의도적으로 생략 — 이 함수가 document.cookie로 직접 쓰며,
// layout.tsx의 서버 컴포넌트도 같은 키를 읽어 <html lang>을 SSR에서 결정한다.
function readLangCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${LANG_KEY}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

function writeLangCookie(lang: string): void {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${LANG_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax${secure}`
}

type I18nContextValue = {
  language: UiLanguage
  setLanguage: (lang: string) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode
  initialLanguage: UiLanguage
}) {
  // 서버에서 쿠키로 결정한 언어를 그대로 초기값으로 사용 → SSR/hydration 첫 렌더 일치.
  // (서버는 document가 없어 쿠키를 못 읽으므로, props로 받아야 mismatch가 없다)
  const [language, setLanguageState] = useState<UiLanguage>(initialLanguage)

  // mount 후 보정: 명시적 선호(localStorage·cookie)가 있으면 그걸, 없으면 브라우저 기본.
  // 쿠키 기반 initialLanguage를 navigator로 덮어쓰지 않도록 우선순위를 둔다.
  useEffect(() => {
    const stored = resolveUiLang(localStorage.getItem(LANG_KEY) ?? readLangCookie() ?? navigator.language)
    if (stored !== language) setLanguageState(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 접근성: <html lang> 동기화
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage: (next) => {
      const normalized = resolveUiLang(next)
      setLanguageState(normalized)
      try {
        localStorage.setItem(LANG_KEY, normalized)
      } catch {
        // localStorage 불가 시에도 세션 내 언어 변경은 유지
      }
      writeLangCookie(normalized)
    },
    // 현재 언어 → 폴백 언어 → 키 자체 순으로 폴백 (절대 빈 문자열 X)
    t: (key, vars) => {
      const raw = messages[language][key] ?? messages[FALLBACK_LANG][key] ?? key
      if (!vars) return raw
      return Object.entries(vars).reduce<string>(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        raw,
      )
    },
  }), [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}
