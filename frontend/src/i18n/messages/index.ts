// 결정 배경: docs/adr/0001-i18n-custom-vs-library.md
export { default as en } from './en'
export type { MessageKey, Messages } from './en'

import en from './en'
import ko from './ko'
import ja from './ja'
import zh from './zh'
import es from './es'
import fr from './fr'
import de from './de'
import pt from './pt'
import ru from './ru'
import type { Messages } from './en'

export const SUPPORTED_UI_LANGUAGES = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru'] as const
export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number]

export const FALLBACK_LANG: UiLanguage = 'en'

// localStorage 키이자 쿠키 이름. 서버(layout)와 클라(I18nProvider)가 공유해야
// SSR/hydration 언어가 일치한다.
export const LANG_KEY = 'tm_lang'

export const LANGUAGE_LABELS: Record<UiLanguage, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ru: 'Русский',
}

// 입력 문자열(navigator.language, 쿠키 등)을 지원 언어로 정규화.
// 2자 슬라이스로 처리 — zh-TW/zh-CN 모두 zh로 매핑됨(현재 단일 zh 딕셔너리).
// 미지원 입력은 FALLBACK_LANG('en')으로 폴백.
export function resolveUiLang(input: string | null | undefined): UiLanguage {
  if (!input) return FALLBACK_LANG
  const code = input.slice(0, 2).toLowerCase()
  return (SUPPORTED_UI_LANGUAGES as readonly string[]).includes(code)
    ? (code as UiLanguage)
    : FALLBACK_LANG
}

export const messages: Record<UiLanguage, Messages> = { en, ko, ja, zh, es, fr, de, pt, ru }
