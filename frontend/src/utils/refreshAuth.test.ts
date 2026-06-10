import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  refreshAuth,
  classifyRefreshError,
  backoffDelay,
} from './refreshAuth'
import { useAuthStore } from '@/store/authStore'

// axios 에러 형태 헬퍼 — axios.isAxiosError는 isAxiosError===true 객체를 인식한다.
function axiosError(status?: number): unknown {
  return { isAxiosError: true, response: status === undefined ? undefined : { status } }
}

// 유효한 accessToken JWT는 아니어도 됨 — store는 payload 파싱 실패 시 role을 MEMBER로 둔다.
function okResponse(token = 'new.access.token', memberId = 7) {
  return { data: { accessToken: token, memberId } }
}

describe('classifyRefreshError', () => {
  it('400·401·403 및 기타 4xx는 unauthenticated', () => {
    expect(classifyRefreshError(axiosError(400))).toBe('unauthenticated')
    expect(classifyRefreshError(axiosError(401))).toBe('unauthenticated')
    expect(classifyRefreshError(axiosError(403))).toBe('unauthenticated')
    expect(classifyRefreshError(axiosError(404))).toBe('unauthenticated')
  })

  it('429는 rate-limited', () => {
    expect(classifyRefreshError(axiosError(429))).toBe('rate-limited')
  })

  it('408·5xx는 retryable', () => {
    expect(classifyRefreshError(axiosError(408))).toBe('retryable')
    expect(classifyRefreshError(axiosError(500))).toBe('retryable')
    expect(classifyRefreshError(axiosError(503))).toBe('retryable')
  })

  it('응답 없는 네트워크 에러는 retryable', () => {
    expect(classifyRefreshError(axiosError(undefined))).toBe('retryable')
  })

  it('비-axios 예외는 retryable', () => {
    expect(classifyRefreshError(new Error('boom'))).toBe('retryable')
  })
})

describe('backoffDelay', () => {
  it('지수 증가하되 상한(2000ms)을 넘지 않는다', () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const d = backoffDelay(attempt)
      expect(d).toBeGreaterThan(0)
      expect(d).toBeLessThanOrEqual(2000)
    }
  })
})

describe('refreshAuth', () => {
  beforeEach(() => {
    // 복원 가능한 세션 상태: memberId는 persist로 남아있다고 가정
    useAuthStore.setState({ accessToken: null, memberId: 7, role: null })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('성공 시 authenticated 반환 + store에 accessToken 설정', async () => {
    vi.spyOn(axios, 'post').mockResolvedValueOnce(okResponse('tok', 7))

    const result = await refreshAuth()

    expect(result).toEqual({ status: 'authenticated', token: 'tok' })
    expect(useAuthStore.getState().accessToken).toBe('tok')
  })

  it('401이면 unauthenticated + 세션 정리(재시도 없음)', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValueOnce(axiosError(401))

    const result = await refreshAuth()

    expect(result).toEqual({ status: 'unauthenticated' })
    expect(post).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().memberId).toBeNull() // clearAuth로 정리됨
  })

  it('400(죽은 토큰)도 unauthenticated', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(axiosError(400))

    const result = await refreshAuth()

    expect(result).toEqual({ status: 'unauthenticated' })
  })

  it('429는 offline + 재시도 없음 + 세션 유지', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValueOnce(axiosError(429))

    const result = await refreshAuth()

    expect(result).toEqual({ status: 'offline' })
    expect(post).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().memberId).toBe(7) // 세션 유지
  })

  it('네트워크 에러로 실패하다 복구하면 재시도 후 authenticated', async () => {
    vi.useFakeTimers()
    const post = vi.spyOn(axios, 'post')
      .mockRejectedValueOnce(axiosError(undefined))
      .mockRejectedValueOnce(axiosError(undefined))
      .mockResolvedValueOnce(okResponse('recovered', 7))

    const p = refreshAuth()
    await vi.runAllTimersAsync() // 백오프 sleep 전부 진행
    const result = await p

    expect(result).toEqual({ status: 'authenticated', token: 'recovered' })
    expect(post).toHaveBeenCalledTimes(3)
    expect(useAuthStore.getState().accessToken).toBe('recovered')
  })

  it('지속적 네트워크 장애는 재시도 소진 후 offline + 세션 유지', async () => {
    vi.useFakeTimers()
    const post = vi.spyOn(axios, 'post').mockRejectedValue(axiosError(undefined))

    const p = refreshAuth()
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual({ status: 'offline' })
    expect(post).toHaveBeenCalledTimes(4) // 최초 + 재시도 3회
    expect(useAuthStore.getState().memberId).toBe(7) // 세션 유지 — 로그아웃 안 함
  })

  it('동시 호출은 in-flight 프라미스를 공유해 요청 1회만 발생', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValueOnce(okResponse('shared', 7))

    const [a, b] = await Promise.all([refreshAuth(), refreshAuth()])

    expect(a).toEqual({ status: 'authenticated', token: 'shared' })
    expect(b).toEqual(a)
    expect(post).toHaveBeenCalledTimes(1)
  })
})
