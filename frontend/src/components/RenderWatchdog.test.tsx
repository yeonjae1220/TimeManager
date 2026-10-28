import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/renderStall', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/renderStall')>()),
  reloadForRenderStall: vi.fn().mockReturnValue(true),
  isReloadUnsafe: vi.fn().mockReturnValue(false),
}))
// React 커밋 정지를 재현한다 — 켜면 감시 컴포넌트의 state 갱신이 화면에 반영되지 않는다.
// react-dom 은 이 mock 을 거치지 않으므로 렌더 자체는 그대로다.
const commitControl = vi.hoisted(() => ({ stalled: false }))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (<S,>(initial: S | (() => S)) => {
      const [state, setState] = actual.useState(initial)
      return [state, commitControl.stalled ? () => {} : setState]
    }) as typeof actual.useState,
  }
})
vi.mock('@/utils/platform', () => ({
  isNativeApp: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(true),
}))

import { RENDER_WATCHDOG_INTERVAL_MS, RenderWatchdog } from './RenderWatchdog'
import { RENDER_STALL_THRESHOLD_MS, isReloadUnsafe, reloadForRenderStall } from '@/utils/renderStall'
import { isNativeApp, isStandaloneDisplay } from '@/utils/platform'

const reloadSpy = reloadForRenderStall as unknown as ReturnType<typeof vi.fn>
const unsafeSpy = isReloadUnsafe as unknown as ReturnType<typeof vi.fn>

/** jsdom 의 visibilityState 는 프로토타입 getter라 vi.spyOn 이 먹지 않는다. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

/** 임계값을 넘길 만큼 점검 주기를 한 번씩 진행한다(타이머가 정상적으로 도는 경우). */
async function runChecks(totalMs: number) {
  const steps = Math.ceil(totalMs / RENDER_WATCHDOG_INTERVAL_MS)
  for (let i = 0; i < steps; i++) {
    await vi.advanceTimersByTimeAsync(RENDER_WATCHDOG_INTERVAL_MS)
  }
}

const PAST_THRESHOLD_MS = RENDER_STALL_THRESHOLD_MS + RENDER_WATCHDOG_INTERVAL_MS * 2

/**
 * iOS 홈 화면 PWA 가 백그라운드에서 돌아온 뒤, JS(타이머·네트워크)는 도는데 화면 갱신만
 * 멈춰 터치할 때만 잠깐 그려지는 상태가 실제로 관찰됐다(타이머 00:00:00 고정·"동기화 중"
 * 고착). 강제 종료 후 재실행하면 풀렸으므로, 감지되면 페이지를 다시 여는 것이 복구다.
 */
