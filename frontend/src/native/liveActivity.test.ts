import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  hideLiveActivity,
  LIVE_ACTIVITY_PLUGIN,
  showLiveActivity,
  supportsLiveActivity,
} from './liveActivity'
import { __resetNativeBridgeWarnings } from '@/utils/nativeBridge'

const plugin = vi.hoisted(() => ({
  show: vi.fn(),
  hide: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }))

const content = { title: '알고리즘', text: '기록 중', whenMs: Date.now() }

function enableNative(available: string[] = [LIVE_ACTIVITY_PLUGIN]) {
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    isPluginAvailable: (name: string) => available.includes(name),
  }
}

describe('liveActivity', () => {
  beforeEach(() => {
    __resetNativeBridgeWarnings()
    plugin.show.mockReset().mockResolvedValue({ shown: true })
    plugin.hide.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete window.Capacitor
    vi.restoreAllMocks()
  })

  describe('showLiveActivity', () => {
    it('네이티브에서 내용을 그대로 네이티브에 넘긴다', async () => {
      enableNative()

      await showLiveActivity(content)

      expect(plugin.show).toHaveBeenCalledWith(content)
    })

    it('실제로 시작/갱신되면 true 를 돌려준다', async () => {
      enableNative()

      await expect(showLiveActivity(content)).resolves.toBe(true)
    })

    /**
     * ActivityKit 은 포그라운드에서만 액티비티를 시작할 수 있다. 백그라운드에서
     * 부르면 `Activity.request()` 가 throw 하고, Swift 쪽은 이를 shown:false 로
     * 옮겨 담는다(TM-ADR-012 C5) — 여기서는 그 결과를 그대로 전달만 확인한다.
     */
    it('시작하지 못하면(iOS 미만·설정 차단·백그라운드) false 를 돌려준다', async () => {
      enableNative()
      plugin.show.mockResolvedValue({ shown: false })

      await expect(showLiveActivity(content)).resolves.toBe(false)
    })

    it('웹에서는 아무것도 호출하지 않고 false 다', async () => {
      await expect(showLiveActivity(content)).resolves.toBe(false)
      expect(plugin.show).not.toHaveBeenCalled()
    })

    /**
     * 원격 로드 하이브리드라 웹은 매일 배포되는데 앱 바이너리는 몇 주에 한 번 나간다.
     * 새 웹 코드가 구 바이너리에 없는 플러그인을 부르면 예외가 난다.
     */
    it('구 바이너리(플러그인 없음)에서는 조용히 건너뛰고 false 다', async () => {
      enableNative([])

      await expect(showLiveActivity(content)).resolves.toBe(false)
      expect(plugin.show).not.toHaveBeenCalled()
    })

    it('네이티브 호출이 실패해도 던지지 않고 false 다 — 타이머 조작이 깨지면 안 된다', async () => {
      enableNative()
      plugin.show.mockRejectedValue(new Error('boom'))

      await expect(showLiveActivity(content)).resolves.toBe(false)
    })

    it('구 바이너리가 shown 을 안 돌려줘도 false 로 떨어진다', async () => {
      enableNative()
      plugin.show.mockResolvedValue(undefined)

      await expect(showLiveActivity(content)).resolves.toBe(false)
    })
  })

  describe('hideLiveActivity', () => {
    it('네이티브에서 hide 를 호출하고 true 를 돌려준다', async () => {
      enableNative()

      await expect(hideLiveActivity()).resolves.toBe(true)
      expect(plugin.hide).toHaveBeenCalledTimes(1)
    })

    /**
     * 웹·구 바이너리·Android 에는 애초에 시작한 액티비티가 없다. "정리할 것이 없다"는
     * 정리된 것과 같으므로 true 다 — 여기서 false 를 주면 호출부가 영원히 재시도한다.
     */
    it('웹에서는 호출 없이 true (띄운 적이 없으므로 정리할 것도 없다)', async () => {
      await expect(hideLiveActivity()).resolves.toBe(true)
      expect(plugin.hide).not.toHaveBeenCalled()
    })

    it('구 바이너리에서도 호출 없이 true', async () => {
      enableNative([])

      await expect(hideLiveActivity()).resolves.toBe(true)
      expect(plugin.hide).not.toHaveBeenCalled()
    })

    it('네이티브 호출이 실패하면 false — 유령 액티비티가 남았을 수 있다', async () => {
      enableNative()
      plugin.hide.mockRejectedValue(new Error('boom'))

      await expect(hideLiveActivity()).resolves.toBe(false)
    })
  })
})

/**
 * "이 표면을 다룰 수 있는가" 는 "이 표면이 수렴했는가" 와 다르다. 이 플러그인은
 * ios/App 프로젝트 안에만 있어서 **웹에도 Android 에도 없다**. 다룰 수 없는 곳에서
 * 실패로 세면 호출부가 매번 재수렴을 시도하며 영원히 돌게 된다.
 */
describe('supportsLiveActivity', () => {
  afterEach(() => {
    delete window.Capacitor
  })

  it('웹에서는 false', () => {
    expect(supportsLiveActivity()).toBe(false)
  })

  it('플러그인이 없는 네이티브 바이너리(Android·구버전)에서는 false', () => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      isPluginAvailable: () => false,
    }
    expect(supportsLiveActivity()).toBe(false)
  })

  it('플러그인이 있는 네이티브에서만 true', () => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      isPluginAvailable: (name: string) => name === LIVE_ACTIVITY_PLUGIN,
    }
    expect(supportsLiveActivity()).toBe(true)
  })
})
