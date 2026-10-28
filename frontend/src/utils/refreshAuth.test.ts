import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  refreshAuth,
  classifyRefreshError,
  backoffDelay,
  getPendingRefresh,
  getRecentRefreshOutcome,
  waitForPendingRefresh,
  REFRESH_TIMEOUT_MS,
} from './refreshAuth'
import { useAuthStore } from '@/store/authStore'

// refreshAuth 는 실패를 연결 상태로 보고한다. 그 모듈은 자체 백오프 타이머를 돌리므로
// 여기서 실물을 쓰면 이 파일의 가짜 타이머와 얽혀 무한 루프가 된다 — 보고 여부는
// connectivity.test.ts 가 따로 검증하므로 여기서는 경계만 막는다.
vi.mock('@/utils/connectivity', () => ({
  reportReachable: vi.fn(),
  reportUnreachable: vi.fn(),
}))

// axios 에러 형태 헬퍼 — axios.isAxiosError는 isAxiosError===true 객체를 인식한다.
function axiosError(status?: number): unknown {
  return { isAxiosError: true, response: status === undefined ? undefined : { status } }
}

// 유효한 accessToken JWT는 아니어도 됨 — store는 토큰 내용을 해석하지 않는다.
function okResponse(token = 'new.access.token', memberId = 7) {
  return { data: { accessToken: token, memberId } }
}

describe('classifyRefreshError', () => {
  it('백엔드가 실제로 내는 거부(400 죽은 토큰·401 쿠키 없음)만 unauthenticated', () => {
    expect(classifyRefreshError(axiosError(400))).toBe('unauthenticated')
    expect(classifyRefreshError(axiosError(401))).toBe('unauthenticated')
  })

  it('백엔드가 내지 않는 그 밖의 4xx(프록시·WAF 403, 라우팅 404 등)는 로그아웃 근거가 아니다', () => {
    // refresh 엔드포인트는 400·401·429 만 낸다. 그 밖의 4xx 는 Cloudflare·nginx 등
    // 중간 계층이 만든 응답이라 세션의 생사와 무관하다 — 여기서 로그아웃하면
    // 일시 장애 한 번에 오프라인 사용까지 막힌다.
    expect(classifyRefreshError(axiosError(403))).toBe('retryable')
    expect(classifyRefreshError(axiosError(404))).toBe('retryable')
    expect(classifyRefreshError(axiosError(418))).toBe('retryable')
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
    useAuthStore.setState({ accessToken: null, memberId: 7 })
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

  it('각 시도에 타임아웃을 건다 — 응답이 영영 안 오는 망에서 스플래시가 멈추지 않게', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValueOnce(okResponse())

    await refreshAuth()

    const config = post.mock.calls[0][2]
    expect(config?.timeout).toBe(REFRESH_TIMEOUT_MS)
    expect(REFRESH_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('getPendingRefresh 는 진행 중인 refresh 를 돌려주고, 끝나면 null', async () => {
    let resolve!: (v: unknown) => void
    vi.spyOn(axios, 'post').mockReturnValueOnce(new Promise((res) => { resolve = res }))

    expect(getPendingRefresh()).toBeNull()
    const p = refreshAuth()
    const shared = getPendingRefresh()
    expect(shared).not.toBeNull()

    resolve(okResponse('tok', 7))
    expect(await shared).toEqual(await p)

    expect(getPendingRefresh()).toBeNull()
  })

  it('타임아웃은 느리지만 살아 있는 응답을 끊지 않을 만큼 넉넉하다', () => {
    // 회전 응답을 클라이언트가 끊으면 서버는 이미 옛 토큰을 지웠는데 새 쿠키는 못 받아,
    // 다음 시도가 400 → 강제 로그아웃이 된다(백엔드 회전 유예가 생기기 전까지).
    expect(REFRESH_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000)
  })

  it('refresh 가 도는 사이 로그아웃(clearAuth)됐으면 늦게 온 성공으로 세션을 되살리지 않는다', async () => {
    let resolve!: (v: unknown) => void
    vi.spyOn(axios, 'post').mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const p = refreshAuth()
    useAuthStore.getState().clearAuth() // 사용자가 로그아웃
    resolve(okResponse('late', 7))
    const result = await p

    expect(result).toEqual({ status: 'unauthenticated' })
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().memberId).toBeNull()
    expect(useAuthStore.getState().lastAuthOkAt).toBeNull()
  })

  it('재시도 대기 중에 로그아웃됐으면 더 시도하지 않는다', async () => {
    vi.useFakeTimers()
    const post = vi.spyOn(axios, 'post')
      .mockRejectedValueOnce(axiosError(undefined))
      .mockResolvedValueOnce(okResponse('late', 7))

    const p = refreshAuth()
    await Promise.resolve()
    useAuthStore.getState().clearAuth()
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual({ status: 'unauthenticated' })
    expect(post).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})

describe('getRecentRefreshOutcome', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, memberId: 7 })
    vi.restoreAllMocks()
  })

  afterEach(() => vi.useRealTimers())

  it('방금 끝난 refresh 의 결과를 돌려준다 — 랜딩이 받은 offline 을 레이아웃이 다시 돌리지 않게', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(axiosError(429))
    await refreshAuth()

    expect(getRecentRefreshOutcome(5_000)).toEqual({ status: 'offline' })
  })

  it('상한보다 오래된 결과는 돌려주지 않는다', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(axiosError(429))
    await refreshAuth()

    expect(getRecentRefreshOutcome(5_000, Date.now() + 5_001)).toBeNull()
  })

  it('진행 중인 refresh 가 있으면 지난 결과는 의미가 없다 — null', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(axiosError(429))
    await refreshAuth()
    let respond!: (value: unknown) => void
    vi.spyOn(axios, 'post').mockReturnValueOnce(new Promise((resolve) => { respond = resolve }))
    const inFlight = refreshAuth()

    expect(getRecentRefreshOutcome(5_000)).toBeNull()

    // 다음 테스트로 진행 중 상태가 새지 않게 끝낸다.
    respond(okResponse('tok', 7))
    await inFlight
  })

  it('미래 시각에 기록된 결과(기기 시계가 뒤로 감)는 믿지 않는다', async () => {
    vi.spyOn(axios, 'post').mockResolvedValueOnce(okResponse('tok', 7))
    await refreshAuth()

    expect(getRecentRefreshOutcome(5_000, Date.now() - 1_000)).toBeNull()
  })
})

describe('waitForPendingRefresh', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, memberId: 7 })
    vi.restoreAllMocks()
  })

  afterEach(() => vi.useRealTimers())

  it('진행 중인 refresh 가 없으면 바로 null', async () => {
    expect(await waitForPendingRefresh(1_000)).toBeNull()
  })

  it('상한 안에 끝나면 그 결과를 돌려준다', async () => {
    vi.spyOn(axios, 'post').mockResolvedValueOnce(okResponse('tok', 7))
    void refreshAuth()

    expect(await waitForPendingRefresh(1_000)).toEqual({ status: 'authenticated', token: 'tok' })
  })

  it('상한을 넘기면 기다림을 접고 null — refresh 자체는 계속 돈다', async () => {
    vi.useFakeTimers()
    vi.spyOn(axios, 'post').mockReturnValueOnce(new Promise(() => {}))
    void refreshAuth()

    const waited = waitForPendingRefresh(1_000)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(await waited).toBeNull()
    expect(getPendingRefresh()).not.toBeNull()
  })
})
