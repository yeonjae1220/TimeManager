'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import TagPickerModal from '@/components/TagPickerModal'
import DailyGoalSheet from '@/components/DailyGoalSheet'
import { useTagStore } from '@/store/tagStore'
import { useTagTimer } from '@/hooks/useTagTimer'
import { peekTimerState } from '@/utils/timerPersistence'
import apiClient from '@/utils/apiClient'
// 로컬 state 이름(isOnline)과 겹치므로 별칭으로 가져온다.
import { isOnline as getIsOnline, subscribeConnectivity } from '@/utils/connectivity'
import { useI18n } from '@/i18n/I18nProvider'
import { computeTodayRecordTotal } from './todayRecordTotal'
import { hapticStart, hapticStop } from '@/native/haptics'
import { ensureNotificationPermission } from '@/native/notificationPermission'
import { resyncNativeRunningSession } from '@/native/runningSession'

function todayLabel(locale: string): string {
  return new Date().toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })
}

function toLocalDate(d: Date): string {
  return d.toLocaleDateString('sv-SE')
}

const TODAY_RECENT_TAG_LIMIT = 6

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
  const [showGoalSheet, setShowGoalSheet] = useState(false)
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

    // 배너와 재전송 트리거를 모두 connectivity 한 곳에서 받는다.
    // window 'online'/'offline' 을 직접 듣지 않는 이유는 네이티브 WebView 에서
    // 그 이벤트가 아예 발생하지 않기 때문이다(utils/connectivity.ts 주석 참조) —
    // 그대로 두면 오프라인 배너가 앱에서 영원히 안 뜨고, 신호가 돌아와도 오프라인
    // 큐가 재전송되지 않는다.
    setIsOnline(getIsOnline())
    const unsubscribe = subscribeConnectivity((online) => {
      setIsOnline(online)
      if (!online) return
      handleOnline()
      fetchTodayTotal()
    })

    // 포그라운드 복귀 시의 즉시 확인은 ConnectivityWatcher(레이아웃 전역)가 맡는다.
    // 이 화면에만 두면 다른 화면에서 오프라인이 된 뒤 앱을 껐다 켰을 때 복귀 감지가
    // 죽은 채로 남는다.
    return unsubscribe
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
      hapticStop()
      const segment = await stopStopwatch()
      // 정지 순간 runningDelta가 0으로 떨어지므로, 서버 summary 재조회가 도착하기 전까지의 공백 동안
      // 방금 끝낸 세그먼트를 낙관적으로 더해 "오늘 기록시간"이 이전 값으로 잠깐 튀는 것을 막는다.
      // fetchTodayTotal()이 곧 서버 절대값으로 덮어써 화해하므로 이중 계산은 없다.
      if (segment) setTodayTotalSeconds((s) => s + segment)
      fetchTodayTotal()
      return
    }
    hapticStart()
    await startStopwatch()
    // 타이머를 시작한 직후가 알림 권한을 묻기에 자연스러운 두 번째 순간이다(첫 번째는
    // 목표 설정). 이미 결정된 상태면 ensure 가 아무것도 하지 않으므로 매 시작마다
    // 물어보는 일은 없다.
    //
    // 허용됐으면 반드시 재수렴시킨다 — startStopwatch 안의 sync 는 권한을 묻기 전에
    // 이미 지나갔으므로, 이게 없으면 방금 시작한 세션만 알림 없이 흘러간다.
    void ensureNotificationPermission().then((granted) => {
      if (granted) void resyncNativeRunningSession()
    })
  }, [fetchTodayTotal, isSwitching, startStopwatch, stopStopwatch, sw.isRunning, tag])

  const recentTags = recentTagIds
    .map((id) => findById(id))
    .filter((t): t is NonNullable<typeof t> => t !== null && t.type !== 'DISCARDED' && t.id !== tag?.id)
    .slice(0, TODAY_RECENT_TAG_LIMIT)

  const timerProgress = sw.dailyGoalTime > 0
    ? Math.min(100, Math.max(0, (sw.dailyTotalTimeCal / sw.dailyGoalTime) * 100))
    : 100
  const runningDelta = sw.isRunning ? Math.max(0, sw.elapsedTimeCal - sw.elapsedTime) : 0
  const todayRecordTotal = computeTodayRecordTotal(todayTotalSeconds, runningDelta, sw.dailyTotalTimeCal)
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
            {/* 진행률 바 = 목표 설정 진입점. 목표가 0이면 바가 늘 100%로 죽어 있어
                아무 정보도 주지 못하므로, 탭해서 목표를 세울 수 있게 한다. */}
            <button
              type="button"
              onClick={() => setShowGoalSheet(true)}
              aria-label={t('goal.openAria')}
              style={{
                display: 'block',
                width: 'min(220px, 58vw)',
                margin: '14px auto 0',
                padding: '8px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: 2,
                  overflow: 'hidden',
                  background: 'var(--border-subtle)',
                  borderRadius: 999,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: sw.isRunning ? `${timerProgress}%` : 0,
                    height: '100%',
                    background: 'var(--text-2)',
                    opacity: sw.isRunning ? 0.45 : 0,
                    transition: 'width 0.6s ease, opacity 0.2s ease',
                  }}
                />
              </span>
            </button>
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
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 2,
                scrollbarWidth: 'none',
                WebkitMaskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 28px), transparent 100%)',
                maskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 28px), transparent 100%)',
              }}
            >
              {recentTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTag(t.id)}
                  disabled={isSwitching}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    flex: '0 0 auto',
                    maxWidth: 148,
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
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
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
                { label: t('today.statTodayTag'), val: formattedDailyTotalTime },
                { label: t('today.statTodayTotal'), val: formatTime(todayRecordTotal) },
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

      {/* Daily goal sheet — 저장 후 loadTag 를 다시 돌리면 화면과 네이티브 알림이
          같은 경로(useTagTimer 의 sync 배선)로 함께 갱신된다. */}
      {showGoalSheet && tag && (
        <DailyGoalSheet
          tagId={tag.id}
          tagName={tag.name}
          currentGoalSeconds={sw.dailyGoalTime}
          onClose={() => setShowGoalSheet(false)}
          onSaved={() => { if (memberId) void loadTag(tag.id, memberId) }}
        />
      )}

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
