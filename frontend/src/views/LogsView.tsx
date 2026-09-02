'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import TagPickerModal from '@/components/TagPickerModal'
import { useAuthStore } from '@/store/authStore'
import { useTagStore } from '@/store/tagStore'
import { collectDescendantIds } from '@/utils/tagTree'
import { logicalDateStringOf } from '@/utils/dayBoundary'
import { dayOffsetSuffix } from '@/utils/dayOffset'
import apiClient from '@/utils/apiClient'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useDailyResetHour } from '@/hooks/useDailyResetHour'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/index'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface SessionDetail {
  startTime: string
  endTime: string
  durationSeconds: number
}

interface TagSummary {
  tagId: number
  tagName: string
  parentTagName: string
  totalSeconds: number
  sessionCount: number
  sessions: SessionDetail[]
}

interface SummaryData {
  totalSeconds: number
  tagSummaries: TagSummary[]
}

/**
 * 회원의 "하루" 경계 설정(useDailyResetHour의 결과). 서버는 startDate=D 를 자정이
 * 아니라 dailyResetHour 기준으로 해석하므로, 화면이 날짜를 고르거나 값을 날짜별로
 * 모을 때 같은 경계를 써야 한다.
 *
 * resetHour가 null이면 아직 모른다는 뜻이다 — 5(백엔드 기본값) 같은 값으로 짐작해
 * 조회하면 실제 설정이 다른 회원에게 "0시간"을 진짜 값처럼 보여준다. 그래서 이
 * 화면들은 짐작 대신 조회를 미룬다.
 */