describe('RenderWatchdog', () => {
  let frameCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    reloadSpy.mockClear()
    unsafeSpy.mockReturnValue(false)
    commitControl.stalled = false
    ;(isNativeApp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false)
    ;(isStandaloneDisplay as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
    frameCallbacks = []
    // 기본: 프레임이 오지 않는다(화면 갱신 정지). 정상 경로 테스트는 flushFrames 로 흘린다.
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      frameCallbacks.push(cb)
      return frameCallbacks.length
    }))
  })

  afterEach(() => {
    setVisibility('visible')
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function deliverFramesEachCheck() {
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      queueMicrotask(() => cb(performance.now()))
      return 1
    }))
  }

  it('[감지] 화면이 보이는데 요청한 프레임이 임계값을 넘도록 오지 않으면 페이지를 다시 연다', async () => {
    render(<RenderWatchdog />)
    await runChecks(PAST_THRESHOLD_MS)
    expect(reloadSpy).toHaveBeenCalledWith('frame')
  })

  it('[감지] 프레임은 오는데 React 커밋이 임계값을 넘도록 반영되지 않으면 페이지를 다시 연다', async () => {
    deliverFramesEachCheck()
    commitControl.stalled = true
    render(<RenderWatchdog />)
    await runChecks(PAST_THRESHOLD_MS)
    expect(reloadSpy).toHaveBeenCalledWith('commit')
    expect(reloadSpy).not.toHaveBeenCalledWith('frame')
  })

  it('[회귀] 요청이 진행 중이면 새로고침을 미루고, 끝나면 다음 점검에서 바로 다시 연다', async () => {
    unsafeSpy.mockReturnValue(true)
    render(<RenderWatchdog />)
    await runChecks(PAST_THRESHOLD_MS * 2)
    expect(reloadSpy).not.toHaveBeenCalled()

    unsafeSpy.mockReturnValue(false)
    await vi.advanceTimersByTimeAsync(RENDER_WATCHDOG_INTERVAL_MS)
    expect(reloadSpy).toHaveBeenCalledWith('frame')
  })

  it('[정상] 프레임과 커밋이 제때 오면 아무것도 하지 않는다', async () => {
    deliverFramesEachCheck()
    render(<RenderWatchdog />)
    await runChecks(PAST_THRESHOLD_MS * 3)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('[오탐 방지] 화면이 숨겨진 동안에는 프레임이 없어도 판정하지 않는다', async () => {
    setVisibility('hidden')
    render(<RenderWatchdog />)
    await runChecks(PAST_THRESHOLD_MS * 2)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('[보강] 숨김으로 보고돼도 사용자가 화면을 터치했다면 보이는 것으로 보고 판정한다', async () => {
    // iOS 가 복귀 뒤 visibilityState 를 hidden 으로 잘못 남기면 감시가 영영 쉬게 된다.
    // 숨겨진 페이지는 터치를 받을 수 없으므로 터치가 곧 보인다는 증거다.
    setVisibility('hidden')
    render(<RenderWatchdog />)
    window.dispatchEvent(new Event('pointerdown'))
    await runChecks(PAST_THRESHOLD_MS)
    expect(reloadSpy).toHaveBeenCalledWith('frame')
  })

  it('[오탐 방지] 터치 뒤 실제로 숨겨지면(visibilitychange) 터치 증거를 버린다', async () => {
    render(<RenderWatchdog />)
    window.dispatchEvent(new Event('pointerdown'))
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await runChecks(PAST_THRESHOLD_MS * 2)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('[오탐 방지] 복귀 직후에는 기준을 새로 잡는다 — 백그라운드 이전 요청으로 판정하지 않는다', async () => {
    render(<RenderWatchdog />)
    await vi.advanceTimersByTimeAsync(RENDER_WATCHDOG_INTERVAL_MS) // 프레임 요청
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(RENDER_STALL_THRESHOLD_MS * 2)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    deliverFramesEachCheck() // 복귀 후에는 정상적으로 그려진다
    await runChecks(RENDER_WATCHDOG_INTERVAL_MS * 2)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('[오탐 방지] 점검 간격이 크게 벌어졌다면(페이지 일시정지) 그 구간은 판정하지 않는다', async () => {
    render(<RenderWatchdog />)
    await vi.advanceTimersByTimeAsync(RENDER_WATCHDOG_INTERVAL_MS) // 프레임 요청
    // 타이머가 얼어 있던 동안 시계만 흘렀다 — 다음 점검이 한참 늦게 돈다.
    vi.setSystemTime(Date.now() + RENDER_STALL_THRESHOLD_MS * 3)
    deliverFramesEachCheck()
    await vi.advanceTimersByTimeAsync(RENDER_WATCHDOG_INTERVAL_MS)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('[범위] 일반 브라우저 탭(설치형 PWA·네이티브 셸이 아님)에서는 감시하지 않는다', async () => {
    ;(isStandaloneDisplay as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false)
    render(<RenderWatchdog />)
    await runChecks(PAST_THRESHOLD_MS * 2)
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('[범위] 네이티브 셸(WKWebView)도 감시한다', async () => {
    ;(isStandaloneDisplay as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false)
    ;(isNativeApp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<RenderWatchdog />)
    await runChecks(PAST_THRESHOLD_MS)
    expect(reloadSpy).toHaveBeenCalledWith('frame')
  })

  it('언마운트하면 점검을 멈춘다', async () => {
    const { unmount } = render(<RenderWatchdog />)
    unmount()
    await runChecks(PAST_THRESHOLD_MS * 2)
    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
