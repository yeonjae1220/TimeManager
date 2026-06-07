'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import TagPickerModal from '@/components/TagPickerModal'
import { useTagStore } from '@/store/tagStore'
import { useTagTimer } from '@/hooks/useTagTimer'
import { peekTimerState } from '@/utils/timerPersistence'
import apiClient from '@/utils/apiClient'
import { useI18n } from '@/i18n/I18nProvider'

function todayLabel(locale: string): string {
  return new Date().toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })
}

function toLocalDate(d: Date): string {
  return d.toLocaleDateString('sv-SE')
}

export default function TodayView() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language } = useI18n()
  const memberId = Number(params?.id)
  const tagTree = useTagStore((s) => s.tagTree)
  const loadTags = useTagStore((s) => s.loadTags)
  const handleOnline = useTagStore((s) => s.handleOnline)
  const addRecentTag = useTagStore((s) => s.addRecentTag)
  const recentTagIds = useTagStore((s) => s.recentTagIds)
  const findById = useTagStore((s) => s.findById)

  const {
    tag,
    sw,
    isWakeLockActive,
    loadTag,
    startStopwatch,
    stopStopwatch,
    resetStopwatch,
    formatTime,
    formattedElapsedTime,
    formattedDailyTotalTime,
    formattedTotalTime,
  } = useTagTimer()

  const [showTagPicker, setShowTagPicker] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [todayTotalSeconds, setTodayTotalSeconds] = useState(0)
  const didAutoLoad = useRef(false)

  const fetchTodayTotal = useCallback(async () => {
    const ds = toLocalDate(new Date())
    try {
      const res = await apiClient.get<{ totalSeconds: number }>(`/api/v1/records/summary?startDate=${ds}&endDate=${ds}`)
      setTodayTotalSeconds(res.data.totalSeconds || 0)
    } catch {
      // Keep the current on-screen value; the selected tag timer still gives useful feedback.
    }
  }, [])

  useEffect(() => {
    if (!memberId) return

    if (!didAutoLoad.current) {
      didAutoLoad.current = true
      const tagIdParam = searchParams?.get('tagId')
      if (tagIdParam) {
        const tagId = Number(tagIdParam)
        if (tagId) loadTag(tagId, memberId).then(() => addRecentTag(tagId)).catch(() => {})
      } else {
        const saved = peekTimerState()
        const recentIds = useTagStore.getState().recentTagIds
        const autoTagId = saved?.tagId ?? recentIds[0] ?? null
        if (autoTagId) loadTag(autoTagId, memberId).then(() => addRecentTag(autoTagId)).catch(() => {})
      }
    }

    loadTags(memberId)
    fetchTodayTotal()

    const onOnline = () => {
      setIsOnline(true)
      handleOnline()
      fetchTodayTotal()
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [memberId, loadTags, handleOnline, loadTag, addRecentTag, fetchTodayTotal])

  const selectTag = useCallback(async (tagId: number) => {
    if (!memberId || isSwitching) return
    setIsSwitching(true)
    setShowTagPicker(false)
    await loadTag(tagId, memberId)
    addRecentTag(tagId)
    setIsSwitching(false)
  }, [memberId, isSwitching, loadTag, addRecentTag])

  const goToRecords = () => {
    if (!tag) return
    router.push(`/records/${tag.id}`)
  }

  const handlePrimaryAction = useCallback(async () => {
    if (isSwitching) return
    if (!tag) {
      setShowTagPicker(true)
      return
    }
    if (sw.isRunning) {
      await stopStopwatch()
      fetchTodayTotal()
      return
    }
    await startStopwatch()
  }, [fetchTodayTotal, isSwitching, startStopwatch, stopStopwatch, sw.isRunning, tag])

  const recentTags = recentTagIds
    .map((id) => findById(id))
    .filter((t): t is NonNullable<typeof t> => t !== null && t.type !== 'DISCARDED' && t.id !== tag?.id)
    .slice(0, 3)

  const timerProgress = sw.dailyGoalTime > 0
    ? Math.min(100, Math.max(0, (sw.dailyTotalTimeCal / sw.dailyGoalTime) * 100))
    : 100
  const runningDelta = sw.isRunning ? Math.max(0, sw.elapsedTimeCal - sw.elapsedTime) : 0
  const todayRecordTotal = Math.max(todayTotalSeconds + runningDelta, sw.dailyTotalTimeCal)
  const primaryLabel = !tag
    ? t('today.chooseTagCta')
    : sw.isRunning
      ? t('today.stopCta')
      : t('today.startCta')

  return (
    <AppShell isRunning={sw.isRunning}>
      <div className="page today-page" style={{ position: 'relative' }}>
        {!isOnline && (
          <div className="offline-banner">
            <span className="mono">{t('today.offline')}</span>
          </div>
        )}

        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{todayLabel(language)}</span>
        </div>

        {/* Tag selector */}
        <section style={{ padding: '24px 0 16px' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('today.recording')}
          </p>
          <button
            onClick={() => setShowTagPicker(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text)' }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: sw.isRunning ? 'var(--running)' : 'var(--text-3)', flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{tag?.name ?? t('today.selectTag')}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </section>

        {/* Timer display */}
        {tag ? (
          <section style={{ textAlign: 'center', padding: '32px 0 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(36px, 12vw, 64px)', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em', transition: 'color 0.2s' }}>
              {formattedElapsedTime}
            </div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t('today.elapsed')}</span>
            <div
              aria-hidden="true"
              style={{
                width: 'min(220px, 58vw)',
                height: 2,
                margin: '14px auto 0',
                overflow: 'hidden',
                background: 'var(--border-subtle)',
                borderRadius: 999,
              }}
            >
              <div
                style={{
                  width: sw.isRunning ? `${timerProgress}%` : 0,
                  height: '100%',
                  background: 'var(--text-2)',
                  opacity: sw.isRunning ? 0.45 : 0,
                  transition: 'width 0.6s ease, opacity 0.2s ease',
                }}
              />
            </div>
            {sw.isRunning && isWakeLockActive && (
              <div
                role="status"
                aria-label={t('today.wakeLockAria')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 14, padding: '4px 10px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 999,
                }}
              >
                <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <rect x="2.5" y="1" width="9" height="12" rx="1.6" stroke="var(--running)" strokeWidth="1.2" />
                    <circle cx="7" cy="10" r="0.9" fill="var(--running)" />
                  </svg>
                </span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {t('today.wakeLock')}
                </span>
              </div>
            )}
          </section>
        ) : (
          <section style={{ textAlign: 'center', padding: '32px 0 24px' }}>
            <div className="mono" style={{ fontSize: 'clamp(28px, 8vw, 48px)', color: 'var(--text-3)', letterSpacing: '-0.01em' }}>— — : — —</div>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>{t('today.noTagPrompt')}</p>
          </section>
        )}

        {/* Controls */}
        <section style={{ display: 'grid', gridTemplateColumns: tag && !sw.isRunning ? '1fr 52px' : '1fr', gap: 10, padding: '0 0 24px' }}>
          <button
            onClick={handlePrimaryAction}
            disabled={isSwitching}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 52, padding: '0 20px',
              background: !tag ? 'var(--accent)' : sw.isRunning ? 'var(--danger)' : 'var(--running)',
              color: 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em',
              cursor: isSwitching ? 'not-allowed' : 'pointer',
              opacity: isSwitching ? 0.5 : 1,
              transition: 'all 0.15s',
            }}
          >
            {sw.isRunning ? (
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 1.5l7.5 4.5L3 10.5V1.5z" fill="currentColor"/>
              </svg>
            )}
            {primaryLabel}
          </button>
          {tag && !sw.isRunning && (
            <button
              onClick={resetStopwatch}
              disabled={!tag || sw.isRunning}
              title={t('today.reset')}
              aria-label={t('today.reset')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 52, width: 52,
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                cursor: !tag || sw.isRunning ? 'not-allowed' : 'pointer',
                opacity: !tag || sw.isRunning ? 0.4 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 12 12" fill="none">
                <path d="M1.5 6A4.5 4.5 0 1 0 6 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M1.5 1.5v4.5h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </section>

        {/* Recent tags */}
        {recentTags.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>{t('today.recent')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recentTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTag(t.id)}
                  disabled={isSwitching}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 30, padding: '0 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-2)',
                    fontSize: 12,
                    cursor: isSwitching ? 'not-allowed' : 'pointer',
                    opacity: isSwitching ? 0.5 : 1,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.state ? 'var(--running)' : 'var(--text-3)', flexShrink: 0 }} />
                  {t.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Stats */}
        {tag && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24 }}>
              {[
                { label: t('today.statTodayTotal'), val: formatTime(todayRecordTotal) },
                { label: t('today.statTodayTag'), val: formattedDailyTotalTime },
                { label: t('today.statCurrentTagTotal'), val: formattedTotalTime },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'var(--surface)', padding: '14px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.3 }}>{label}</p>
                  <p className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{val}</p>
                </div>
              ))}
            </section>

            <button
              onClick={goToRecords}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--text-2)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="2" y="2" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M4.5 5.5h4M4.5 7.5h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              {t('today.sessions')}
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M2 5.5h7M6 2.5L9 5.5 6 8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Tag picker modal */}
      {showTagPicker && (
        <TagPickerModal
          tagTree={tagTree}
          currentTagId={tag?.id ?? null}
          onSelect={selectTag}
          onClose={() => setShowTagPicker(false)}
        />
      )}
    </AppShell>
  )
}
