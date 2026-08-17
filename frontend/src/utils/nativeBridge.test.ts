import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetNativeBridgeWarnings, hasCapability, withPlugin } from './nativeBridge'

/** window.Capacitor 브리지를 흉내낸다. undefined 를 넘기면 웹(브리지 없음). */
function setCapacitor(bridge: Window['Capacitor'] | undefined) {
  if (bridge === undefined) {
    delete (window as { Capacitor?: unknown }).Capacitor
    return
  }
  window.Capacitor = bridge
}

function nativeBridge(available: string[]) {
  return {
    isNativePlatform: () => true,
    getPlatform: () => 'android' as const,
    isPluginAvailable: (name: string) => available.includes(name),
  }
}

describe('nativeBridge', () => {
  beforeEach(() => {
    __resetNativeBridgeWarnings()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    setCapacitor(undefined)
    vi.restoreAllMocks()
  })

  describe('hasCapability', () => {
    it('웹에서는 브리지가 없으므로 false', () => {
      setCapacitor(undefined)
      expect(hasCapability('Haptics')).toBe(false)
    })

    it('바이너리에 있는 플러그인만 true', () => {
      setCapacitor(nativeBridge(['Haptics']))
      expect(hasCapability('Haptics')).toBe(true)
      expect(hasCapability('LocalNotifications')).toBe(false)
    })

    it('구 브리지처럼 isPluginAvailable 자체가 없으면 false', () => {
      setCapacitor({ isNativePlatform: () => true, getPlatform: () => 'ios' })
      expect(hasCapability('Haptics')).toBe(false)
    })
  })

  describe('withPlugin', () => {
    it('웹에서는 loader 도 fn 도 부르지 않는다', async () => {
      setCapacitor(undefined)
      const loader = vi.fn()
      const fn = vi.fn()

      await expect(withPlugin('Haptics', loader, fn)).resolves.toBeUndefined()
      expect(loader).not.toHaveBeenCalled()
      expect(fn).not.toHaveBeenCalled()
    })

    it('구 바이너리(플러그인 없음)에서는 no-op 이고 예외를 던지지 않는다', async () => {
      setCapacitor(nativeBridge([]))
      const loader = vi.fn()

      await expect(withPlugin('LocalNotifications', loader, vi.fn())).resolves.toBeUndefined()
      expect(loader).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledTimes(1)
    })

    it('같은 capability 누락 경고는 한 번만 남긴다', async () => {
      setCapacitor(nativeBridge([]))

      await withPlugin('LocalNotifications', vi.fn(), vi.fn())
      await withPlugin('LocalNotifications', vi.fn(), vi.fn())

      expect(console.warn).toHaveBeenCalledTimes(1)
    })

    it('플러그인이 있으면 모듈을 fn 에 넘기고 결과를 돌려준다', async () => {
      setCapacitor(nativeBridge(['Haptics']))
      const module = { Haptics: { impact: vi.fn().mockResolvedValue(undefined) } }

      const result = await withPlugin(
        'Haptics',
        async () => module,
        async (m) => {
          await m.Haptics.impact()
          return 'ok'
        },
      )

      expect(result).toBe('ok')
      expect(module.Haptics.impact).toHaveBeenCalledOnce()
    })

    it('플러그인 호출이 실패해도 예외를 삼키고 warn 만 남긴다', async () => {
      setCapacitor(nativeBridge(['Haptics']))

      const result = await withPlugin(
        'Haptics',
        async () => ({}),
        () => {
          throw new Error('plugin is not implemented')
        },
      )

      expect(result).toBeUndefined()
      expect(console.warn).toHaveBeenCalledOnce()
    })

    it('loader(동적 import) 실패도 삼킨다', async () => {
      setCapacitor(nativeBridge(['Haptics']))

      const result = await withPlugin(
        'Haptics',
        () => Promise.reject(new Error('chunk load failed')),
        vi.fn(),
      )

      expect(result).toBeUndefined()
      expect(console.warn).toHaveBeenCalledOnce()
    })
  })
})
