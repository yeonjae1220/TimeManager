import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'

vi.mock('@/utils/connectivity', () => ({
  reportReachable: vi.fn(),
  reportUnreachable: vi.fn(),
}))
vi.mock('@/utils/refreshAuth', () => ({
  refreshAuth: vi.fn(),
  waitForPendingRefresh: vi.fn(async () => null),
}))

import apiClient, { PENDING_REFRESH_WAIT_MS } from './apiClient'
import { waitForPendingRefresh, refreshAuth } from '@/utils/refreshAuth'
import { useAuthStore } from '@/store/authStore'
import { hasInflightWrites } from '@/utils/inflightWrites'

const mockPending = waitForPendingRefresh as unknown as ReturnType<typeof vi.fn>
const mockRefresh = refreshAuth as unknown as ReturnType<typeof vi.fn>

// 네트워크 대신 요청 설정을 그대로 돌려주는 어댑터 — 인터셉터가 붙인 헤더를 본다.
const echoAuthHeader: AxiosAdapter = async (config) => ({
  data: config.headers?.Authorization ?? null,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

beforeEach(() => {
  mockPending.mockReset().mockResolvedValue(null)
  mockRefresh.mockReset()
  useAuthStore.setState({ accessToken: null, memberId: 7 })
})

afterEach(() => {
  useAuthStore.setState({ accessToken: null, memberId: null })
})

describe('apiClient — 요청 타임아웃', () => {
  // 응답이 오지 않는 요청(네트워크 hang)이 useAsyncData의 fail()을 영영 못 부르고
  // 스피너가 영원히 도는 화면이 되는 것을 막는다(자세한 이유는 apiClient.ts 주석 참조).
  // 실제 hang을 흉내 내려면 이 저장소에 없는 HTTP mocking 라이브러리가 필요하므로,
  // 여기서는 axios 인스턴스에 timeout이 설정돼 있다는 사실 자체를 검증한다.
  it('timeout이 설정돼 있다', () => {
    expect(apiClient.defaults.timeout).toBeGreaterThan(0)
  })
})

describe('apiClient — 진행 중인 refresh 대기', () => {
  // 콜드 스타트에 화면을 낙관적으로 먼저 열면, 화면의 첫 요청들이 accessToken 이
  // 생기기 전에 나간다. 그대로 보내면 전부 401 → 각자 refresh → 재요청으로 왕복이
  // 두 배가 된다. 이미 refresh 가 진행 중이면 그 결과를 기다렸다가 토큰을 실어 보낸다.
  it('토큰이 없고 refresh 가 진행 중이면 끝날 때까지 기다렸다가 새 토큰을 싣는다', async () => {
    mockPending.mockResolvedValue({ status: 'authenticated', token: 'fresh' })

    const res = await apiClient.get('/api/v1/x', { adapter: echoAuthHeader })

    expect(res.data).toBe('Bearer fresh')
  })

  it('기다린 refresh 가 offline 이면 토큰 없이 그대로 보낸다(요청을 막지 않는다)', async () => {
    mockPending.mockResolvedValue({ status: 'offline' })

    const res = await apiClient.get('/api/v1/x', { adapter: echoAuthHeader })

    expect(res.data).toBeNull()
  })

  it('기다림에는 상한이 있다 — 요청 타임아웃(15s) 밖에서 화면 요청을 오래 붙잡지 않게', async () => {
    mockPending.mockResolvedValue(null)

    await apiClient.get('/api/v1/x', { adapter: echoAuthHeader })

    expect(mockPending).toHaveBeenCalledWith(PENDING_REFRESH_WAIT_MS)
    expect(PENDING_REFRESH_WAIT_MS).toBeLessThanOrEqual(5_000)
  })

  it('이미 토큰이 있으면 refresh 를 기다리지 않는다', async () => {
    useAuthStore.setState({ accessToken: 'have' })
    mockPending.mockReturnValue(new Promise(() => {})) // 영영 안 끝나도 막히면 안 된다

    const res = await apiClient.get('/api/v1/x', { adapter: echoAuthHeader })

    expect(res.data).toBe('Bearer have')
  })

  it('refresh 요청 자체(/api/v1/auth/*)는 기다리지 않는다', async () => {
    mockPending.mockReturnValue(new Promise(() => {}))

    const res = await apiClient.post('/api/v1/auth/logout', undefined, { adapter: echoAuthHeader })

    expect(res.status).toBe(200)
  })
})

describe('apiClient — 진행 중인 쓰기 요청 추적', () => {
  // 화면 정지 복구(RenderWatchdog)는 쓰기 요청이 응답을 받기 전에는 새로고침하지 않는다.
  // 끊긴 타이머 조작은 오프라인 큐에도 서버에도 남지 않기 때문이다.

  /** 직접 끝낼 수 있는 어댑터 — 요청이 날아가 있는 동안의 상태를 본다. */
  function deferredAdapter() {
    let finish: (status: number) => void = () => {}
    const adapter: AxiosAdapter = (config) =>
      new Promise((resolve, reject) => {
        finish = (status) => {
          const response = { data: null, status, statusText: '', headers: {}, config }
          if (status < 400) resolve(response)
          else reject(new AxiosError('fail', String(status), config, null, response))
        }
      })
    return { adapter, finish: (status: number) => finish(status) }
  }

  it('쓰기 요청이 응답을 기다리는 동안 진행 중으로 보고, 응답이 오면 해소한다', async () => {
    const { adapter, finish } = deferredAdapter()

    const req = apiClient.post('/api/v1/tags/1/start', undefined, { adapter })
    await vi.waitFor(() => expect(hasInflightWrites()).toBe(true))
    finish(200)
    await req

    expect(hasInflightWrites()).toBe(false)
  })

  it('실패한 쓰기 요청도 해소한다', async () => {
    const { adapter, finish } = deferredAdapter()

    const req = apiClient.post('/api/v1/tags/1/stop', undefined, { adapter })
    await vi.waitFor(() => expect(hasInflightWrites()).toBe(true))
    finish(500)
    await expect(req).rejects.toBeInstanceOf(AxiosError)

    expect(hasInflightWrites()).toBe(false)
  })

  it('읽기 요청은 세지 않는다', async () => {
    const { adapter, finish } = deferredAdapter()

    const req = apiClient.get('/api/v1/tags', { adapter })
    await new Promise((r) => setTimeout(r, 0))
    expect(hasInflightWrites()).toBe(false)
    finish(200)
    await req
  })

  it('401 뒤 재요청이 끝날 때까지 진행 중으로 보고, 끝나면 한 번만 해소한다', async () => {
    useAuthStore.setState({ accessToken: 'old' })
    mockRefresh.mockResolvedValue({ status: 'authenticated', token: 'new' })
    let calls = 0
    let finishRetry: () => void = () => {}
    const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
      calls += 1
      const response = { data: null, status: 200, statusText: '', headers: {}, config }
      if (calls === 1) {
        return Promise.reject(
          new AxiosError('unauthorized', '401', config, null, { ...response, status: 401 }),
        )
      }
      return new Promise((resolve) => {
        finishRetry = () => resolve(response)
      })
    }

    const req = apiClient.post('/api/v1/tags/1/start', undefined, { adapter })
    await vi.waitFor(() => expect(calls).toBe(2))
    expect(hasInflightWrites()).toBe(true)
    finishRetry()
    await req

    expect(hasInflightWrites()).toBe(false)
  })
})
