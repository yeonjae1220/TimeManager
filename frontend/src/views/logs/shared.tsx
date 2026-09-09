'use client'

import { useMemo } from 'react'
import apiClient from '@/utils/apiClient'
import { type DailyResetHourState } from '@/hooks/useDailyResetHour'
import { resolveTodaySummaryDateParam } from '@/views/todayRecordTotal'
import { useI18n } from '@/i18n/I18nProvider'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface SessionDetail {
  startTime: string
  endTime: string
  durationSeconds: number
}

export interface TagSummary {
  tagId: number
  tagName: string
  parentTagName: string
  totalSeconds: number
  sessionCount: number
  sessions: SessionDetail[]
}

export interface SummaryData {
  totalSeconds: number
  tagSummaries: TagSummary[]
}

/**
 * 회원의 "하루" 경계 설정. useDailyResetHour의 반환 타입을 그대로 쓴다 — 별도
 * 인터페이스로 다시 적으면 훅의 반환 shape이 바뀔 때 둘 중 하나만 갱신되어
 * 조용히 어긋날 수 있다.
 */
export type DayBoundary = DailyResetHourState

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function fmtHMS(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sc = String(Math.floor(s % 60)).padStart(2, '0')
  return `${h}:${m}:${sc}`
}

export function getTopTag(data: SummaryData): TagSummary | null {
  return data.tagSummaries.reduce<TagSummary | null>((best, item) => {
    if (!best || item.totalSeconds > best.totalSeconds) return item
    return best
  }, null)
}

/**
 * timeZone을 지정하지 않는다 — 안전한 건 이 함수가 시간대 이동을 하지 않기
 * 때문이 아니라, 이 파일에서 넘기는 Date가 전부 `parseLocalDate`나 `new Date(y,m,d)`
 * 처럼 연/월/일을 직접 조립해 만든 값(=로컬 자정에 심어둔 "달력 날짜 라벨")이기
 * 때문이다. 그런 Date는 이미 만들 때 쓴 것과 같은 실행 환경 시간대로만 읽으면
 * (getFullYear 등도 그렇게 읽는다) 항상 원래 연/월/일이 그대로 돌아온다 — 그 라벨이
 * dailyResetHour/timezone(logicalDateStringOf) 기준으로 옳게 계산됐는지는 그 Date를
 * "만든" 쪽의 책임이다. 반대로 `new Date()`처럼 실제 시각(instant)에서 막 얻은 Date에
 * 이 함수를 쓰면 기기 시간대로 계산한 달력 날짜가 나와 회원 프로필 시간대와 어긋난다
 * — 그런 값은 이 함수가 아니라 resolveTodaySummaryDateParam/logicalDateStringOf를
 * 거쳐야 한다.
 */
export function toLocalDate(d: Date): string {
  return d.toLocaleDateString('sv-SE') // YYYY-MM-DD
}

/**
 * "YYYY-MM-DD" 문자열을 로컬 자정 Date로 되돌린다. `new Date(str)`는 UTC 자정으로
 * 해석해 음수 UTC 오프셋 지역에서 하루가 밀린다 — 반드시 연/월/일을 분해해 로컬
 * 컴포넌트로 생성한다.
 */
export function parseLocalDate(s: string): Date | null {
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

export function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// 같은 길이의 직전 구간. 인자만 쓰는 순수 함수라 컴포넌트 밖에 둔다 —
// 안에 두면 매 렌더 새 함수가 되어 useCallback deps 에 넣을 수 없다.
export function getPrevRange(start: Date, end: Date): [Date, Date] {
  const len = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  return [addDays(start, -len), addDays(end, -len)]
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function weekLabel(mon: Date, locale: string): string {
  const sun = addDays(mon, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${mon.toLocaleDateString(locale, opts)} – ${sun.toLocaleDateString(locale, opts)}`
}

// ────────────────────────────────────────────────────────────
// Summary bar
// ────────────────────────────────────────────────────────────

export function TagBar({ summary, total }: { summary: TagSummary; total: number }) {
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

export function NavArrows({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
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
export function LoadError({ onRetry }: { onRetry: () => void }) {
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

// ────────────────────────────────────────────────────────────
// Day boundary helpers
// ────────────────────────────────────────────────────────────

/**
 * dayBoundary(회원의 dailyResetHour+timezone)로부터 "논리적 오늘"을 계산한다.
 *
 * "오늘"은 달력 오늘이 아니라 dailyResetHour 기준의 논리적 오늘이다. 달력 날짜를
 * 그대로 쓰면 자정~resetHour 사이에 **아직 시작하지도 않은 구간**(오늘 05:00~
 * 내일 05:00)을 조회해 0시간을 진짜 값처럼 보여준다. 그 시간대에 어제치를 확인하러
 * 온 사용자에게 "기록이 없습니다"를 단언하는 화면이라, 침묵보다 나쁘다.
 * TodayView가 resolveTodaySummaryDateParam으로 이미 고친 것과 같은 결함이다.
 *
 * resetHour를 아직 모르면(로딩 중) null이다 — 5(백엔드 기본값)로 짐작하지 않는다.
 * DailyTab/WeeklyTab/MonthlyTab이 각자 "오늘이 속한 기간"을 정하는 데 쓴다.
 */
export function useLogicalToday(dayBoundary: DayBoundary): Date | null {
  const { resetHour, timezone } = dayBoundary
  return useMemo(() => {
    const key = resolveTodaySummaryDateParam(new Date(), resetHour, timezone)
    return key ? parseLocalDate(key) : null
  }, [resetHour, timezone])
}

/**
 * dayBoundary가 아직 해석되지 않은 동안의 대기 화면. 로딩 중이면 스피너, 확정
 * 실패면 재시도 버튼 — DailyTab/WeeklyTab/MonthlyTab이 각자 다른 방식으로
 * 구현하던 대기 상태를 하나로 합쳤다.
 */
export function BoundaryWait({ dayBoundary }: { dayBoundary: DayBoundary }) {
  if (dayBoundary.failed) return <LoadError onRetry={dayBoundary.reload} />
  return <div className="spinner" style={{ margin: '40px auto' }} />
}

/** 기간 요약 조회. 4개 탭이 같은 엔드포인트를 쓰므로 URL 조립을 한 곳에 둔다. */
export function getSummary(start: Date, end: Date): Promise<SummaryData> {
  return apiClient
    .get<SummaryData>(`/api/v1/records/summary?startDate=${toLocalDate(start)}&endDate=${toLocalDate(end)}`)
    .then((res) => res.data)
}
