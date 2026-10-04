import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'

// 이 테스트의 초점은 /today 가 회원 id 를 URL 이 아니라 인증 스토어에서 받아 넘기는가와,
// 그 회원이 바뀌면 타이머 화면을 새로 여는가다. TodayView 자체는 TodayView.test.tsx 가 본다.
const mounts: number[] = []
vi.mock('@/views/TodayView', () => ({
  default: function FakeTodayView({ memberId }: { memberId: number }) {
    // 마운트 횟수를 센다 — memberId 를 deps 에 넣으면 같은 인스턴스의 prop 변경도 세어 버린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { mounts.push(memberId) }, [])
    return <div data-testid="today">{memberId}</div>
  },
}))

import { useAuthStore } from '@/store/authStore'
import Page from './page'

beforeEach(() => {
  mounts.length = 0
  useAuthStore.setState({ accessToken: null, memberId: null, lastAuthOkAt: null })
})

afterEach(() => cleanup())

describe('/today — 회원 id 가 없는 타이머 화면(앱 시작 화면)', () => {
  it('인증 스토어의 회원으로 타이머 화면을 연다', () => {
    useAuthStore.setState({ memberId: 7 })

    render(<Page />)

    expect(screen.getByTestId('today').textContent).toBe('7')
  })

  it('[회귀] 복원된 회원이 캐시와 다르면 이전 회원의 상태를 버리고 새로 연다', () => {
    // 쿠키가 다른 회원의 것이면 refresh 가 memberId 를 바꾼다. 같은 인스턴스를 재사용하면
    // 이전 회원 기준으로 이미 불러온 태그·타이머가 화면에 남는다.
    useAuthStore.setState({ memberId: 7 })
    render(<Page />)

    act(() => useAuthStore.setState({ memberId: 9 }))

    expect(screen.getByTestId('today').textContent).toBe('9')
    expect(mounts).toEqual([7, 9])
  })

  it('회원이 없으면 아무것도 그리지 않는다(보호 레이아웃이 로그인으로 보낸다)', () => {
    render(<Page />)

    expect(screen.queryByTestId('today')).toBeNull()
  })
})
