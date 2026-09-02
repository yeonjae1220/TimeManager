import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import PullToRefresh from './PullToRefresh'

afterEach(() => cleanup())

/**
 * jsdom 은 TouchEvent 생성자를 제대로 구현하지 않으므로, PullToRefresh 가 실제로
 * 읽는 두 가지(touches, preventDefault)만 갖춘 합성 이벤트를 직접 만든다.
 */
function touchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: touches, configurable: true })
  return event
}

function renderShell(onRefresh = vi.fn(async () => {})) {
  const { container } = render(
    <PullToRefresh onRefresh={onRefresh}>
      <div data-testid="content">본문</div>
    </PullToRefresh>
  )
  const el = container.querySelector('.app-content') as HTMLDivElement
  return { el, onRefresh }
}

function drag(el: HTMLDivElement, points: Array<{ x: number; y: number }>) {
  act(() => { el.dispatchEvent(touchEvent('touchstart', [{ clientX: points[0].x, clientY: points[0].y }])) })
  for (const p of points.slice(1)) {
    act(() => { el.dispatchEvent(touchEvent('touchmove', [{ clientX: p.x, clientY: p.y }])) })
  }
}

describe('PullToRefresh', () => {
  it('맨 위(scrollTop=0)에서 임계값 이상 당겼다 놓으면 onRefresh를 부른다', async () => {
    const { el, onRefresh } = renderShell()
    el.scrollTop = 0

    // resistance(0.5)가 적용되므로 임계값(64px)을 확실히 넘기려면 그 두 배 이상 당긴다.
    drag(el, [{ x: 100, y: 0 }, { x: 100, y: 200 }])
    act(() => { el.dispatchEvent(touchEvent('touchend', [])) })

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('임계값을 못 넘기고 놓으면 onRefresh를 부르지 않는다', () => {
    const { el, onRefresh } = renderShell()
    el.scrollTop = 0

    drag(el, [{ x: 100, y: 0 }, { x: 100, y: 20 }])
    act(() => { el.dispatchEvent(touchEvent('touchend', [])) })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('리스트 중간(scrollTop>0)에서는 당김을 추적하지 않는다', () => {
    const { el, onRefresh } = renderShell()
    el.scrollTop = 50

    drag(el, [{ x: 100, y: 0 }, { x: 100, y: 120 }])
    act(() => { el.dispatchEvent(touchEvent('touchend', [])) })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('가로 스와이프(세로 성분이 더 작음)는 새로고침을 트리거하지 않는다', () => {
    const { el, onRefresh } = renderShell()
    el.scrollTop = 0

    // 가로로 60px, 세로로 10px — 방향이 가로로 확정돼야 한다.
    drag(el, [{ x: 0, y: 0 }, { x: 60, y: 10 }, { x: 120, y: 10 }])
    act(() => { el.dispatchEvent(touchEvent('touchend', [])) })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('모달 오버레이 위에서 시작한 터치는 무시한다', () => {
    const onRefresh = vi.fn(async () => {})
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <div data-modal-overlay data-testid="overlay">
          <div data-testid="inner">모달 내용</div>
        </div>
      </PullToRefresh>
    )
    const el = container.querySelector('.app-content') as HTMLDivElement
    const inner = container.querySelector('[data-testid="inner"]') as HTMLDivElement
    el.scrollTop = 0

    act(() => { inner.dispatchEvent(touchEvent('touchstart', [{ clientX: 100, clientY: 0 }])) })
    act(() => { inner.dispatchEvent(touchEvent('touchmove', [{ clientX: 100, clientY: 120 }])) })
    act(() => { inner.dispatchEvent(touchEvent('touchend', [])) })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('두 손가락(멀티터치)이면 당김 추적을 중단한다', () => {
    const { el, onRefresh } = renderShell()
    el.scrollTop = 0

    act(() => { el.dispatchEvent(touchEvent('touchstart', [{ clientX: 100, clientY: 0 }])) })
    act(() => {
      el.dispatchEvent(touchEvent('touchmove', [
        { clientX: 100, clientY: 120 },
        { clientX: 200, clientY: 120 },
      ]))
    })
    act(() => { el.dispatchEvent(touchEvent('touchend', [])) })

    expect(onRefresh).not.toHaveBeenCalled()
  })
})
