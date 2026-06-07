'use client'

import { useMemo, useState } from 'react'
import TagPickerModal from '@/components/TagPickerModal'
import { useTagStore, type Tag } from '@/store/tagStore'
import apiClient from '@/utils/apiClient'
import { useI18n } from '@/i18n/I18nProvider'

interface Record {
  id: number
  totalTime: number
  startTime: string
  endTime: string
}

interface EditRecordModalProps {
  record: Record
  tagTree: Tag[]
  currentTagId: number
  onClose: () => void
  onSaved: () => void
}

interface ApiErrorData {
  code?: string
  message?: string
  error?: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function toLocalDate(date: string, time: string): Date | null {
  if (!date || !time) return null
  const d = new Date(`${date}T${time}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

function getDurationSeconds(startDate: string, startTime: string, endDate: string, endTime: string): number | null {
  const start = toLocalDate(startDate, startTime)
  const end = toLocalDate(endDate, endTime)
  if (!start || !end) return null
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
  return seconds > 0 ? seconds : null
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toTimeInputValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function shiftDateTime(date: string, time: string, minutes: number): { date: string; time: string } {
  const [hour, minute] = time.split(':').map(Number)
  if (!date || !Number.isFinite(hour) || !Number.isFinite(minute)) return { date, time }
  const d = new Date(`${date}T${pad(hour)}:${pad(minute)}:00`)
  if (Number.isNaN(d.getTime())) return { date, time }
  d.setMinutes(d.getMinutes() + minutes)
  return {
    date: toDateInputValue(d),
    time: toTimeInputValue(d),
  }
}

function dateRangeLabel(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`
}

export default function EditRecordModal({ record, tagTree, currentTagId, onClose, onSaved }: EditRecordModalProps) {
  const { t } = useI18n()
  const initialStart = toLocalParts(record.startTime)
  const initialEnd = toLocalParts(record.endTime)
  const [startDate, setStartDate] = useState(initialStart.date)
  const [endDate, setEndDate] = useState(initialEnd.date)
  const [startClock, setStartClock] = useState(initialStart.time)
  const [endClock, setEndClock] = useState(initialEnd.time)
  const [newTagId, setNewTagId] = useState<number>(currentTagId)
  const [showOverwriteOption, setShowOverwriteOption] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const findById = useTagStore((s) => s.findById)

  const selectedTag = findById(newTagId)
  const durationSeconds = useMemo(() => getDurationSeconds(startDate, startClock, endDate, endClock), [startDate, startClock, endDate, endClock])
  const isValidRange = durationSeconds !== null

  function resetOverwritePrompt() {
    setShowOverwriteOption(false)
    setError('')
  }

  async function handleSave(forceOverwrite = false) {
    if (!isValidRange) {
      setShowOverwriteOption(false)
      setError(t('editRecord.invalidRange'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiClient.put(`/api/v1/records/${record.id}`, {
        newStartTime: toIso(startDate, startClock),
        newEndTime: toIso(endDate, endClock),
        newTagId: newTagId !== currentTagId ? newTagId : undefined,
        forceOverwrite,
      })
      onSaved()
      onClose()
    } catch (e: unknown) {
      const data = (e as { response?: { data?: ApiErrorData } })?.response?.data
      if (data?.code === 'RECORD_OVERLAP' && !forceOverwrite) {
        setShowOverwriteOption(true)
        setError(t('editRecord.overlapHint'))
        return
      }
      setShowOverwriteOption(false)
      setError(data?.message ?? data?.error ?? t('common.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'blur(2px)', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: 'var(--shadow-modal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t('editRecord.title')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '14px 0', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t('editRecord.summary')}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{formatDuration(durationSeconds)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <strong style={{ minWidth: 0, fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedTag?.name ?? t('editRecord.selectTag')}
            </strong>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{dateRangeLabel(startDate, endDate)}</span>
          </div>
          <div className="mono" style={{ fontSize: 13, color: isValidRange ? 'var(--text-2)' : 'var(--danger)' }}>
            {startClock} → {endClock}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.tag')}</label>
          <button
            onClick={() => { resetOverwritePrompt(); setShowTagPicker(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ flex: 1 }}>{selectedTag?.name ?? t('editRecord.selectTag')}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('editRecord.startTime')}</label>
            <input type="date" value={startDate} onChange={(e) => { resetOverwritePrompt(); setStartDate(e.target.value) }} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <input type="time" value={startClock} onChange={(e) => { resetOverwritePrompt(); setStartClock(e.target.value) }} style={{ background: 'var(--input-bg)', border: `1px solid ${isValidRange ? 'var(--border)' : 'var(--danger)'}`, borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(startDate, startClock, -5); setStartDate(next.date); setStartClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.minusFive')}</button>
              <button onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(startDate, startClock, 5); setStartDate(next.date); setStartClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.plusFive')}</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('editRecord.endTime')}</label>
            <input type="date" value={endDate} onChange={(e) => { resetOverwritePrompt(); setEndDate(e.target.value) }} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <input type="time" value={endClock} onChange={(e) => { resetOverwritePrompt(); setEndClock(e.target.value) }} style={{ background: 'var(--input-bg)', border: `1px solid ${isValidRange ? 'var(--border)' : 'var(--danger)'}`, borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(endDate, endClock, -5); setEndDate(next.date); setEndClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.minusFive')}</button>
              <button onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(endDate, endClock, 5); setEndDate(next.date); setEndClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.plusFive')}</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('editRecord.duration')}</span>
          <strong className="mono" style={{ minWidth: 0, fontSize: 13, color: isValidRange ? 'var(--text)' : 'var(--danger)', textAlign: 'right', overflowWrap: 'anywhere' }}>
            {isValidRange ? formatDuration(durationSeconds) : t('editRecord.invalidRange')}
          </strong>
        </div>

        {error && <p className="mono" style={{ fontSize: 11, color: showOverwriteOption ? 'var(--warning, #f59e0b)' : 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {showOverwriteOption && (
              <button
                onClick={() => handleSave(true)}
                disabled={saving || !isValidRange}
                style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--warning, #f59e0b)', borderRadius: 'var(--radius)', color: 'var(--warning, #f59e0b)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving || !isValidRange ? 0.4 : 1 }}
              >
                {saving ? '...' : t('editRecord.saveWithOverwrite')}
              </button>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !isValidRange}
              style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving || !isValidRange ? 0.4 : 1 }}
            >
              {saving ? '...' : t('common.save')}
            </button>
          </div>
        </div>
      </div>

      {showTagPicker && (
        <TagPickerModal
          tagTree={tagTree}
          currentTagId={newTagId}
          onSelect={(id) => { resetOverwritePrompt(); setNewTagId(id); setShowTagPicker(false) }}
          onClose={() => setShowTagPicker(false)}
        />
      )}
    </div>
  )
}
