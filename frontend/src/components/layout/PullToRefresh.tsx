'use client'

import { useEffect, useRef, useState } from 'react'

const PULL_THRESHOLD = 64
const MAX_PULL = 96
const RESISTANCE = 0.5

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

    let startY: number | null = null
    let tracking = false
    let currentPull = 0
    let refreshing = false

    const onStart = (e: TouchEvent) => {
      if (refreshing || el.scrollTop > 0) {
        startY = null
        tracking = false
        return
      }
      startY = e.touches[0].clientY
      tracking = true
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking || startY === null) return
      if (el.scrollTop > 0) {
        tracking = false
        startY = null
        currentPull = 0
        setPull(0)
        setPhase('idle')
        return
      }
      const delta = e.touches[0].clientY - startY
      if (delta <= 0) {
        currentPull = 0
        setPull(0)
        setPhase('idle')
        return
      }
      // 이 시점부턴 우리가 당김 거리를 직접 그리므로, 브라우저 기본 러버밴드가
      // 동시에 끼어들어 이중으로 움직이지 않도록 막는다(passive:false 필요).
      e.preventDefault()
      currentPull = Math.min(delta * RESISTANCE, MAX_PULL)
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
