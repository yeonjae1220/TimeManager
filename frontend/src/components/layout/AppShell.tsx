'use client'

import { useCallback, useState } from 'react'
import TabBar from './TabBar'
import PullToRefresh from './PullToRefresh'

interface AppShellProps {
  children: React.ReactNode
  isRunning?: boolean
}

// 당겨서 놓았을 때 최소 이 정도는 스피너가 보여야 "새로고침이 일어났다"는
// 느낌을 준다 — remount 자체는 순간적이라, 이게 없으면 빠른 네트워크에서
// 깜빡임 없이 그냥 사라져 아무 반응이 없었던 것처럼 느껴진다.
const MIN_REFRESH_VISIBLE_MS = 400

export default function AppShell({ children, isRunning = false }: AppShellProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  // 뷰마다 개별 reload 콜백을 연결하는 대신 컨텐츠를 다시 mount 시킨다 — 각 뷰의
  // 데이터 조회는 이미 mount effect 하나에 있으므로, 새로고침 로직이 그 effect와
  // 어긋날 일이 없다(LogsView처럼 활성 하위 탭이 여러 개인 화면도 그대로 커버됨).
  const handleRefresh = useCallback(async () => {
    setRefreshKey((k) => k + 1)
    await new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_VISIBLE_MS))
  }, [])

  return (
    <div className="app-shell">
      <PullToRefresh onRefresh={handleRefresh}>
        <div key={refreshKey}>{children}</div>
      </PullToRefresh>
      <TabBar isRunning={isRunning} />
    </div>
  )
}
