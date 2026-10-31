'use client'

import { useRef, useState } from 'react'
import { recordDefaults, wallTime, wallTimeToIso } from '@/utils/recordDateTime'
import RecordOverlapList, { type RecordConflict } from './RecordOverlapList'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import TagPickerModal from '@/components/TagPickerModal'
import { useTagStore, type Tag } from '@/store/tagStore'
import { writeRecord } from '@/utils/recordMutations'
import { useI18n } from '@/i18n/I18nProvider'
import ModalPortal from './ModalPortal'

interface AddRecordModalProps {
  tagTree: Tag[]
  defaultTagId?: number
  defaultDate?: string
  initialTimes?: { start: string; end: string }
  resetHour?: number
  timezone?: string
  onClose: () => void
  onSaved: (tagId: number) => void | Promise<void>
}

export default function AddRecordModal({ tagTree, defaultTagId, defaultDate, initialTimes, resetHour, timezone, onClose, onSaved }: AddRecordModalProps) {
  const { t } = useI18n()
  const [defaults] = useState(() => initialTimes ? { start: wallTime(new Date(initialTimes.start), timezone), end: wallTime(new Date(initialTimes.end), timezone) } : recordDefaults(defaultDate, resetHour, timezone))
  const busy = useRef(false)
  const [tagId, setTagId] = useState<number | null>(defaultTagId ?? null)
  const [startTime, setStartTime] = useState(defaults.start)
  const [endTime, setEndTime] = useState(defaults.end)
  const [conflicts, setConflicts] = useState<RecordConflict[]>([])
  const [overlapToken, setOverlapToken] = useState<string>()
  const [saved, setSaved] = useState(false)
  function clearConflict() { setConflicts([]); setOverlapToken(undefined); setError('') }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, onClose, saving)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const findById = useTagStore((s) => s.findById)

  const selectedTag = tagId ? findById(tagId) : null

  async function handleSave(forceOverwrite = false) {
    if (busy.current || saved) return
    if (!tagId) { setError(t('addRecord.selectTagError')); return }
    let start: string, end: string
    try {
      start = wallTimeToIso(startTime, timezone, initialTimes?.start)
      end = wallTimeToIso(endTime, timezone, initialTimes?.end)
      if (start >= end) throw new Error()
    } catch { setError(t('editRecord.invalidRange')); return }
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const outcome = await writeRecord('post', '/api/v1/records', {
        tagId, newStartTime: start, newEndTime: end, forceOverwrite,
        overlapToken: forceOverwrite ? overlapToken : undefined,
      })
      if (outcome === 'pending') { onClose(); return }
      setSaved(true)
      try { await onSaved(tagId); onClose() }
      catch { setError(t('record.refreshFailed')) }
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { code?: string; message?: string; recordsToDelete?: RecordConflict[]; overlapToken?: string } } })?.response?.data
      if (data?.code === 'RECORD_OVERLAP') {
        setConflicts(data.recordsToDelete ?? [])
        setOverlapToken(data.overlapToken)
      }
      setError(data?.message ?? (data?.code === 'RECORD_OVERLAP' ? t('editRecord.overlapHint') : t('record.saveUncertain')))
    } finally { busy.current = false; setSaving(false) }
  }

  function preset(minutes: number) {
    try {
      const start = new Date(wallTimeToIso(startTime, timezone, initialTimes?.start))
      setEndTime(wallTime(new Date(start.getTime() + minutes * 60_000), timezone))
      clearConflict()
    } catch { setError(t('editRecord.invalidRange')) }
  }

  return (
    <ModalPortal>
    <div
      data-modal-overlay
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'blur(2px)', padding: 20 }}
      onClick={(e) => !saving && e.target === e.currentTarget && onClose()}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('addRecord.title')} style={{ maxHeight: '90dvh', overflowY: 'auto', width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: 'var(--shadow-modal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t('addRecord.title')}</span>
          <button aria-label={t('common.cancel')} disabled={saving} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.tag')}</label>
          <button
            disabled={saving || saved} onClick={() => setShowTagPicker(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--input-bg)', border: `1px solid ${!tagId && error ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: tagId ? 'var(--text)' : 'var(--text-3)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ flex: 1 }}>{selectedTag?.name ?? t('today.selectTag')}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.start')}</label>
          <input aria-label={t('field.start')} disabled={saving || saved} type="datetime-local" value={startTime} onChange={(e) => { setStartTime(e.target.value); clearConflict() }} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.end')}</label>
          <input aria-label={t('field.end')} disabled={saving || saved} type="datetime-local" value={endTime} onChange={(e) => { setEndTime(e.target.value); clearConflict() }} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
        </div>

        <p className="mono">{timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        <div style={{ display: 'flex', gap: 8 }}>{[15, 30, 60].map((minutes) => <button disabled={saving || saved} key={minutes} onClick={() => preset(minutes)}>{minutes} min</button>)}</div>
        {conflicts.length > 0 && <RecordOverlapList records={conflicts} timezone={timezone} />}
        {conflicts.length > 0 && overlapToken && <button disabled={saving || saved} onClick={() => handleSave(true)}>{t('addRecord.forceOverwrite')}</button>}

        {error && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button disabled={saving} onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
          <button
            onClick={() => handleSave()}
            disabled={saving || saved}
            style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving ? 0.4 : 1 }}
          >
            {saving ? '...' : t('common.add')}
          </button>
        </div>
      </div>

      {showTagPicker && (
        <TagPickerModal
          tagTree={tagTree}
          currentTagId={tagId}
          onSelect={(id) => { setTagId(id); clearConflict(); setShowTagPicker(false) }}
          onClose={() => setShowTagPicker(false)}
        />
      )}
    </div>
    </ModalPortal>
  )
}
