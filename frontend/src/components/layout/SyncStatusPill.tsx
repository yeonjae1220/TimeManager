'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { useTagStore } from '@/store/tagStore'
import { isOnline, subscribeConnectivity } from '@/utils/connectivity'

/**
 * 동기화가 이 시간 안에 끝나면 표시하지 않는다. 빠른 망에서 매번 "동기화 중"이
 * 번쩍이면 오히려 불안정해 보인다 — 사용자가 캐시 값을 체감할 만큼 길어질 때만 알린다.
 */
export const SYNCING_REVEAL_DELAY_MS = 600

const subscribeOnline = (onChange: () => void) => subscribeConnectivity(() => onChange())
// 서버 렌더에는 연결 상태가 없다. 온라인으로 두면 표시가 없어 hydration 이 어긋나지 않는다.
const getServerOnline = () => true

/**
 * 화면 상단 가운데에 떠 있는 작은 상태 표시.
 * - 오프라인: 지금 보이는 값은 이 기기에 저장된 것이고, 조작은 복귀 후 동기화된다.
 * - 동기화 중: 캐시 값을 먼저 보여주고 서버 값을 받아오는 중이다(지연될 때만).
 *
 * 레이아웃 흐름 밖(position:fixed)에 띄운다 — 나타나고 사라질 때 아래 콘텐츠를
 * 밀어내면 "값이 바뀌는" 것보다 그 흔들림이 더 거슬린다.
 */
export default function SyncStatusPill() {
  const { t } = useI18n()
  const online = useSyncExternalStore(subscribeOnline, isOnline, getServerOnline)
  const isRefreshing = useTagStore((s) => s.isRefreshing)
  const [showSyncing, setShowSyncing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) {
      setShowSyncing(false)
      return
    }
    const timer = setTimeout(() => setShowSyncing(true), SYNCING_REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isRefreshing])

  const status = !online ? 'offline' : showSyncing ? 'syncing' : null
  if (!status) return null

  return (
    <div className={`sync-pill sync-pill--${status}`} role="status" aria-live="polite">
      <span className="sync-pill-dot" aria-hidden="true" />
      <span className="mono">{t(status === 'offline' ? 'sync.offline' : 'sync.syncing')}</span>
    </div>
  )
}
