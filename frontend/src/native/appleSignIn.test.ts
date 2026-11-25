import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  APPLE_SIGN_IN_PLUGIN,
  __resetAppleSignInPlugin,
  signInWithApple,
  supportsAppleSignIn,
} from './appleSignIn'
import { __resetNativeBridgeWarnings } from '@/utils/nativeBridge'

const plugin = vi.hoisted(() => ({ signIn: vi.fn() }))

vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }))

function enableNative(available: string[] = [APPLE_SIGN_IN_PLUGIN]) {
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    isPluginAvailable: (name: string) => available.includes(name),
  }
}

describe('appleSignIn', () => {
  beforeEach(() => {
    __resetNativeBridgeWarnings()
    __resetAppleSignInPlugin()
    plugin.signIn.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    delete window.Capacitor
    vi.restoreAllMocks()
  })

  describe('supportsAppleSignIn', () => {
    it('웹에서는 false — 버튼을 띄우지 않는다', () => {
      expect(supportsAppleSignIn()).toBe(false)
    })

    it('플러그인이 없는 바이너리(Android·구 iOS 앱)에서는 false', () => {
      enableNative([])
      expect(supportsAppleSignIn()).toBe(false)
    })

    it('플러그인이 있는 iOS 앱에서만 true', () => {
      enableNative()
      expect(supportsAppleSignIn()).toBe(true)
    })
  })

  describe('signInWithApple', () => {
    it('네이티브에 넘긴 nonce 원문을 토큰과 함께 돌려준다 — 백엔드가 이 원문으로 검증한다', async () => {
      enableNative()
      plugin.signIn.mockResolvedValue({ cancelled: false, identityToken: 'tok', authorizationCode: 'code', fullName: '연재 김' })

      const outcome = await signInWithApple()

      const sentNonce = plugin.signIn.mock.calls[0][0].nonce as string
      expect(sentNonce).toMatch(/^[0-9a-f-]{36}$/)
      expect(outcome).toEqual({
        kind: 'success', identityToken: 'tok', authorizationCode: 'code', nonce: sentNonce, fullName: '연재 김',
      })
    })

    it('요청마다 다른 nonce 를 만든다', async () => {
      enableNative()
      plugin.signIn.mockResolvedValue({ cancelled: false, identityToken: 'tok' })

      await signInWithApple()
      await signInWithApple()

      const [first, second] = plugin.signIn.mock.calls.map((c) => c[0].nonce)
      expect(first).not.toBe(second)
    })

    it('사용자가 취소하면 cancelled — 에러로 다루지 않는다', async () => {
      enableNative()
      plugin.signIn.mockResolvedValue({ cancelled: true })

      await expect(signInWithApple()).resolves.toEqual({ kind: 'cancelled' })
    })

    it('네이티브 호출이 실패하면 failed — 빈 성공으로 바꾸지 않는다', async () => {
      enableNative()
      plugin.signIn.mockRejectedValue(new Error('boom'))

      await expect(signInWithApple()).resolves.toEqual({ kind: 'failed' })
    })

    it('토큰 없이 성공으로 오면 failed', async () => {
      enableNative()
      plugin.signIn.mockResolvedValue({ cancelled: false })

      await expect(signInWithApple()).resolves.toEqual({ kind: 'failed' })
    })

    it('플러그인이 없는 바이너리에서는 호출하지 않고 failed', async () => {
      enableNative([])

      await expect(signInWithApple()).resolves.toEqual({ kind: 'failed' })
      expect(plugin.signIn).not.toHaveBeenCalled()
    })
  })
})
