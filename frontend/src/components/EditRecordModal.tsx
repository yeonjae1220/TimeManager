'use client'

import { useState } from 'react'
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

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIso(local: string): string {
  return new Date(local).toISOString()
}

export default function EditRecordModal({ record, tagTree, currentTagId, onClose, onSaved }: EditRecordModalProps) {
  const { t } = useI18n()
  const [startTime, setStartTime] = useState(toDatetimeLocal(record.startTime))
  const [endTime, setEndTime] = useState(toDatetimeLocal(record.endTime))
  const [newTagId, setNewTagId] = useState<number>(currentTagId)
  const [forceOverwrite, setForceOverwrite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const findById = useTagStore((s) => s.findById)

  const selectedTag = findById(newTagId)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await apiClient.put(`/api/v1/records/${record.id}`, {
        newStartTime: toIso(startTime),
        newEndTime: toIso(endTime),
        newTagId: newTagId !== currentTagId ? newTagId : undefined,
        forceOverwrite,
      })
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? t('common.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'blur(2px)', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: 'var(--shadow-modal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t('editRecord.title')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.tag')}</label>
          <button
            onClick={() => setShowTagPicker(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ flex: 1 }}>{selectedTag?.name ?? t('editRecord.selectTag')}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.start')}</label>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.end')}</label>
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={forceOverwrite} onChange={(e) => setForceOverwrite(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('addRecord.forceOverwrite')}</span>
        </label>

        {error && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving ? 0.4 : 1 }}
          >
            {saving ? '...' : t('common.save')}
          </button>
        </div>
      </div>

      {showTagPicker && (
        <TagPickerModal
          tagTree={tagTree}
          currentTagId={newTagId}
          onSelect={(id) => { setNewTagId(id); setShowTagPicker(false) }}
          onClose={() => setShowTagPicker(false)}
        />
      )}
    </div>
  )
}
