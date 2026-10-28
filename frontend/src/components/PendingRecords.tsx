'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { isOnline, subscribeConnectivity } from '@/utils/connectivity'
import { isRecordReplayRunning, readPendingRecords, removePendingRecord, retryRecordWrites, type PendingRecord } from '@/utils/recordMutations'
import Link from 'next/link'
import AddRecordModal from './AddRecordModal'
import EditRecordModal from './EditRecordModal'
import { useTagStore } from '@/store/tagStore'
import { useDailyResetHour } from '@/hooks/useDailyResetHour'

export default function PendingRecords() {
  const memberId = useAuthStore((s) => s.memberId)
  return memberId ? <MemberPendingRecords key={memberId} memberId={memberId} /> : null
}

function MemberPendingRecords({ memberId }: { memberId: number }) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<PendingRecord[]>([])
  const [editing, setEditing] = useState<PendingRecord | null>(null)
  const [replaying, setReplaying] = useState(false)
  const tagTree = useTagStore((s) => s.tagTree)
  const { timezone } = useDailyResetHour(memberId)
  useEffect(() => {
    if (!memberId) { setEntries([]); return }
    const refresh = () => { setEntries(readPendingRecords(memberId)); setReplaying(isRecordReplayRunning()) }
    const retry = () => { if (isOnline() && document.visibilityState === 'visible') void retryRecordWrites(memberId) }
    const unsubscribe = subscribeConnectivity((online) => { if (online) retry() })
    window.addEventListener('record-pending', refresh)
    document.addEventListener('visibilitychange', retry)
    refresh(); retry()
    return () => { unsubscribe(); window.removeEventListener('record-pending', refresh); document.removeEventListener('visibilitychange', retry) }
  }, [memberId])
  if (!memberId || entries.length === 0) return null
  const done = () => { if (editing) removePendingRecord(memberId, editing.id); setEditing(null) }
  return <section className="pending-records" aria-live="polite">
    <details><summary>{t('record.pending')} ({entries.length})</summary>
      {entries.map((entry) => <div key={entry.id}>
        <span>{entry.data.newStartTime} → {entry.data.newEndTime}</span>
        {entry.failed && <span role="alert"> {t('record.reviewRequired')}</span>}
        {entry.failed && entry.method === 'put' && <Link href={`/records/${entry.data.recordToken?.split(':')[1] ?? entry.data.newTagId}`}>{t('record.changed')}</Link>}
        <button disabled={replaying || !entry.failed || !timezone} onClick={() => setEditing(entry)}>{t('editRecord.title')}</button>
        <button disabled={replaying} onClick={() => { if (!isRecordReplayRunning() && confirm(t('common.delete') + '?')) removePendingRecord(memberId, entry.id) }}>{t('common.delete')}</button>
      </div>)}
      <button onClick={() => void retryRecordWrites(memberId)}>{t('common.retry')}</button>
    </details>
    {editing?.method === 'post' && <AddRecordModal tagTree={tagTree} timezone={timezone} defaultTagId={editing.data.tagId} initialTimes={{ start: editing.data.newStartTime, end: editing.data.newEndTime }} onClose={() => setEditing(null)} onSaved={done} />}
    {editing?.method === 'put' && <EditRecordModal record={{ id: Number(editing.path.split('/').at(-1)), startTime: editing.data.newStartTime, endTime: editing.data.newEndTime, totalTime: 0 }} tagTree={tagTree} currentTagId={editing.data.newTagId!} initialRecordToken={editing.data.recordToken} timezone={timezone} onClose={() => setEditing(null)} onSaved={done} />}
  </section>
}
