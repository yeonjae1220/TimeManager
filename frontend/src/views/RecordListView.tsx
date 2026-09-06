'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import EditRecordModal from '@/components/EditRecordModal'
import AddRecordModal from '@/components/AddRecordModal'
import { useTagStore } from '@/store/tagStore'
import apiClient from '@/utils/apiClient'
import DayOffsetBadge from '@/components/DayOffsetBadge'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/index'

interface Record {
  id: number
  totalTime: number
  startTime: string
  endTime: string
}

interface Tag {
  id: number
  name: string
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00'
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ────────────────────────────────────────────────────────────
// Undo toast
// ────────────────────────────────────────────────────────────

interface UndoToastProps {
  onUndo: () => void
  onDismiss: () => void
}

function UndoToast({ onUndo, onDismiss }: UndoToastProps) {
  const { t } = useI18n()
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-floating)', zIndex: 300, whiteSpace: 'nowrap' }}>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('records.deleted')}</span>
      <button
        onClick={onUndo}
        className="mono"
        style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {t('common.undo')}
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

export default function RecordListView() {
  const params = useParams()
  const router = useRouter()
  const { t, language } = useI18n()
  const tagId = Number(params?.id)
  const tagTree = useTagStore((s) => s.tagTree)
  const loadTags = useTagStore((s) => s.loadTags)

  const [tag, setTag] = useState<Tag | null>(null)
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  // 최초 로드에서만 페이지 본문 스피너를 보여준다 — pull-to-refresh 로 다시
  // 불러올 때는 PullToRefresh 자체 인디케이터가 이미 그 역할을 하므로, 여기서도
  // 같이 돌면 스피너가 두 개 겹쳐 보인다.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  // 실패를 번역된 문자열이 아니라 **메시지 키**로 들고 있는다. 번역을 렌더 시점으로
  // 미루면 fetchRecords 가 t 를 붙잡지 않아 언어 전환이 재조회를 일으키지 않고,
  // 이미 떠 있는 에러 문구도 전환 즉시 새 언어로 다시 그려진다.
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null)
  const [editingRecord, setEditingRecord] = useState<Record | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Undo state
  const [undoVisible, setUndoVisible] = useState(false)
  const undoDataRef = useRef<{ record: Record; index: number } | null>(null)

  const fetchRecords = useCallback(async () => {
    if (!tagId) return
    setLoading(true)
    try {
      const [tagRes, recRes] = await Promise.all([
        apiClient.get<Tag>(`/api/v1/tags/${tagId}`),
        apiClient.get<Record[]>(`/api/v1/records?tagId=${tagId}`),
      ])
      setTag(tagRes.data)
      setRecords(recRes.data)
      setErrorKey(null)
    } catch {
      setErrorKey('records.loadFail')
    } finally {
      setLoading(false)
      setHasLoadedOnce(true)
    }
  }, [tagId])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // Load tagTree for modals
  useEffect(() => {
    const memberId = tag ? (tag as unknown as { memberId?: number }).memberId : undefined
    if (memberId) loadTags(memberId)
  }, [tag, loadTags])

  async function handleDelete(record: Record, index: number) {
    if (!confirm(t('records.deleteConfirm'))) return

    setRecords((prev) => prev.filter((r) => r.id !== record.id))
    undoDataRef.current = { record, index }
    setUndoVisible(true)

    try {
      await apiClient.delete(`/api/v1/records/${record.id}`)
    } catch {
      // Revert on server error
      handleUndoInternal(record, index)
    }
  }

  function handleUndoInternal(record: Record, index: number) {
    setRecords((prev) => {
      const next = [...prev]
      next.splice(index, 0, record)
      return next
    })
    setUndoVisible(false)
  }

  function handleUndo() {
    const data = undoDataRef.current
    if (!data) return
    handleUndoInternal(data.record, data.index)
    undoDataRef.current = null
    // Re-create on server
    apiClient.post('/api/v1/records', {
      tagId,
      newStartTime: data.record.startTime,
      newEndTime: data.record.endTime,
      forceOverwrite: true,
    }).catch(() => {})
  }

  return (
    <AppShell onRefresh={fetchRecords}>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
          <button
            onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', padding: '12px 8px', margin: '-12px -8px', minHeight: 44 }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('common.back')}
          </button>
        </div>

        <div style={{ padding: '24px 0' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            {t('records.tagLabel')} · {tagId}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28 }}>
              {tag?.name ?? t('records.title')}
            </h1>
            <button
              onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 10px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {t('common.add')}
            </button>
          </div>

          {loading && !hasLoadedOnce && <div className="spinner" style={{ margin: '40px auto' }} />}
          {errorKey && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{t(errorKey)}</p>}
          {!loading && records.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('records.empty')}</p>
          )}

          <div>
            {records.map((record, idx) => {
              const start = new Date(record.startTime)
              const end = new Date(record.endTime)
              // 행에 찍히는 날짜는 시작 시각의 것 하나뿐이라, 자정을 넘긴 기록은
              // `23:00 → 01:30` 처럼 시간이 거꾸로 흐른 것처럼 읽힌다. 편집 모달은
              // start/end 날짜를 따로 보여주는데 목록만 그 사실을 숨기고 있었다.
              return (
              <div
                key={record.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 13 }}>{formatTime(record.totalTime)}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {start.toLocaleDateString(language)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
                    <span className="mono">{start.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>→</span>
                    <span className="mono">
                      {end.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                      <DayOffsetBadge start={start} end={end} language={language} />
                    </span>
                  </div>
                </div>
                {/* Edit */}
                <button
                  onClick={() => setEditingRecord(record)}
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px 6px', flexShrink: 0 }}
                >
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                  </svg>
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleDelete(record, idx)}
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px 6px', flexShrink: 0 }}
                >
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M2 3h8M5 3V2h2v1M4 3v6M8 3v6M3 3l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              )
            })}
          </div>
        </div>
      </div>

      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          tagTree={tagTree}
          currentTagId={tagId}
          onClose={() => setEditingRecord(null)}
          onSaved={fetchRecords}
        />
      )}

      {showAdd && (
        <AddRecordModal
          tagTree={tagTree}
          defaultTagId={tagId}
          onClose={() => setShowAdd(false)}
          onSaved={fetchRecords}
        />
      )}

      {undoVisible && (
        <UndoToast
          onUndo={handleUndo}
          onDismiss={() => setUndoVisible(false)}
        />
      )}
    </AppShell>
  )
}
