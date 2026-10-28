'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useRunningTimerStore } from '@/store/runningTimerStore'
import { useI18n } from '@/i18n/I18nProvider'
import { stopTimer } from '@/utils/timerActions'
import { peekPendingTimerOperations } from '@/utils/timerPersistence'
import { fmtHMS } from '@/views/logs/shared'

export default function MiniTimer({ selectedTagId }: { selectedTagId?: number }) {
  const { t } = useI18n()
  const memberId = useAuthStore((s) => s.memberId)
  const { session, busy } = useRunningTimerStore()
  const pathname = usePathname()
  const [now, setNow] = useState(0)
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id) }, [])
  if (!memberId || !session || (pathname?.endsWith('/today') && selectedTagId === session.tagId)) return null
  const elapsed = session.baseElapsedSec + Math.max(0, Math.floor(((now || session.startedAtMs) - session.startedAtMs) / 1000))
  return <aside className="mini-timer" aria-label={t('today.elapsed')}>
    <Link href={`/members/${memberId}/today?tagId=${session.tagId}`} style={{ flex: 1, minWidth: 0 }}>
      <span>{session.tagName || t('notif.untitledTag')}</span> <span className="mono">{fmtHMS(elapsed)}</span>
      {peekPendingTimerOperations().length > 0 && <small role="status"> · {t('timer.pending')}</small>}
    </Link>
    <button disabled={busy} onClick={() => void stopTimer(session)}>{t('today.stopCta')}</button>
  </aside>
}
