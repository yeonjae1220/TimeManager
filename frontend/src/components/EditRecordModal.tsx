'use client'

import { useMemo, useRef, useState } from 'react'
import { wallTime, wallTimeToIso } from '@/utils/recordDateTime'
import RecordOverlapList, { type RecordConflict } from './RecordOverlapList'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import TagPickerModal from '@/components/TagPickerModal'
import { useTagStore, type Tag } from '@/store/tagStore'
import { writeRecord } from '@/utils/recordMutations'
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
  timezone?: string
  initialRecordToken?: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}

interface ApiErrorData {
  recordsToDelete?: RecordConflict[]
  overlapToken?: string
  code?: string
  message?: string
  error?: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
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

export default function EditRecordModal({ record, tagTree, currentTagId, timezone, initialRecordToken, onClose, onSaved }: EditRecordModalProps) {
  const { t } = useI18n()
  const [initialStart] = useState(() => { const [date, time] = wallTime(new Date(record.startTime), timezone).split('T'); return { date, time } })
  const [initialEnd] = useState(() => { const [date, time] = wallTime(new Date(record.endTime), timezone).split('T'); return { date, time } })
  const [startDate, setStartDate] = useState(initialStart.date)
  const [endDate, setEndDate] = useState(initialEnd.date)
  const [startClock, setStartClock] = useState(initialStart.time)
  const [endClock, setEndClock] = useState(initialEnd.time)
  const [newTagId, setNewTagId] = useState<number>(currentTagId)
  const busy = useRef(false)
  const [saved, setSaved] = useState(false)
  const [conflicts, setConflicts] = useState<RecordConflict[]>([])
  const [overlapToken, setOverlapToken] = useState<string>()
  const [showOverwriteOption, setShowOverwriteOption] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, onClose, saving)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const findById = useTagStore((s) => s.findById)

  const selectedTag = findById(newTagId)
  const durationSeconds = useMemo(() => {
    try {
      const seconds = (Date.parse(wallTimeToIso(endDate + 'T' + endClock, timezone, record.endTime)) - Date.parse(wallTimeToIso(startDate + 'T' + startClock, timezone, record.startTime))) / 1000
      return seconds > 0 ? seconds : null
    } catch { return null }
  }, [startDate, startClock, endDate, endClock, timezone, record.startTime, record.endTime])
  const isValidRange = durationSeconds !== null

  function resetOverwritePrompt() {
    setShowOverwriteOption(false)
    setConflicts([])
    setOverlapToken(undefined)
    setError('')
  }

  async function handleSave(forceOverwrite = false) {
    if (busy.current || saved) return
    if (!isValidRange) {
      setShowOverwriteOption(false)
      setError(t('editRecord.invalidRange'))
      return
    }
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const outcome = await writeRecord('put', `/api/v1/records/${record.id}`, {
        newStartTime: wallTimeToIso(startDate + 'T' + startClock, timezone, record.startTime),
        newEndTime: wallTimeToIso(endDate + 'T' + endClock, timezone, record.endTime),
        newTagId,
        recordToken: initialRecordToken ?? `${record.id}:${currentTagId}:${Date.parse(record.startTime)}:${Date.parse(record.endTime)}`,
        forceOverwrite,
        overlapToken: forceOverwrite ? overlapToken : undefined,
      })
      if (outcome === 'pending') { onClose(); return }
      setSaved(true)
      try { await onSaved(); onClose() } catch { setError(t('record.refreshFailed')) }
    } catch (e: unknown) {
      const data = (e as { response?: { data?: ApiErrorData } })?.response?.data
      if (data?.code === 'RECORD_OVERLAP') {
        setConflicts(data.recordsToDelete ?? [])
        setOverlapToken(data.overlapToken)
        setShowOverwriteOption(true)
        setError(t('editRecord.overlapHint'))
        return
      }
      setShowOverwriteOption(false)
      setError(data?.code === 'RECORD_CHANGED' ? t('record.changed') : data?.message ?? data?.error ?? t('record.saveUncertain'))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <div
      data-modal-overlay
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'blur(2px)', padding: 20 }}
      onClick={(e) => !saving && e.target === e.currentTarget && onClose()}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('editRecord.title')} style={{ maxHeight: '90dvh', overflowY: 'auto', width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: 'var(--shadow-modal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t('editRecord.title')}</span>
          <button aria-label={t('common.cancel')} disabled={saving} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
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
            disabled={saving || saved}
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
            <input aria-label={t('field.start') + ' date'} disabled={saving || saved} type="date" value={startDate} onChange={(e) => { resetOverwritePrompt(); setStartDate(e.target.value) }} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <input aria-label={t('editRecord.startTime')} disabled={saving || saved} type="time" value={startClock} onChange={(e) => { resetOverwritePrompt(); setStartClock(e.target.value) }} style={{ background: 'var(--input-bg)', border: `1px solid ${isValidRange ? 'var(--border)' : 'var(--danger)'}`, borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button disabled={saving || saved} onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(startDate, startClock, -5); setStartDate(next.date); setStartClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.minusFive')}</button>
              <button disabled={saving || saved} onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(startDate, startClock, 5); setStartDate(next.date); setStartClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.plusFive')}</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('editRecord.endTime')}</label>
            <input aria-label={t('field.end') + ' date'} disabled={saving || saved} type="date" value={endDate} onChange={(e) => { resetOverwritePrompt(); setEndDate(e.target.value) }} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <input aria-label={t('editRecord.endTime')} disabled={saving || saved} type="time" value={endClock} onChange={(e) => { resetOverwritePrompt(); setEndClock(e.target.value) }} style={{ background: 'var(--input-bg)', border: `1px solid ${isValidRange ? 'var(--border)' : 'var(--danger)'}`, borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button disabled={saving || saved} onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(endDate, endClock, -5); setEndDate(next.date); setEndClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.minusFive')}</button>
              <button disabled={saving || saved} onClick={() => { resetOverwritePrompt(); const next = shiftDateTime(endDate, endClock, 5); setEndDate(next.date); setEndClock(next.time) }} className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{t('editRecord.plusFive')}</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('editRecord.duration')}</span>
          <strong className="mono" style={{ minWidth: 0, fontSize: 13, color: isValidRange ? 'var(--text)' : 'var(--danger)', textAlign: 'right', overflowWrap: 'anywhere' }}>
            {isValidRange ? formatDuration(durationSeconds) : t('editRecord.invalidRange')}
          </strong>
        </div>

        <p>{timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        {conflicts.length > 0 && <RecordOverlapList records={conflicts} timezone={timezone} />}
        {error && <p className="mono" style={{ fontSize: 11, color: showOverwriteOption ? 'var(--warning, #f59e0b)' : 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button disabled={saving} onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {showOverwriteOption && overlapToken && (
              <button
                onClick={() => handleSave(true)}
                disabled={saving || saved || !isValidRange}
                style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--warning, #f59e0b)', borderRadius: 'var(--radius)', color: 'var(--warning, #f59e0b)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving || !isValidRange ? 0.4 : 1 }}
              >
                {saving ? '...' : t('editRecord.saveWithOverwrite')}
              </button>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || saved || !isValidRange}
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
