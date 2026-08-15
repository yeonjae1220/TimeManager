import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import ErrorBoundaryFallback from './error'

// app/error.tsx 는 Next.js 가 렌더 예외를 잡았을 때 그 세그먼트 자리에 끼워넣는
// 폴백 UI다. Next 자체에도 내장 전역 폴백이 있어서 이 파일이 없어도 빈 화면이
// 되지는 않지만, 그 기본 화면은 앱 UI 전체를 영어 기술 문구로 갈아끼우고
// 복구 수단이 새로고침뿐이다. 그래서 이 폴백이 지켜야 할 계약은 셋이다:
//   ① 사용자 언어로 무슨 일이 났는지 알린다
//   ② reset() 으로 다시 시도할 수 있다
//   ③ 원인을 조용히 삼키지 않는다 (console.error)

function renderFallback(error: Error & { digest?: string }, reset = vi.fn()) {
  render(
    <I18nProvider initialLanguage="ko">
      <ErrorBoundaryFallback error={error} reset={reset} />
    </I18nProvider>,
  )
  return reset
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  // I18nProvider 는 mount 후 localStorage → 쿠키 → navigator.language 순으로 언어를
  // 재확정한다. jsdom 의 navigator.language 는 en-US 라, 명시하지 않으면 한국어
  // 검증이 조용히 영어로 통과해버린다.
  localStorage.setItem(LANG_KEY, 'ko')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('app/error.tsx — 루트 에러 바운더리 폴백', () => {
  it('사용자 언어로 오류를 알린다', () => {
    renderFallback(new Error('boom'))
    expect(screen.getByText('문제가 발생했습니다.')).toBeTruthy()
  })

  it('[회귀] 번역 키가 원문 그대로 새어나오지 않는다', () => {
    // t() 는 키가 없으면 키 문자열 자체를 반환한다. 카탈로그에 키를 빠뜨리면
    // 화면에 'error.unexpected' 가 그대로 찍히는데, 위 테스트는 언어만 맞으면
    // 통과하므로 이 검사가 따로 필요하다.
    renderFallback(new Error('boom'))
    expect(screen.queryByText('error.unexpected')).toBeNull()
    expect(screen.queryByText('common.retry')).toBeNull()
  })

  it('재시도 버튼이 reset() 을 호출한다', () => {
    const reset = renderFallback(new Error('boom'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('[회귀] 오류를 조용히 삼키지 않고 console.error 로 남긴다', () => {
    renderFallback(new Error('boom'))
    const logged = consoleError.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('boom')
  })

  it('digest 가 있으면 화면에 노출한다 — 서버 로그와 잇는 유일한 키다', () => {
    const err = Object.assign(new Error('boom'), { digest: 'abc123def' })
    renderFallback(err)
    expect(screen.getByText('abc123def')).toBeTruthy()
  })

  it('digest 가 없으면 빈 코드 블록을 만들지 않는다', () => {
    const { container } = render(
      <I18nProvider initialLanguage="ko">
        <ErrorBoundaryFallback error={new Error('boom')} reset={vi.fn()} />
      </I18nProvider>,
    )
    expect(container.querySelector('code')).toBeNull()
  })

  it('스크린리더가 즉시 읽도록 alert role 을 갖는다', () => {
    renderFallback(new Error('boom'))
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
