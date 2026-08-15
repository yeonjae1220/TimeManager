'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import TagPickerModal from '@/components/TagPickerModal'
import { useAuthStore } from '@/store/authStore'
import { useTagStore } from '@/store/tagStore'
import apiClient from '@/utils/apiClient'
import { useAsyncData } from '@/hooks/useAsyncData'
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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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

function DailyTab({ memberId }: { memberId: number }) {
  const { t: tr, language } = useI18n()
  const [date, setDate] = useState(new Date())

  const load = useCallback(() => getSummary(date, date), [date])
  const { data, loading, failed, reload } = useAsyncData(load)

  const label = date.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div>
      <NavArrows
        label={label}
        onPrev={() => setDate((d) => addDays(d, -1))}
        onNext={() => setDate((d) => addDays(d, 1))}
      />
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
                t.sessions.map((s, i) => (
                  <div key={`${t.tagId}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12 }}>{t.tagName}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {new Date(s.startTime).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {new Date(s.endTime).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text)' }}>{fmtDuration(s.durationSeconds)}</span>
                    </div>
                  </div>
                ))
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

function WeeklyTab({ memberId }: { memberId: number }) {
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
  const today = new Date()

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
          const isToday = isSameDay(dayDate, today)
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 60 }}>
                <div style={{ width: '100%', height: `${(secs / maxDay) * 100}%`, minHeight: secs > 0 ? 3 : 0, background: isToday ? 'var(--accent)' : 'var(--border)', borderRadius: 2, transition: 'height 0.3s' }} />
              </div>
              <span className="mono" style={{ fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>{dayLabel}</span>
            </div>
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

function MonthlyTab({ memberId }: { memberId: number }) {
  const { t: tr, language } = useI18n()
  const [refDate, setRefDate] = useState(new Date())

  const load = useCallback(() => getSummary(startOfMonth(refDate), endOfMonth(refDate)), [refDate])
  const { data, loading, failed, reload } = useAsyncData(load)

  // Per-day totals for heatmap (batch: one call per day is expensive, so we use per-week calls)
  //
  // 예전엔 주 단위 요청이 실패하면 `.catch(() => new Map())` 로 빈 맵을 넣었다.
  // 그러면 그 주의 칸들이 "기록 없음"과 똑같이 비어 보인다 — 조회 실패인지
  // 진짜 0인지 화면으로 구분할 수 없다. 하나라도 실패하면 히트맵을 안 그린다.
  const loadHeatmap = useCallback(() => {
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
              const key = toLocalDate(new Date(s.startTime))
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
  }, [refDate])
  const { data: dailyTotals } = useAsyncData(loadHeatmap)

  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  const monthLabel = refDate.toLocaleDateString(language, { year: 'numeric', month: 'long' })

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7
  const today = new Date()
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
            const isToday = isSameDay(d, today)
            return (
              <div
                key={i}
                title={tr('logs.dayTooltip', { day: d.getDate(), dur: fmtDuration(secs) })}
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
                }}
              >
                <span className="mono" style={{ fontSize: 8, color: secs > 0 ? 'var(--bg)' : 'var(--text-3)', opacity: 0.8 }}>{d.getDate()}</span>
              </div>
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
  // 실제 입력은 아래 네 값이 전부다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadRanges = useCallback(() => {
    const [start, end] = getRange()
    const [pStart, pEnd] = getPrevRange(start, end)
    return Promise.all([getSummary(start, end), getSummary(pStart, pEnd)])
      .then(([cur, pr]) => ({ current: cur, prev: pr }))
  }, [selectedTagId, period, customStart, customEnd])

  // 태그를 고르기 전에는 조회하지 않는다 → loader 를 null 로 넘긴다.
  const { data: ranges, loading, failed, reload } = useAsyncData(selectedTagId ? loadRanges : null)
  const current = ranges?.current ?? null
  const prev = ranges?.prev ?? null

  const selectedTag = selectedTagId ? findById(selectedTagId) : null

  function filterForTag(data: SummaryData): TagSummary[] {
    if (!selectedTagId) return []
    return data.tagSummaries.filter((t) => {
      if (t.tagId === selectedTagId) return true
      const tag = findById(t.tagId)
      if (!tag) return false
      // check if parent chain includes selectedTagId
      return t.parentTagName === selectedTag?.name
    })
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
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{selectedTag?.name ?? tr('logs.selectTag')}</span>
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

      {!selectedTagId && (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 40 }}>{tr('logs.selectTagStats')}</p>
      )}

      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}
      {!loading && failed && <LoadError onRetry={reload} />}
      {/* !failed 가 필수다. 빼면 조회 실패가 "해당 기간에 기록이 없습니다" + 기록
          시작 CTA 로 보인다 — 침묵이 아니라 틀린 사실을 단언하는 화면이라 사용자가
          "이 기간엔 안 했구나"로 확신하고 넘어간다. 아래 통계 블록은 지금은
          length > 0 게이트에 막히지만, 게이트가 바뀌어도 실패 시엔 안 나오도록
          여기서도 !failed 를 건다. */}
      {!loading && !failed && selectedTagId && currentFiltered.length === 0 && (
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

export default function LogsView() {
  const { t } = useI18n()
  const memberId = useAuthStore((s) => s.memberId)
  const [activeTab, setActiveTab] = useState<TabKey>('daily')

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
                onClick={() => setActiveTab(tab.key)}
                className="mono"
                style={{ flex: 1, padding: '6px 0', background: activeTab === tab.key ? 'var(--surface)' : 'transparent', border: 'none', borderRadius: 'calc(var(--radius) - 2px)', color: activeTab === tab.key ? 'var(--text)' : 'var(--text-3)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', boxShadow: activeTab === tab.key ? 'var(--shadow-active)' : undefined }}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {memberId && activeTab === 'daily' && <DailyTab memberId={memberId} />}
          {memberId && activeTab === 'weekly' && <WeeklyTab memberId={memberId} />}
          {memberId && activeTab === 'monthly' && <MonthlyTab memberId={memberId} />}
          {memberId && activeTab === 'tag' && <TagTab memberId={memberId} />}
        </div>
      </div>
    </AppShell>
  )
}
