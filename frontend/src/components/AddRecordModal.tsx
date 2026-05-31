'use client'

import { useState } from 'react'
import TagPickerModal from '@/components/TagPickerModal'
import { useTagStore, type Tag } from '@/store/tagStore'
import apiClient from '@/utils/apiClient'

interface AddRecordModalProps {
  tagTree: Tag[]
  defaultTagId?: number
  onClose: () => void
  onSaved: () => void
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIso(local: string): string {
  return new Date(local).toISOString()
}

export default function AddRecordModal({ tagTree, defaultTagId, onClose, onSaved }: AddRecordModalProps) {
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 3600000)
  const [tagId, setTagId] = useState<number | null>(defaultTagId ?? null)
  const [startTime, setStartTime] = useState(toDatetimeLocal(hourAgo))
  const [endTime, setEndTime] = useState(toDatetimeLocal(now))
  const [forceOverwrite, setForceOverwrite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const findById = useTagStore((s) => s.findById)

  const selectedTag = tagId ? findById(tagId) : null

  async function handleSave() {
    if (!tagId) { setError('태그를 선택해주세요.'); return }
    setSaving(true)
    setError('')
    try {
      await apiClient.post('/api/v1/records', {
        tagId,
        newStartTime: toIso(startTime),
        newEndTime: toIso(endTime),
        forceOverwrite,
      })
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>add session</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>TAG</label>
          <button
            onClick={() => setShowTagPicker(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', border: `1px solid ${!tagId && error ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: tagId ? 'var(--text)' : 'var(--text-3)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ flex: 1 }}>{selectedTag?.name ?? '태그를 선택하세요'}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>START</label>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>END</label>
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={forceOverwrite} onChange={(e) => setForceOverwrite(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>겹치는 세션 강제 덮어쓰기</span>
        </label>

        {error && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving ? 0.4 : 1 }}
          >
            {saving ? '...' : 'Add'}
          </button>
        </div>
      </div>

      {showTagPicker && (
        <TagPickerModal
          tagTree={tagTree}
          currentTagId={tagId}
          onSelect={(id) => { setTagId(id); setShowTagPicker(false) }}
          onClose={() => setShowTagPicker(false)}
        />
      )}
    </div>
  )
}
