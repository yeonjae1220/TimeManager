'use client'

import { useState } from 'react'
import apiClient from '@/utils/apiClient'
import { useI18n } from '@/i18n/I18nProvider'
import { ensureNotificationPermission } from '@/native/notificationPermission'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_MINUTE = 60
/** 서버 불변식과 같은 상한(하루). 넘기면 400 이 오므로 UI 에서 먼저 막는다. */
const MAX_GOAL_SECONDS = 86_400

/** 선택지는 프리셋으로 고정한다 — 목표 설정은 드문 행위라 숫자 입력기를 띄울 만큼의 정밀도가 필요 없다. */
const PRESET_SECONDS = [0, 1800, 3600, 5400, 7200, 10_800, 14_400, 21_600, 28_800] as const

interface DailyGoalSheetProps {
  tagId: number
  tagName: string
  currentGoalSeconds: number
  onClose: () => void
  /** 저장 성공 시 호출 — 호출부가 loadTag 를 다시 돌려 화면과 알림을 함께 갱신한다. */
  onSaved: () => void
}

export default function DailyGoalSheet({
  tagId,
  tagName,
  currentGoalSeconds,
  onClose,
  onSaved,
}: DailyGoalSheetProps) {
  const { t } = useI18n()
  const [selected, setSelected] = useState(
    Math.min(MAX_GOAL_SECONDS, Math.max(0, currentGoalSeconds)),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const label = (seconds: number) =>
    seconds === 0
      ? t('goal.none')
      : t('goal.hhmm', {
          h: Math.floor(seconds / SECONDS_PER_HOUR),
          m: Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
        })

  const save = async () => {
    setIsSaving(true)
    setFailed(false)
    try {
      await apiClient.patch(`/api/v1/tags/${tagId}/daily-goal`, { dailyGoalTime: selected })
      // 목표를 세운 직후가 알림 권한을 묻기에 가장 자연스러운 순간이다 — 왜 필요한지
      // 사용자가 방금 스스로 정했기 때문이다. 목표를 지우는(0) 경우엔 묻지 않는다.
      if (selected > 0) void ensureNotificationPermission()
      onSaved()
      onClose()
    } catch (e) {
      console.error('Failed to save daily goal:', e instanceof Error ? e.message : String(e))
      setFailed(true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      data-modal-overlay
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'blur(2px)', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('goal.title')}
        style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}
      >
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {t('goal.title')}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
            {t('goal.subtitle', { tag: tagName })}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 16 }}>
          {PRESET_SECONDS.map((seconds) => (
            <button
              key={seconds}
              onClick={() => setSelected(seconds)}
              aria-pressed={selected === seconds}
              style={{
                height: 44,
                background: selected === seconds ? 'var(--text)' : 'var(--surface-2)',
                color: selected === seconds ? 'var(--bg)' : 'var(--text-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {label(seconds)}
            </button>
          ))}
        </div>

        {failed && (
          <p role="alert" style={{ padding: '0 20px 12px', fontSize: 12, color: 'var(--danger)' }}>
            {t('goal.saveFail')}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 16px' }}>
          <button
            onClick={onClose}
            style={{ height: 44, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13 }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={save}
            disabled={isSaving}
            style={{ height: 44, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', cursor: isSaving ? 'default' : 'pointer', opacity: isSaving ? 0.6 : 1, fontSize: 13 }}
          >
            {isSaving ? '…' : t('goal.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
