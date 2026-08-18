import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConnectivityWatcher } from './ConnectivityWatcher'
import { __resetConnectivity, isOnline, reportUnreachable } from '@/utils/connectivity'

/** jsdom 의 visibilityState 는 프로토타입 getter라 vi.spyOn 이 먹지 않는다. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

function goForeground() {
  setVisibility('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

/**
 * 이 컴포넌트의 존재 이유는 "어느 화면에 있든" 복귀를 감지하는 것이다.
 * 화면을 그리지 않으므로 검증 대상은 오직 부작용 — 포그라운드 복귀 시 probe 재개다.
 */
describe('ConnectivityWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetConnectivity()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })

  afterEach(() => {
    setVisibility('visible')
    __resetConnectivity()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** 오프라인 상태로 백그라운드에 들어가 probe 체인이 스스로 멈춘 상태를 만든다. */
  async function goOfflineAndBackground() {
    reportUnreachable()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(120_000)
    vi.mocked(fetch).mockClear()
  }

  it('백그라운드에서 멈춘 probe 체인을 포그라운드 복귀 시 되살린다', async () => {
    render(<ConnectivityWatcher />)
    await goOfflineAndBackground()

    // 사전 조건: 숨겨진 동안에는 정말 아무것도 안 두드린다.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).not.toHaveBeenCalled()

    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    goForeground()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(isOnline()).toBe(true)
  })

  it('컴포넌트가 없으면 복귀해도 아무도 확인하지 않는다 (이 컴포넌트가 필요한 이유)', async () => {
    await goOfflineAndBackground()

    goForeground()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(fetch).not.toHaveBeenCalled()
    expect(isOnline()).toBe(false)
  })

  it('언마운트하면 리스너를 떼어 누수시키지 않는다', async () => {
    const { unmount } = render(<ConnectivityWatcher />)
    await goOfflineAndBackground()

    unmount()
    goForeground()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(fetch).not.toHaveBeenCalled()
  })

  it('온라인일 때의 복귀는 no-op 이다 — 정상 상태의 비용은 0이어야 한다', async () => {
    render(<ConnectivityWatcher />)

    goForeground()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(fetch).not.toHaveBeenCalled()
  })
})
