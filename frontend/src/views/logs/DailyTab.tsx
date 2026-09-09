'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useI18n } from '@/i18n/I18nProvider'
import DayOffsetBadge from '@/components/DayOffsetBadge'
import { type DayBoundary, fmtDuration, fmtHMS, getTopTag, addDays, TagBar, NavArrows, LoadError, useLogicalToday, BoundaryWait, getSummary } from './shared'

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

export default function DailyTab({ memberId, initialDate, backTo, dayBoundary }: DailyTabProps) {
  const { t: tr, language } = useI18n()
  const logicalToday = useLogicalToday(dayBoundary)

  // 사용자가 화살표로 옮긴 날짜. 드릴다운이면 initialDate, 아니면 논리적 오늘이
  // 정해질 때까지 date 전체가 null로 남는다. DailyTab은 key={dateParam ?? 'today'}로
  // 렌더돼 드릴다운/탭 진입마다 새로 마운트되므로 override는 매번 null에서 시작한다
  // — resetHour가 뒤늦게 도착해도 override가 남아 있으면 오늘로 되돌리지 않는다.
  const [override, setOverride] = useState<Date | null>(null)
  const date = override ?? initialDate ?? logicalToday

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
          없으니 대기 화면만 둔다. */}
      {date === null && <BoundaryWait dayBoundary={dayBoundary} />}
      {date !== null && (
        <NavArrows
          label={label}
          onPrev={() => date && setOverride(addDays(date, -1))}
          onNext={() => date && setOverride(addDays(date, 1))}
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
                        <DayOffsetBadge start={sessionStart} end={sessionEnd} language={language} />
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

