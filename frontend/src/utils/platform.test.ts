import { afterEach, describe, expect, it, vi } from 'vitest'

import { isStandaloneDisplay } from './platform'

type StandaloneNavigator = Navigator & { standalone?: boolean }

function setNavigatorStandalone(value: boolean | undefined) {
  Object.defineProperty(navigator as StandaloneNavigator, 'standalone', {
    configurable: true,
    get: () => value,
  })
}

function stubDisplayMode(standalone: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
  })))
}

describe('isStandaloneDisplay', () => {
  afterEach(() => {
    setNavigatorStandalone(undefined)
    vi.unstubAllGlobals()
  })

  it('iOS 홈 화면 PWA(navigator.standalone)는 설치형이다 — iOS 는 display-mode 를 보고하지 않는 버전이 있다', () => {
    setNavigatorStandalone(true)
    stubDisplayMode(false)
    expect(isStandaloneDisplay()).toBe(true)
  })

  it('display-mode: standalone 이면 설치형이다(Android·데스크톱 PWA)', () => {
    stubDisplayMode(true)
    expect(isStandaloneDisplay()).toBe(true)
  })

  it('일반 브라우저 탭은 설치형이 아니다', () => {
    setNavigatorStandalone(false)
    stubDisplayMode(false)
    expect(isStandaloneDisplay()).toBe(false)
  })

  it('matchMedia 가 없는 환경에서도 던지지 않고 설치형이 아니라고 본다', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(isStandaloneDisplay()).toBe(false)
  })
})
