'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { logicalDateStringOf } from '@/utils/dayBoundary'
import { useAsyncData } from '@/hooks/useAsyncData'
import { resolveTodaySummaryDateParam } from '@/views/todayRecordTotal'
import { useI18n } from '@/i18n/I18nProvider'
import { type DayBoundary, fmtDuration, fmtHMS, getTopTag, toLocalDate, startOfWeek, addDays, startOfMonth, endOfMonth, TagBar, NavArrows, LoadError, useLogicalToday, BoundaryWait, getSummary } from './shared'

// ────────────────────────────────────────────────────────────
// Monthly tab
// ────────────────────────────────────────────────────────────

export default function MonthlyTab({ memberId, onDayClick, dayBoundary }: { memberId: number; onDayClick: (date: Date) => void; dayBoundary: DayBoundary }) {
  const { t: tr, language } = useI18n()
  const { resetHour, timezone } = dayBoundary
  const logicalToday = useLogicalToday(dayBoundary)

  // 사용자가 화살표로 옮긴 달. WeeklyTab과 같은 이유로, 논리적 오늘이 정해질
  // 때까지 refDate 전체가 null로 남는다(자정~resetHour 사이엔 기기 달력의
  // "이번 달"이 논리적으로 아직 지난달일 수 있다 — 예: 매월 1일 02:00).
  const [refDateOverride, setRefDateOverride] = useState<Date | null>(null)
  // WeeklyTab 의 monday 와 같은 이유로 useMemo 가 필수다 — startOfMonth()가 렌더마다
  // 새 Date 를 만들면 loader identity 가 매번 바뀌어 무한 재조회 루프가 된다.
  const refDate = useMemo(
    () => refDateOverride ?? (logicalToday ? startOfMonth(logicalToday) : null),
    [refDateOverride, logicalToday],
  )

  const load = useMemo(() => (refDate ? () => getSummary(startOfMonth(refDate), endOfMonth(refDate)) : null), [refDate])
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
    if (refDate === null || resetHour === null) return null
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

  // 경계를 모르는 동안은 어느 달이 "이번 달"인지도 못 정한다 — 화살표도 히트맵도
  // 가리킬 대상이 없으니 대기 화면만 둔다(DailyTab/WeeklyTab과 동일한 게이팅).
  if (refDate === null) {
    return (
      <div>
        <BoundaryWait dayBoundary={dayBoundary} />
      </div>
    )
  }

  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  const monthLabel = refDate.toLocaleDateString(language, { year: 'numeric', month: 'long' })

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7
  const todayKey = resolveTodaySummaryDateParam(new Date(), dayBoundary.resetHour, dayBoundary.timezone)
  const maxVal = Math.max(...Array.from(dailyTotals?.values() ?? []), 1)

  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ]

  return (
    <div>
      <NavArrows
        label={monthLabel}
        onPrev={() => setRefDateOverride(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}
        onNext={() => setRefDateOverride(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))}
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

