'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'

interface AddTagFormProps {
  siblingNames: string[]
  onAdd: (name: string) => Promise<void>
  onCancel: () => void
}

/**
 * 태그 생성 인라인 폼. TagListView(자식 추가)와 TagPickerModal(오늘 탭에서 새 태그)이
 * 공유한다.
 *
 * onAdd 실패를 여기서 직접 잡는다 — 예전엔 호출부(TagListView.handleAddChild)가
 * catch 없이 await만 해서, 생성 실패가 unhandled rejection으로 새고 폼은 아무 표시
 * 없이 멈췄다.
 */
export default function AddTagForm({ siblingNames, onAdd, onCancel }: AddTagFormProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isDuplicate = name.trim() !== '' && siblingNames.includes(name.trim().toLowerCase())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError('')
    try {
      await onAdd(trimmed)
    } catch {
      setError(t('common.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('tags.namePlaceholder')}
          style={{ flex: 1, background: 'var(--input-bg)', border: `1px solid ${isDuplicate ? 'var(--warning, #f59e0b)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
        />
        {isDuplicate && <span className="mono" style={{ fontSize: 9, color: 'var(--warning, #f59e0b)', whiteSpace: 'nowrap' }}>{t('tags.dupShort')}</span>}
        <button type="submit" disabled={saving || !name.trim()} style={{ padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving || !name.trim() ? 0.4 : 1 }}>
          {saving ? '...' : t('common.add')}
        </button>
        <button type="button" onClick={onCancel} aria-label={t('common.cancel')} style={{ padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
          ✕
        </button>
      </form>
      {error && <p className="mono" style={{ fontSize: 10, color: 'var(--danger)', marginTop: 6 }}>{error}</p>}
    </div>
  )
}
