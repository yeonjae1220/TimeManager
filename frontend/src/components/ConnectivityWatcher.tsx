'use client'

import { useEffect } from 'react'

import { probeNow } from '@/utils/connectivity'

/**
 * 앱이 다시 보이는 순간 연결 상태를 즉시 확인한다.
 *
 * <b>어느 화면에 있든</b> 동작해야 하므로 레이아웃 최상단에 둔다. 오프라인 동안 probe 는
 * 화면이 숨겨지면 스스로 멈추는데(배터리), 그 체인을 되살리는 건 이 리스너뿐이다.
 * 예전에는 이 리스너가 TodayView 안에만 있어서, 통계·프로필 화면에서 오프라인이 된 뒤
 * 앱을 껐다 켜면 복귀 감지가 죽은 채로 남았다 — 어떤 API 요청이 실패해
 * reportUnreachable 이 불릴 때까지 아무도 다시 확인하지 않았다.
 *
 * 화면을 그리지 않는다. 상태 구독(배너 표시·큐 재전송)은 그 상태가 필요한 화면이 한다.
 */
export function ConnectivityWatcher() {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') probeNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return null
}
