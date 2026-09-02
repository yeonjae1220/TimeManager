import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import AppShell from './AppShell'

vi.mock('next/navigation', () => ({ usePathname: () => '/members/1/today' }))
vi.mock('@/store/authStore', () => ({ useAuthStore: (sel: (s: { memberId: number }) => unknown) => sel({ memberId: 1 }) }))
vi.mock('@/i18n/I18nProvider', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

afterEach(() => cleanup())

function touchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: touches, configurable: true })
  return event
}

function pullPastThreshold(el: HTMLElement) {
  act(() => { el.dispatchEvent(touchEvent('touchstart', [{ clientX: 100, clientY: 0 }])) })
  act(() => { el.dispatchEvent(touchEvent('touchmove', [{ clientX: 100, clientY: 200 }])) })
  act(() => { el.dispatchEvent(touchEvent('touchend', [])) })
}

/** children이 실제로 remount됐는지(=effect가 다시 도는지)를 세는 프로브. */
function MountProbe({ onMount }: { onMount: () => void }) {
  const ran = useRef(false)
  useEffect(() => {
    if (!ran.current) {
      ran.current = true
      onMount()
    }
  }, [onMount])
  return <div>content</div>
}

describe('AppShell — 당겨서 새로고침 연결', () => {
  it('onRefresh를 주면 그걸 호출하고, children을 remount하지 않는다', async () => {
    const onRefresh = vi.fn(async () => {})
    const onMount = vi.fn()
    const { container } = render(
      <AppShell onRefresh={onRefresh}>
        <MountProbe onMount={onMount} />
      </AppShell>
    )
    const el = container.querySelector('.app-content') as HTMLDivElement

    pullPastThreshold(el)
    await act(async () => { await Promise.resolve() })

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onMount).toHaveBeenCalledTimes(1) // 최초 mount 그대로 — 다시 안 불림
  })

  it('onRefresh가 없으면 children을 remount해 자신의 mount effect를 다시 태운다', async () => {
    const onMount = vi.fn()
    const { container } = render(
      <AppShell>
        <MountProbe onMount={onMount} />
      </AppShell>
    )
    const el = container.querySelector('.app-content') as HTMLDivElement

    pullPastThreshold(el)
    // remount 자체는 동기지만, 스피너 최소 노출을 위한 setTimeout(400ms)이 있다.
    await act(async () => { await new Promise((r) => setTimeout(r, 450)) })

    expect(onMount).toHaveBeenCalledTimes(2) // 최초 1회 + remount로 1회 더
  })
})
