import { dayOffsetSuffix } from '@/utils/dayOffset'

/**
 * 세션/기록의 종료가 시작과 다른 달력 날짜일 때 붙이는 "(+N)" 꼬리표.
 * RecordListView와 LogsView(DailyTab)가 각자 구현하던 동일한 배지를 여기로 모았다 —
 * title(툴팁)·스타일이 두 화면에서 따로 관리되면 한쪽만 고치고 다른 쪽을 놓치기 쉽다.
 */
export default function DayOffsetBadge({ start, end, language }: { start: Date; end: Date; language: string }) {
  const suffix = dayOffsetSuffix(start, end)
  if (!suffix) return null
  return (
    <span title={end.toLocaleDateString(language)} style={{ marginLeft: 3, color: 'var(--text-2)' }}>
      {suffix}
    </span>
  )
}
