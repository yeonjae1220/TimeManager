'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { useAuthStore } from '@/store/authStore'
import { useDailyResetHour } from '@/hooks/useDailyResetHour'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/index'
import { type DayBoundary, toLocalDate, parseLocalDate } from './logs/shared'
import DailyTab from './logs/DailyTab'
import WeeklyTab from './logs/WeeklyTab'
import MonthlyTab from './logs/MonthlyTab'
import TagTab from './logs/TagTab'

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
  // DailyTab 의 initialDate 로 내려가고, 거기서 조회 loader 의 deps 가 된다 —
  // 렌더마다 새 Date 를 만들면 LogsView 가 다시 그려질 때마다(경계 해소·언어 전환
  // 등) 일별 상세가 통째로 재조회된다. WeeklyTab/MonthlyTab 이 같은 결함으로
  // 무한 루프였던 것과 뿌리가 같다.
  const drillDate = useMemo(() => (dateParam ? parseLocalDate(dateParam) : null), [dateParam])
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
