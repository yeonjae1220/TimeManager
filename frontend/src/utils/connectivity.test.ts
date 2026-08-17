import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetConnectivity,
  isOnline,
  reportReachable,
  reportUnreachable,
  subscribeConnectivity,
} from './connectivity'

describe('connectivity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetConnectivity()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    __resetConnectivity()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('낙관적으로 online 에서 시작한다 — 켜자마자 오프라인 배너가 뜨면 안 된다', () => {
    expect(isOnline()).toBe(true)
  })

  it('네트워크 실패를 보고하면 offline 이 되고 구독자에게 알린다', () => {
    const seen: boolean[] = []
    subscribeConnectivity((v) => seen.push(v))

    reportUnreachable()

    expect(isOnline()).toBe(false)
    expect(seen).toEqual([false])
  })

  it('같은 상태를 반복 보고해도 한 번만 알린다', () => {
    const seen: boolean[] = []
    subscribeConnectivity((v) => seen.push(v))

    reportUnreachable()
    reportUnreachable()
    reportUnreachable()

    expect(seen).toEqual([false])
  })

  it('online 인 동안에는 probe 를 돌리지 않는다 — 정상 상태의 비용은 0이어야 한다', async () => {
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('offline 이 되면 probe 를 돌리고, 성공하면 online 으로 복귀시킨다', async () => {
    const seen: boolean[] = []
    subscribeConnectivity((v) => seen.push(v))
    reportUnreachable()

    await vi.advanceTimersByTimeAsync(3_000)

    expect(fetch).toHaveBeenCalled()
    expect(isOnline()).toBe(true)
    expect(seen).toEqual([false, true])
  })

  it('probe 가 실패하면 offline 을 유지하고 간격을 늘린다', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    reportUnreachable()

    await vi.advanceTimersByTimeAsync(3_000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(isOnline()).toBe(false)

    // 백오프가 걸렸으므로 같은 3초로는 다음 probe 가 오지 않는다.
    await vi.advanceTimersByTimeAsync(3_000)
    expect(fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('요청 성공 보고가 들어오면 probe 루프를 멈춘다', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    reportUnreachable()
    await vi.advanceTimersByTimeAsync(3_000)

    reportReachable()
    vi.mocked(fetch).mockClear()

    await vi.advanceTimersByTimeAsync(120_000)
    expect(isOnline()).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('구독을 해지하면 더 이상 통지받지 않는다', () => {
    const seen: boolean[] = []
    const off = subscribeConnectivity((v) => seen.push(v))

    off()
    reportUnreachable()

    expect(seen).toEqual([])
  })

  it('한 구독자가 던져도 다른 구독자는 통지받는다', () => {
    const seen: boolean[] = []
    subscribeConnectivity(() => {
      throw new Error('구독자 폭발')
    })
    subscribeConnectivity((v) => seen.push(v))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    reportUnreachable()

    expect(seen).toEqual([false])
  })
})
