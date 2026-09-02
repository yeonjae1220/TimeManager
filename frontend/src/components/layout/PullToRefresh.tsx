'use client'

import { useEffect, useRef, useState } from 'react'

const PULL_THRESHOLD = 64
const MAX_PULL = 96
const RESISTANCE = 0.5
// 이 거리까지는 방향(세로/가로)을 확정하지 않는다 — 바로 preventDefault 하면
// TodayView의 "최근 태그" 가로 스크롤처럼 세로 성분이 살짝만 섞인 가로 스와이프도
// 매번 가로채 버린다.
const AXIS_LOCK_DISTANCE = 8

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>
  children: React.ReactNode
}

/**
 * 문서(body) 자체는 더 이상 스크롤되지 않으므로(globals.css의 .app-content 참조),
 * 당겨서 새로고침은 브라우저 기본 동작이 아니라 이 컴포넌트가 직접 그린다 —
 * scrollTop === 0 일 때만 당김을 추적해 리스트 중간 스크롤과 섞이지 않게 한다.
 */
export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'dragging' | 'refreshing'>('idle')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let startX = 0
    let startY: number | null = null
    let tracking = false
    let axis: 'unknown' | 'vertical' | 'horizontal' = 'unknown'
    let currentPull = 0
    let refreshing = false

    const reset = () => {
      tracking = false
      startY = null
      axis = 'unknown'
      currentPull = 0
      setPull(0)
      setPhase('idle')
    }

    const onStart = (e: TouchEvent) => {
      // 모달(태그 피커·목표 시트 등) 위에서 시작한 터치는 그 모달 자신의 스크롤/
      // 제스처에 맡긴다 — 여기서 가로채면 모달 내부 리스트가 안 움직이거나,
      // 놓았을 때 remount로 모달이 통째로 닫혀버린다.
      const target = e.target
      if (
        refreshing ||
        e.touches.length !== 1 ||
        el.scrollTop > 0 ||
        (target instanceof Element && target.closest('[data-modal-overlay]'))
      ) {
        startY = null
        tracking = false
        return
      }
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      tracking = true
      axis = 'unknown'
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking || startY === null || e.touches.length !== 1) {
        reset()
        return
      }
      if (el.scrollTop > 0) {
        reset()
        return
      }
      const touch = e.touches[0]
      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      if (axis === 'unknown') {
        if (Math.abs(deltaX) < AXIS_LOCK_DISTANCE && Math.abs(deltaY) < AXIS_LOCK_DISTANCE) return
        axis = Math.abs(deltaY) > Math.abs(deltaX) ? 'vertical' : 'horizontal'
        if (axis === 'horizontal') {
          // 이미 진행 중인 가로 스크롤을 우리가 막지 않도록 여기서 손을 뗀다 —
          // 지금까지 preventDefault를 한 번도 안 불렀으므로 브라우저 기본 동작이
          // 그대로 이어진다.
          tracking = false
          startY = null
          return
        }
      }

      if (deltaY <= 0) {
        currentPull = 0
        setPull(0)
        setPhase('idle')
        return
      }
      // 이 시점부턴 우리가 당김 거리를 직접 그리므로, 브라우저 기본 러버밴드가
      // 동시에 끼어들어 이중으로 움직이지 않도록 막는다(passive:false 필요).
      e.preventDefault()
      currentPull = Math.min(deltaY * RESISTANCE, MAX_PULL)
      setPull(currentPull)
      setPhase('dragging')
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      startY = null
      if (currentPull >= PULL_THRESHOLD) {
        refreshing = true
        setPhase('refreshing')
        setPull(PULL_THRESHOLD)
        void onRefresh().finally(() => {
          refreshing = false
          currentPull = 0
          setPull(0)
          setPhase('idle')
        })
      } else {
        currentPull = 0
        setPull(0)
        setPhase('idle')
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [onRefresh])

  return (
    <div ref={containerRef} className="app-content">
      <div
        className="pull-indicator"
        style={{ height: pull, transition: phase === 'dragging' ? 'none' : 'height 200ms ease' }}
        aria-hidden="true"
      >
        {pull > 4 && <span className={`pull-spinner${phase === 'refreshing' ? ' pull-spinner--spin' : ''}`} />}
      </div>
      {children}
    </div>
  )
}
