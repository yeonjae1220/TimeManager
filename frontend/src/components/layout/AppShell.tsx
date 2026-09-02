'use client'

import { useCallback, useState } from 'react'
import TabBar from './TabBar'
import PullToRefresh from './PullToRefresh'

interface AppShellProps {
  children: React.ReactNode
  isRunning?: boolean
  // 뷰 자신의 데이터 조회 effect는 그 뷰 컴포넌트(AppShell을 호출하는 쪽)에
  // 있으므로, AppShell이 children만 remount해선 그 effect에 닿지 않는다
  // (LogsView 예외 — 아래 참조). 진짜로 재조회시키려면 뷰가 자신의 reload
  // 함수를 이 prop으로 넘겨야 한다.
  onRefresh?: () => Promise<unknown>
}

// 당겨서 놓았을 때 최소 이 정도는 스피너가 보여야 "새로고침이 일어났다"는
// 느낌을 준다 — 특히 remount만으로 처리되는 경우 그 자체는 순간적이라, 이게
// 없으면 빠른 네트워크에서 깜빡임 없이 그냥 사라져 아무 반응이 없었던 것처럼
// 느껴진다.
const MIN_REFRESH_VISIBLE_MS = 400

export default function AppShell({ children, isRunning = false, onRefresh }: AppShellProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  // onRefresh가 있으면 그 뷰의 실제 reload 함수를 부른다. 없으면(LogsView처럼
  // 활성 하위 탭 컴포넌트 자체가 children으로 들어와 자기 mount effect로
  // 조회하는 경우) children을 remount해 그 mount effect를 다시 태운다.
  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh()
    } else {
      setRefreshKey((k) => k + 1)
      await new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_VISIBLE_MS))
    }
  }, [onRefresh])

  return (
    <div className="app-shell">
      <PullToRefresh onRefresh={handleRefresh}>
        <div key={onRefresh ? 'static' : refreshKey}>{children}</div>
      </PullToRefresh>
      <TabBar isRunning={isRunning} />
    </div>
  )
}