interface DayBoundary {
  resetHour: number | null
  timezone: string | undefined
  failed: boolean
  reload: () => void
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function fmtHMS(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sc = String(Math.floor(s % 60)).padStart(2, '0')
  return `${h}:${m}:${sc}`
}

function getTopTag(data: SummaryData): TagSummary | null {
  return data.tagSummaries.reduce<TagSummary | null>((best, item) => {
    if (!best || item.totalSeconds > best.totalSeconds) return item
    return best
  }, null)
}

function toLocalDate(d: Date): string {
  return d.toLocaleDateString('sv-SE') // YYYY-MM-DD
}

/**
 * "YYYY-MM-DD" 문자열을 로컬 자정 Date로 되돌린다. `new Date(str)`는 UTC 자정으로
 * 해석해 음수 UTC 오프셋 지역에서 하루가 밀린다 — 반드시 연/월/일을 분해해 로컬
 * 컴포넌트로 생성한다.
 */
function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const parsed = new Date(year, month - 1, day)
  // new Date(y, m, d)는 범위를 벗어난 값(월 13, 일 45 등)을 던지지 않고 다음 달/해로
  // 조용히 굴려 넘긴다(예: 2024-13-01 → 2025-01-01). URL을 직접 편집한 경우에만
  // 닿는 경로지만, 굴러간 날짜로 조용히 진행하는 대신 무효 입력으로 취급한다.
  const isValid =
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  return isValid ? parsed : null
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

/**
 * 차트에서 "오늘"로 강조할 칸의 키("YYYY-MM-DD"). 달력 오늘이 아니라 회원의 논리적
 * 오늘이다 — resetHour=5 인 회원이 새벽 2시에 열면 달력 오늘의 막대/칸은 아직 비어
 * 있고, 방금 기록한 시간은 전날 막대/칸에 들어간다. 달력 날짜로 강조하면 테두리가
 * 데이터와 다른 하루를 가리킨다.
 *
 * 경계를 아직 모르면(resetHour === null) null이다. 5(백엔드 기본값)로 짐작하면 실제
 * 설정이 다른 회원에게 엉뚱한 칸을 "오늘"이라 단언하게 된다 — 이 화면의 규칙대로
 * 짐작하는 대신 아무 칸도 강조하지 않는다.
 */
function logicalTodayKey({ resetHour, timezone }: DayBoundary): string | null {
  return resetHour === null ? null : logicalDateStringOf(new Date(), resetHour, timezone)
}

function weekLabel(mon: Date, locale: string): string {
  const sun = addDays(mon, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${mon.toLocaleDateString(locale, opts)} – ${sun.toLocaleDateString(locale, opts)}`
}

// ────────────────────────────────────────────────────────────
// Summary bar
// ────────────────────────────────────────────────────────────

function TagBar({ summary, total }: { summary: TagSummary; total: number }) {
  const { t: tr } = useI18n()
  const pct = total > 0 ? (summary.totalSeconds / total) * 100 : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          {summary.parentTagName && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{summary.parentTagName} /</span>
          )}
          <span style={{ fontSize: 13 }}>{summary.tagName}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{tr('logs.sessionCount', { n: summary.sessionCount })}</span>
        </div>
        <span className="mono" style={{ fontSize: 12 }}>{fmtHMS(summary.totalSeconds)}</span>
      </div>
      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Navigation controls
// ────────────────────────────────────────────────────────────

function NavArrows({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <button onClick={onPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text)', minWidth: 160, textAlign: 'center' }}>{label}</span>
      <button onClick={onNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Load failure
// ────────────────────────────────────────────────────────────

/**
 * 로딩 실패를 눈에 보이게 알리고 사용자가 스스로 복구할 수단을 준다.
 *
 * 이전에는 4개 탭이 실패를 `catch { setData(null) }` 로 삼켜서, Weekly·Monthly 는
 * 빈 화면이 되고 TagTab 은 합계 0 을 정상값처럼 보여줬다 — 즉 "실패" 와
 * "기록 없음" 이 구분되지 않았다(GLOBAL-PIT-020 계열).
 */
function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t: tr } = useI18n()
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 10, padding: '32px 0' }}>
      <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{tr('logs.loadFail')}</p>
      <button
        onClick={onRetry}
        className="mono"
        style={{
          minHeight: 36, padding: '0 14px', fontSize: 11, cursor: 'pointer',
          background: 'none', color: 'var(--text-2)',
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)',
        }}
      >
        {tr('common.retry')}
      </button>
    </div>
  )
}

/** 기간 요약 조회. 4개 탭이 같은 엔드포인트를 쓰므로 URL 조립을 한 곳에 둔다. */
function getSummary(start: Date, end: Date): Promise<SummaryData> {
  return apiClient
    .get<SummaryData>(`/api/v1/records/summary?startDate=${toLocalDate(start)}&endDate=${toLocalDate(end)}`)
    .then((res) => res.data)
}

// ────────────────────────────────────────────────────────────
// Daily tab
// ────────────────────────────────────────────────────────────

interface DailyTabProps {
  memberId: number
  /** 주별/월별 탭에서 특정 날짜를 드릴다운했을 때의 시작 날짜. 없으면 오늘. */
  initialDate?: Date
  /** 드릴다운으로 들어왔을 때만 채워지는 뒤로가기 대상. */
  backTo?: { label: string; onBack: () => void }
  /** "오늘"을 정하는 데만 쓴다 — 드릴다운은 URL이 준 날짜를 그대로 쓴다. */
  dayBoundary: DayBoundary
}

function DailyTab({ memberId, initialDate, backTo, dayBoundary }: DailyTabProps) {
  const { t: tr, language } = useI18n()
  const { resetHour, timezone } = dayBoundary
  // 드릴다운이면 URL의 날짜로 즉시 시작하고, 아니면 회원 경계를 알기 전까지 null이다.
  const [date, setDate] = useState<Date | null>(initialDate ?? null)

  // "오늘"은 달력 오늘이 아니라 dailyResetHour 기준의 논리적 오늘이다. 달력 날짜를
  // 그대로 보내면 자정~resetHour 사이에 **아직 시작하지도 않은 구간**(오늘 05:00~
  // 내일 05:00)을 조회해 0시간을 진짜 값처럼 보여준다. 그 시간대에 어제치를 확인하러
  // 온 사용자에게 "기록이 없습니다"를 단언하는 화면이라, 침묵보다 나쁘다.
  // TodayView가 resolveTodaySummaryDateParam으로 이미 고친 것과 같은 결함이다.
  useEffect(() => {
    // 이미 정해졌으면(드릴다운이거나 사용자가 화살표로 옮겼으면) 건드리지 않는다 —
    // 안 그러면 resetHour가 뒤늦게 도착할 때 사용자가 넘긴 날짜를 오늘로 되돌린다.
    if (date !== null || resetHour === null) return
    const today = parseLocalDate(logicalDateStringOf(new Date(), resetHour, timezone))
    if (today) setDate(today)
  }, [date, resetHour, timezone])

  // date가 null인 동안은 loader를 넘기지 않는다 — 짐작한 경계로 얻은 0건보다
  // 기다리는 편이 안전하다(useAsyncData는 loader가 null이면 로딩도 걸지 않는다).
  const load = useMemo(() => (date ? () => getSummary(date, date) : null), [date])
  const { data, loading, failed, reload } = useAsyncData(load)

  const label = date
    ? date.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  return (
    <div>
      {backTo && (
        <button
          onClick={backTo.onBack}
          // 시각적으로는 짧게 기간 이름만 보여주되, 접근성 이름은 탭 바의 동명
          // 버튼("주별"/"월별")과 겹치지 않게 "뒤로 · 주별"처럼 구분한다 — 안 그러면
          // 스크린리더 사용자가 똑같은 이름의 버튼 두 개(동작이 다름)를 구분할 수 없다.
          aria-label={`${tr('common.back')} · ${backTo.label}`}
          className="mono"
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 11 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {backTo.label}
        </button>
      )}
      {/* 경계를 모르는 동안은 날짜 자체를 못 정한다 — 화살표도 합계도 가리킬 대상이
          없으니 스피너만 둔다. 확정 실패면 자동 재시도가 없으므로 재시도를 준다. */}
      {date === null && !dayBoundary.failed && <div className="spinner" style={{ margin: '40px auto' }} />}
      {date === null && dayBoundary.failed && <LoadError onRetry={dayBoundary.reload} />}
      {date !== null && (
        <NavArrows
          label={label}
          onPrev={() => setDate((d) => (d ? addDays(d, -1) : d))}
          onNext={() => setDate((d) => (d ? addDays(d, 1) : d))}
        />
      )}
      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}
      {!loading && data && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="mono" style={{ fontSize: 'clamp(28px, 8vw, 44px)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {fmtHMS(data.totalSeconds)}
            </div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{tr('logs.total')}</span>
            {data.totalSeconds > 0 && getTopTag(data) && (
              <p style={{ maxWidth: 320, margin: '12px auto 0', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
                {tr('logs.dailyInsight', { total: fmtDuration(data.totalSeconds), tag: getTopTag(data)?.tagName ?? '' })}
              </p>
            )}
          </div>
          {data.tagSummaries.length === 0 && (
            <div style={{ display: 'grid', justifyItems: 'center', gap: 12, padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>{tr('logs.noRecords')}</p>
              <Link href={`/members/${memberId}/today`} className="mono" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 14px', background: 'var(--accent)', borderRadius: 'var(--radius)', color: 'var(--bg)', fontSize: 11 }}>
                {tr('logs.startToday')}
              </Link>
            </div>
          )}
          {data.tagSummaries.map((t) => (
            <TagBar key={t.tagId} summary={t} total={data.totalSeconds} />
          ))}
          {/* Session timeline */}
          {data.tagSummaries.some((t) => t.sessions.length > 0) && (
            <div style={{ marginTop: 24 }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>{tr('logs.sessions')}</p>
              {data.tagSummaries.flatMap((t) =>
                t.sessions.map((s, i) => {
                  const sessionStart = new Date(s.startTime)
                  const sessionEnd = new Date(s.endTime)
                  // 자정을 넘긴 세션은 시:분만 보면 `23:00 → 01:30` 처럼 되감긴 것처럼
                  // 읽힌다. 종료가 며칠 뒤인지 꼬리표로 되살린다(같은 날이면 null).
                  const spanSuffix = dayOffsetSuffix(sessionStart, sessionEnd)
                  return (
                  <div key={`${t.tagId}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12 }}>{t.tagName}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {sessionStart.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {sessionEnd.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                        {spanSuffix && (
                          // title 로 실제 종료 날짜를 붙인다 — "(+1)" 만으로는 무엇이
                          // 하루 밀렸는지 읽는 사람이 추측해야 한다.
                          <span title={sessionEnd.toLocaleDateString(language)} style={{ marginLeft: 3, color: 'var(--text-2)' }}>{spanSuffix}</span>
                        )}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text)' }}>{fmtDuration(s.durationSeconds)}</span>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
      {!loading && failed && <LoadError onRetry={reload} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Weekly tab
// ────────────────────────────────────────────────────────────

function WeeklyTab({ memberId, onDayClick, dayBoundary }: { memberId: number; onDayClick: (date: Date) => void; dayBoundary: DayBoundary }) {
  const { t: tr, language } = useI18n()
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))

  const load = useCallback(() => getSummary(monday, addDays(monday, 6)), [monday])
  const { data, loading, failed, reload } = useAsyncData(load)

  // Fetch per-day data for bar chart
  // 예전엔 날짜별 요청이 실패하면 `.catch(() => 0)` 으로 0 을 채워 넣었다. 그러면
  // "그날 기록이 없음" 과 "그날 조회 실패" 가 막대 높이 0 으로 똑같이 보인다.
  // 메인 요약이 성공한 부분 실패 상황에서는 화면 어디에도 단서가 안 남는다.
  // 하나라도 실패하면 차트를 그리지 않는다 — 거짓 0 보다 공백이 정직하다.
  const loadDailyTotals = useCallback(
    () => Promise.all(
      Array.from({ length: 7 }, (_, i) => addDays(monday, i))
        .map((d) => getSummary(d, d).then((s) => s.totalSeconds)),
    ),
    [monday],
  )
  const { data: dailyTotals } = useAsyncData(loadDailyTotals)

  const maxDay = Math.max(...(dailyTotals ?? []), 1)
  const todayKey = logicalTodayKey(dayBoundary)

  return (
    <div>
      <NavArrows
        label={weekLabel(monday, language)}
        onPrev={() => setMonday((d) => addDays(d, -7))}
        onNext={() => setMonday((d) => addDays(d, 7))}
      />
      {/* 7-day bar chart — 날짜별 조회가 하나라도 실패하면 자리만 비워둔다.
          0 짜리 막대를 그리면 "기록 없음"과 구별되지 않는 거짓 정보가 된다. */}
      <div
        data-testid={dailyTotals ? 'weekly-bar-chart' : undefined}
        style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80, marginBottom: 24 }}
      >
        {dailyTotals && Array.from({ length: 7 }, (_, i) => i).map((i) => {
          const dayDate = addDays(monday, i)
          const dayLabel = dayDate.toLocaleDateString(language, { weekday: 'short' })
          const secs = dailyTotals[i] ?? 0
          const isToday = todayKey !== null && toLocalDate(dayDate) === todayKey
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(dayDate)}
              aria-label={dayDate.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 60 }}>
                <div style={{ width: '100%', height: `${(secs / maxDay) * 100}%`, minHeight: secs > 0 ? 3 : 0, background: isToday ? 'var(--accent)' : 'var(--border)', borderRadius: 2, transition: 'height 0.3s' }} />
              </div>
              <span className="mono" style={{ fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>{dayLabel}</span>
            </button>
          )
        })}
      </div>

      {loading && <div className="spinner" style={{ margin: '20px auto' }} />}
      {!loading && data && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.weekTotal')}</p>
              <p className="mono" style={{ fontSize: 16 }}>{fmtHMS(data.totalSeconds)}</p>
            </div>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.dailyAvg')}</p>
              <p className="mono" style={{ fontSize: 16 }}>{fmtHMS(Math.round(data.totalSeconds / 7))}</p>
            </div>
          </div>
          {data.totalSeconds > 0 && getTopTag(data) && (
            <p style={{ margin: '-8px 0 20px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
              {tr('logs.periodInsight', { total: fmtDuration(data.totalSeconds), tag: getTopTag(data)?.tagName ?? '' })}
            </p>
          )}
          {data.tagSummaries.length === 0 && (
            <div style={{ display: 'grid', justifyItems: 'center', gap: 12, padding: '8px 0 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>{tr('logs.noRecords')}</p>
              <Link href={`/members/${memberId}/today`} className="mono" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 14px', background: 'var(--accent)', borderRadius: 'var(--radius)', color: 'var(--bg)', fontSize: 11 }}>
                {tr('logs.startToday')}
              </Link>
            </div>
          )}
          {data.tagSummaries.map((t) => (
            <TagBar key={t.tagId} summary={t} total={data.totalSeconds} />
          ))}
        </>
      )}
      {!loading && failed && <LoadError onRetry={reload} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Monthly tab
// ────────────────────────────────────────────────────────────

function MonthlyTab({ memberId, onDayClick, dayBoundary }: { memberId: number; onDayClick: (date: Date) => void; dayBoundary: DayBoundary }) {
  const { t: tr, language } = useI18n()
  const { resetHour, timezone } = dayBoundary
  const [refDate, setRefDate] = useState(new Date())

  const load = useCallback(() => getSummary(startOfMonth(refDate), endOfMonth(refDate)), [refDate])
  const { data, loading, failed, reload } = useAsyncData(load)

  // Per-day totals for heatmap (batch: one call per day is expensive, so we use per-week calls)
  //
  // 예전엔 주 단위 요청이 실패하면 `.catch(() => new Map())` 로 빈 맵을 넣었다.
  // 그러면 그 주의 칸들이 "기록 없음"과 똑같이 비어 보인다 — 조회 실패인지
  // 진짜 0인지 화면으로 구분할 수 없다. 하나라도 실패하면 히트맵을 안 그린다.
  //
  // 버킷 키가 dailyResetHour 기준이어야 하는 이유. 예전엔 startTime의 **달력** 날짜로
  // 모았다. resetHour=5 라면 9/2 02:00 에 시작한 세션을 서버는 9/1 로 세는데(주별
  // 막대·일별 탭이 그렇게 보여준다) 히트맵만 9/2 칸에 칠했다. 그 9/2 칸을 눌러
  // 드릴다운하면 일별 상세는 서버 규칙으로 조회하므로 그 세션이 없다 — 칸에 적힌
  // 시간과 눌러서 들어간 화면의 합계가 서로 다른 하루를 가리켰다.
  //
  // resetHour를 모르는 동안은 loader 자체를 넘기지 않는다. 짐작한 경계로 칠한
  // 히트맵은 아래 "실패한 주를 빈 칸으로 그리지 않는다"와 같은 부류의 거짓 데이터다.
  const loadHeatmap = useMemo(() => {
    if (resetHour === null) return null
    return () => {
      const end = endOfMonth(refDate)
      const weeks: Date[] = []
      let cur = startOfWeek(startOfMonth(refDate))
      while (cur <= end) {
        weeks.push(new Date(cur))
        cur = addDays(cur, 7)
      }
      return Promise.all(
        weeks.map((mon) =>
          getSummary(mon, addDays(mon, 6)).then((summary) => {
            // We only have week total — approximate by distributing across sessions
            const map = new Map<string, number>()
            summary.tagSummaries.forEach((t) => {
              t.sessions.forEach((s) => {
                const key = logicalDateStringOf(new Date(s.startTime), resetHour, timezone)
                map.set(key, (map.get(key) ?? 0) + s.durationSeconds)
              })
            })
            return map
          }),
        ),
      ).then((maps) => {
        const merged = new Map<string, number>()
        maps.forEach((m) => m.forEach((v, k) => merged.set(k, (merged.get(k) ?? 0) + v)))
        return merged
      })
    }
  }, [refDate, resetHour, timezone])
  const { data: dailyTotals } = useAsyncData(loadHeatmap)

  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  const monthLabel = refDate.toLocaleDateString(language, { year: 'numeric', month: 'long' })

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7
  const todayKey = logicalTodayKey(dayBoundary)
  const maxVal = Math.max(...Array.from(dailyTotals?.values() ?? []), 1)

  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ]

  const totalDays = data ? Math.round(data.totalSeconds / (lastDay.getDate() * 1)) : 0

  return (
    <div>
      <NavArrows
        label={monthLabel}
        onPrev={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
        onNext={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
      />

      {/* Heatmap calendar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
          {/* 2024-01-01은 월요일 — 월요일 시작 기준 narrow 요일 라벨을 언어별로 생성 */}
          {Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(language, { weekday: 'narrow' })).map((d, i) => (
            <div key={i} className="mono" style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center' }}>{d}</div>
          ))}
        </div>
        {/* 주 단위 조회가 하나라도 실패하면 칸을 그리지 않는다 — 빈 칸은
            "기록 없음"과 구별되지 않아 조회 실패를 0으로 위장한다. */}
        <div
          data-testid={dailyTotals ? 'monthly-heatmap' : undefined}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}
        >
          {dailyTotals && cells.map((d, i) => {
            if (!d) return <div key={i} />
            const key = toLocalDate(d)
            const secs = dailyTotals.get(key) ?? 0
            const intensity = secs / maxVal
            const isToday = todayKey !== null && key === todayKey
            return (
              <button
                key={i}
                type="button"
                onClick={() => onDayClick(d)}
                title={tr('logs.dayTooltip', { day: d.getDate(), dur: fmtDuration(secs) })}
                aria-label={`${d.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}: ${fmtDuration(secs)}`}
                style={{
                  aspectRatio: '1',
                  borderRadius: 3,
                  background: secs > 0
                    ? `rgba(var(--accent-rgb, 99,102,241), ${0.15 + intensity * 0.85})`
                    : 'var(--border-subtle)',
                  outline: isToday ? '2px solid var(--accent)' : undefined,
                  outlineOffset: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <span className="mono" style={{ fontSize: 8, color: secs > 0 ? 'var(--bg)' : 'var(--text-3)', opacity: 0.8 }}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      {loading && <div className="spinner" style={{ margin: '20px auto' }} />}
      {!loading && data && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.monthTotal')}</p>
              <p className="mono" style={{ fontSize: 16 }}>{fmtHMS(data.totalSeconds)}</p>
            </div>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.dailyAvg')}</p>
              <p className="mono" style={{ fontSize: 16 }}>{fmtHMS(Math.round(data.totalSeconds / lastDay.getDate()))}</p>
            </div>
          </div>
          {data.totalSeconds > 0 && getTopTag(data) && (
            <p style={{ margin: '-8px 0 20px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
              {tr('logs.periodInsight', { total: fmtDuration(data.totalSeconds), tag: getTopTag(data)?.tagName ?? '' })}
            </p>
          )}
          {data.tagSummaries.length === 0 && (
            <div style={{ display: 'grid', justifyItems: 'center', gap: 12, padding: '8px 0 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>{tr('logs.noRecords')}</p>
              <Link href={`/members/${memberId}/today`} className="mono" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 14px', background: 'var(--accent)', borderRadius: 'var(--radius)', color: 'var(--bg)', fontSize: 11 }}>
                {tr('logs.startToday')}
              </Link>
            </div>
          )}
          {data.tagSummaries.map((t) => (
            <TagBar key={t.tagId} summary={t} total={data.totalSeconds} />
          ))}
        </>
      )}
      {!loading && failed && <LoadError onRetry={reload} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Tag tab
// ────────────────────────────────────────────────────────────

type TagPeriod = 'week' | 'month' | 'custom'

function TagTab({ memberId }: { memberId: number }) {
  const { t: tr } = useI18n()
  const tagTree = useTagStore((s) => s.tagTree)
  const loadTags = useTagStore((s) => s.loadTags)
  const findById = useTagStore((s) => s.findById)

  const [showPicker, setShowPicker] = useState(false)
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [period, setPeriod] = useState<TagPeriod>('week')
  const [customStart, setCustomStart] = useState(() => toLocalDate(addDays(new Date(), -6)))
  const [customEnd, setCustomEnd] = useState(() => toLocalDate(new Date()))

  useEffect(() => { if (memberId) loadTags(memberId) }, [memberId, loadTags])

  function getRange(): [Date, Date] {
    const today = new Date()
    if (period === 'week') return [startOfWeek(today), addDays(startOfWeek(today), 6)]
    if (period === 'month') return [startOfMonth(today), endOfMonth(today)]
    return [new Date(customStart), new Date(customEnd)]
  }

  function getPrevRange(start: Date, end: Date): [Date, Date] {
    const len = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    return [addDays(start, -len), addDays(end, -len)]
  }

  // getRange/getPrevRange 는 매 렌더 재정의되는 지역 함수라 deps 에 넣을 수 없다.
  // 실제 입력은 기간 세 값뿐이다 — 조회 자체는 항상 전체 태그를 가져오고,
  // selectedTagId 는 filterForTag 에서 클라이언트 사이드로만 골라낸다. 그래서
  // 태그를 바꿔도 재조회가 필요 없다(스피너 없이 즉시 필터링).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadRanges = useCallback(() => {
    const [start, end] = getRange()
    const [pStart, pEnd] = getPrevRange(start, end)
    return Promise.all([getSummary(start, end), getSummary(pStart, pEnd)])
      .then(([cur, pr]) => ({ current: cur, prev: pr }))
  }, [period, customStart, customEnd])

  // 태그 미선택 시에도 조회한다 — 예전엔 여기서 loader 를 null 로 넘겨 태그를
  // 고르기 전까지 빈 화면만 보여줬다. "전체 태그" 기본 데이터를 먼저 보여주는
  // 편이 더 유용하다.
  const { data: ranges, loading, failed, reload } = useAsyncData(loadRanges)
  const current = ranges?.current ?? null
  const prev = ranges?.prev ?? null

  const selectedTag = selectedTagId ? findById(selectedTagId) : null

  // 태그 미선택("전체 태그") 시엔 필터링 없이 전체를 쓴다. 선택했으면 그 태그
  // 자신 + 하위 태그의 id 집합으로 거른다.
  //
  // 예전엔 TagSummary.parentTagName(문자열)과 선택한 태그의 이름을 비교했다 —
  // 서로 다른 가지에 동명 태그가 있으면 엉뚱한 기록이 섞여 들어가는 결함이었다.
  // 트리를 id로 타고 내려가면 이름 충돌과 무관하게 정확하다.
  const descendantIds = useMemo(
    () => (selectedTagId ? collectDescendantIds(tagTree, selectedTagId) : null),
    [tagTree, selectedTagId],
  )

  function filterForTag(data: SummaryData): TagSummary[] {
    if (!descendantIds) return data.tagSummaries
    return data.tagSummaries.filter((t) => descendantIds.has(t.tagId))
  }

  const currentFiltered = current ? filterForTag(current) : []
  const prevFiltered = prev ? filterForTag(prev) : []
  const currentTotal = currentFiltered.reduce((s, t) => s + t.totalSeconds, 0)
  const prevTotal = prevFiltered.reduce((s, t) => s + t.totalSeconds, 0)
  const delta = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : null

  return (
    <div>
      {/* Tag selector */}
      <button
        onClick={() => setShowPicker(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text)', marginBottom: 20 }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{selectedTag?.name ?? tr('logs.allTags')}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['week', 'month', 'custom'] as TagPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="mono"
            style={{ padding: '5px 12px', background: period === p ? 'var(--accent)' : 'var(--surface-2)', border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: period === p ? 'var(--bg)' : 'var(--text-2)', fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {p === 'week' ? tr('logs.periodWeek') : p === 'month' ? tr('logs.periodMonth') : tr('logs.periodCustom')}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>~</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      )}

      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}
      {!loading && failed && <LoadError onRetry={reload} />}
      {/* !failed 가 필수다. 빼면 조회 실패가 "해당 기간에 기록이 없습니다" + 기록
          시작 CTA 로 보인다 — 침묵이 아니라 틀린 사실을 단언하는 화면이라 사용자가
          "이 기간엔 안 했구나"로 확신하고 넘어간다. 아래 통계 블록은 지금은
          length > 0 게이트에 막히지만, 게이트가 바뀌어도 실패 시엔 안 나오도록
          여기서도 !failed 를 건다. */}
      {!loading && !failed && currentFiltered.length === 0 && (
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12, marginTop: 40 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>{tr('logs.noRecordsPeriod')}</p>
          <Link href={`/members/${memberId}/today${selectedTagId ? `?tagId=${selectedTagId}` : ''}`} className="mono" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 14px', background: 'var(--accent)', borderRadius: 'var(--radius)', color: 'var(--bg)', fontSize: 11 }}>
            {tr('logs.startToday')}
          </Link>
        </div>
      )}

      {!loading && !failed && currentFiltered.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.tagTotal')}</p>
              <p className="mono" style={{ fontSize: 16 }}>{fmtHMS(currentTotal)}</p>
            </div>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.vsPrev')}</p>
              <p className="mono" style={{ fontSize: 16, color: delta === null ? 'var(--text-3)' : delta >= 0 ? 'var(--running)' : 'var(--danger)' }}>
                {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}%`}
              </p>
            </div>
          </div>
          {currentFiltered.map((t) => (
            <TagBar key={t.tagId} summary={t} total={currentTotal} />
          ))}
        </>
      )}

      {showPicker && (
        <TagPickerModal
          tagTree={tagTree}
          currentTagId={selectedTagId}
          onSelect={(id) => { setSelectedTagId(id); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

type TabKey = 'daily' | 'weekly' | 'monthly' | 'tag'

const TABS: { key: TabKey; labelKey: MessageKey }[] = [
  { key: 'daily', labelKey: 'logs.tabDaily' },
  { key: 'weekly', labelKey: 'logs.tabWeekly' },
  { key: 'monthly', labelKey: 'logs.tabMonthly' },
  { key: 'tag', labelKey: 'logs.tabTag' },
]

/** period 탭에서 날짜를 클릭해 들어온 일별 상세로 되돌아갈 대상. */
const DRILLDOWN_SOURCES = ['weekly', 'monthly'] as const
type DrilldownSource = (typeof DRILLDOWN_SOURCES)[number]

export default function LogsView() {
  const { t } = useI18n()
  const memberId = useAuthStore((s) => s.memberId)
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams?.get('tab')
  const activeTab: TabKey = TABS.some((tb) => tb.key === tabParam) ? (tabParam as TabKey) : 'daily'
  const dateParam = searchParams?.get('date')
  const drillDate = dateParam ? parseLocalDate(dateParam) : null
  const fromParam = searchParams?.get('from')
  const fromTab: DrilldownSource | null =
    (DRILLDOWN_SOURCES as readonly string[]).includes(fromParam ?? '') ? (fromParam as DrilldownSource) : null

  // 탭마다 따로 부르지 않고 여기서 한 번만 읽는다 — 훅이 세션 캐시를 쓰긴 하지만,
  // 탭을 오갈 때 경계가 잠깐 null 로 돌아가 화면이 스피너로 되돌아가는 일이 없다.
  const { resetHour, timezone, failed: boundaryFailed, reload: reloadBoundary } = useDailyResetHour(memberId)
  const dayBoundary: DayBoundary = useMemo(
    () => ({ resetHour, timezone, failed: boundaryFailed, reload: reloadBoundary }),
    [resetHour, timezone, boundaryFailed, reloadBoundary],
  )

  // 탭 전환은 브라우저 히스토리를 늘리지 않는다(기존 로컬 state와 동일한 UX) —
  // 매 탭 클릭이 "뒤로가기" 대상으로 쌓이면 하드웨어 뒤로가기가 성가셔진다.
  function goToTab(key: TabKey) {
    router.replace(`/logs?tab=${key}`)
  }

  // 날짜를 드릴다운할 때만 히스토리에 실제로 쌓는다 — NativeShell의 하드웨어
  // 뒤로가기(history.back())가 여기서 자연히 period 탭으로 돌아가게 만든다.
  function drillIntoDay(date: Date, from: DrilldownSource) {
    router.push(`/logs?tab=daily&date=${toLocalDate(date)}&from=${from}`)
  }

  return (
    <AppShell>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
        </div>

        <div style={{ padding: '24px 0' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
            {t('logs.eyebrow')}
          </p>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 28, background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 3 }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => goToTab(tab.key)}
                className="mono"
                style={{ flex: 1, padding: '6px 0', background: activeTab === tab.key ? 'var(--surface)' : 'transparent', border: 'none', borderRadius: 'calc(var(--radius) - 2px)', color: activeTab === tab.key ? 'var(--text)' : 'var(--text-3)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', boxShadow: activeTab === tab.key ? 'var(--shadow-active)' : undefined }}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {memberId && activeTab === 'daily' && (
            <DailyTab
              key={dateParam ?? 'today'}
              memberId={memberId}
              initialDate={drillDate ?? undefined}
              backTo={fromTab ? { label: t(fromTab === 'weekly' ? 'logs.tabWeekly' : 'logs.tabMonthly'), onBack: () => router.back() } : undefined}
              dayBoundary={dayBoundary}
            />
          )}
          {memberId && activeTab === 'weekly' && (
            <WeeklyTab memberId={memberId} onDayClick={(date) => drillIntoDay(date, 'weekly')} dayBoundary={dayBoundary} />
          )}
          {memberId && activeTab === 'monthly' && (
            <MonthlyTab memberId={memberId} onDayClick={(date) => drillIntoDay(date, 'monthly')} dayBoundary={dayBoundary} />
          )}
          {memberId && activeTab === 'tag' && <TagTab memberId={memberId} />}
        </div>
      </div>
    </AppShell>
  )
}
