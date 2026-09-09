'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAsyncData } from '@/hooks/useAsyncData'
import { resolveTodaySummaryDateParam } from '@/views/todayRecordTotal'
import { useI18n } from '@/i18n/I18nProvider'
import { type DayBoundary, fmtDuration, fmtHMS, getTopTag, toLocalDate, startOfWeek, addDays, weekLabel, TagBar, NavArrows, LoadError, useLogicalToday, BoundaryWait, getSummary } from './shared'

// ────────────────────────────────────────────────────────────
// Weekly tab
// ────────────────────────────────────────────────────────────

export default function WeeklyTab({ memberId, onDayClick, dayBoundary }: { memberId: number; onDayClick: (date: Date) => void; dayBoundary: DayBoundary }) {
  const { t: tr, language } = useI18n()
  const logicalToday = useLogicalToday(dayBoundary)

  // 사용자가 화살표로 옮긴 주. 논리적 오늘이 정해질 때까지 monday 전체가 null로
  // 남는다 — 기기 달력의 "이번 주"를 먼저 보여줬다가 논리적 주로 바뀌면(자정 직후
  // dailyResetHour 이전 방문) 오늘 강조가 그 사이 다른 주로 튄다.
  const [mondayOverride, setMondayOverride] = useState<Date | null>(null)
  // useMemo 가 필수다 — startOfWeek()는 매번 새 Date 를 만들고, 그 값이 아래
  // loader 들의 deps 에 들어 있다. useAsyncData 는 loader identity 가 바뀌면
  // 재조회하도록 설계돼 있으므로(그것이 "날짜가 바뀌면 다시 부른다"의 트리거),
  // 렌더마다 새 객체를 주면 조회 성공 → setState → 리렌더 → 새 Date → 재조회의
  // 무한 루프가 된다. 화면은 spinner ↔ 데이터를 끝없이 오가며 깜빡이고 한 바퀴에
  // 8건(요약 1 + 요일별 7)씩 요청이 나간다.
  const monday = useMemo(
    () => mondayOverride ?? (logicalToday ? startOfWeek(logicalToday) : null),
    [mondayOverride, logicalToday],
  )

  const load = useMemo(() => (monday ? () => getSummary(monday, addDays(monday, 6)) : null), [monday])
  const { data, loading, failed, reload } = useAsyncData(load)

  // Fetch per-day data for bar chart
  // 예전엔 날짜별 요청이 실패하면 `.catch(() => 0)` 으로 0 을 채워 넣었다. 그러면
  // "그날 기록이 없음" 과 "그날 조회 실패" 가 막대 높이 0 으로 똑같이 보인다.
  // 메인 요약이 성공한 부분 실패 상황에서는 화면 어디에도 단서가 안 남는다.
  // 하나라도 실패하면 차트를 그리지 않는다 — 거짓 0 보다 공백이 정직하다.
  const loadDailyTotals = useMemo(
    () => (monday ? () => Promise.all(
      Array.from({ length: 7 }, (_, i) => addDays(monday, i))
        .map((d) => getSummary(d, d).then((s) => s.totalSeconds)),
    ) : null),
    [monday],
  )
  const { data: dailyTotals } = useAsyncData(loadDailyTotals)

  // 경계를 모르는 동안은 어느 주가 "이번 주"인지도 못 정한다 — 화살표도 막대도
  // 가리킬 대상이 없으니 대기 화면만 둔다(DailyTab과 동일한 게이팅).
  if (monday === null) {
    return (
      <div>
        <BoundaryWait dayBoundary={dayBoundary} />
      </div>
    )
  }

  const maxDay = Math.max(...(dailyTotals ?? []), 1)
  const todayKey = resolveTodaySummaryDateParam(new Date(), dayBoundary.resetHour, dayBoundary.timezone)

  return (
    <div>
      <NavArrows
        label={weekLabel(monday, language)}
        onPrev={() => setMondayOverride(addDays(monday, -7))}
        onNext={() => setMondayOverride(addDays(monday, 7))}
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

