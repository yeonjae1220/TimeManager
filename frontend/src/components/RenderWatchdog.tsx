'use client'

import { useEffect, useRef, useState } from 'react'

import { isNativeApp, isStandaloneDisplay } from '@/utils/platform'
import { detectRenderStall, isReloadUnsafe, reloadForRenderStall } from '@/utils/renderStall'

export const RENDER_WATCHDOG_INTERVAL_MS = 2_000

/**
 * 점검 간격이 이보다 벌어졌다면 그 사이 페이지 자체가 멈춰(백그라운드·잠금) 있었던 것이다.
 * 그 구간의 "안 온 프레임"은 정지 증거가 아니므로 판정하지 않고 기준을 새로 잡는다.
 */
const SUSPENSION_GAP_MS = RENDER_WATCHDOG_INTERVAL_MS * 3

/**
 * 화면 갱신이 멈춘 채 JS 만 도는 상태를 감지해 페이지를 다시 연다(utils/renderStall.ts 참조).
 *
 * 화면이 보이는 동안 점검마다 두 가지를 요청하고 제때 오는지 본다.
 * - 프레임(requestAnimationFrame): 브라우저가 그리기를 멈췄는지
 * - 커밋(이 컴포넌트의 state 갱신): React 의 비동기 렌더(setInterval 등에서 온 갱신)가
 *   멈췄는지. 클릭 같은 이벤트 갱신은 동기로 처리돼 계속 반영되므로, 타이머 숫자만
 *   멈추고 버튼은 반응하는 상태가 이 경로로 잡힌다.
 *
 * 관찰된 문제가 설치형 PWA 에서만 났고, 일반 탭은 창이 가려지면 프레임을 멈추는
 * 브라우저가 있어 오탐 위험만 크므로 설치형 PWA·네이티브 셸에서만 감시한다.
 *
 * 숨김으로 보고되는 동안에는 판정하지 않지만, 그 사이 터치가 들어오면 보이는 것으로 본다.
 * 숨겨진 페이지는 터치를 받지 못하므로, iOS 가 복귀 뒤 visibilityState 를 hidden 으로
 * 잘못 남겨도 사용자가 화면을 만지는 순간부터 감시가 다시 돈다. 실제로 숨겨지면
 * visibilitychange 가 오므로 그때 이 증거를 버린다.
 * 화면을 그리지 않는다.
 */
export function RenderWatchdog() {
  const [probe, setProbe] = useState(0)
  const commitRequestedAtRef = useRef<number | null>(null)

  // 커밋이 화면에 반영되면 요청을 해소한다.
  useEffect(() => {
    commitRequestedAtRef.current = null
  }, [probe])

  useEffect(() => {
    if (!isStandaloneDisplay() && !isNativeApp()) return

    let frameRequestedAt: number | null = null
    let lastCheckAt = Date.now()
    let touchedSinceVisibilityChange = false

    const resetBaseline = () => {
      frameRequestedAt = null
      commitRequestedAtRef.current = null
      lastCheckAt = Date.now()
    }

    const requestFrame = (now: number) => {
      frameRequestedAt = now
      requestAnimationFrame(() => {
        // 백그라운드 이전에 걸어둔 늦은 콜백이 새 요청을 지우지 않게 자기 요청만 해소한다.
        if (frameRequestedAt === now) frameRequestedAt = null
      })
    }

    const onVisibilityChange = () => {
      touchedSinceVisibilityChange = false
      resetBaseline()
    }

    const onPointerDown = () => {
      touchedSinceVisibilityChange = true
    }

    const check = () => {
      const now = Date.now()
      const gap = now - lastCheckAt
      lastCheckAt = now
      const visible = document.visibilityState === 'visible' || touchedSinceVisibilityChange
      if (!visible || gap < 0 || gap > SUSPENSION_GAP_MS) {
        resetBaseline()
        return
      }

      const stall = detectRenderStall(now, frameRequestedAt, commitRequestedAtRef.current)
      if (stall) {
        // 끊기면 잃는 요청이 있으면 기준을 그대로 두고 다음 점검에서 다시 본다.
        if (isReloadUnsafe()) return
        reloadForRenderStall(stall)
        // 쿨다운으로 새로고침하지 못했을 때 매 점검마다 다시 판정하지 않게 기준을 새로 잡는다.
        resetBaseline()
        return
      }

      if (frameRequestedAt === null) requestFrame(now)
      if (commitRequestedAtRef.current === null) {
        commitRequestedAtRef.current = now
        setProbe((n) => n + 1)
      }
    }

    const interval = setInterval(check, RENDER_WATCHDOG_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [])

  return null
}
