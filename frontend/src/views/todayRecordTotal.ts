/**
 * "오늘 기록시간"(Today's record time) 표시 초를 계산한다.
 *
 * - todayTotalSeconds: 서버 summary가 준 모든 태그 오늘 합계(스냅샷 — 실시간 증가 안 함).
 * - runningDelta: 실행 중인 현재 세션의 경과 초(정지되면 0).
 * - dailyTotalTimeCal: 현재 태그 하나의 오늘 누적(하한 가드).
 *
 * 실행 중엔 `todayTotalSeconds + runningDelta`가 실시간으로 오르고, 정지 순간
 * runningDelta는 0으로 떨어진다. 그래서 호출부는 정지 시 방금 끝낸 세그먼트를
 * todayTotalSeconds에 낙관적으로 더해, 서버 재조회 도착 전까지 값이 이전으로
 * 튀지 않게 한다(no-drop 불변식). dailyTotalTimeCal은 summary가 너무 작을 때의 하한.
 */
import { logicalDateOf } from '@/utils/dayBoundary'

export function computeTodayRecordTotal(
  todayTotalSeconds: number,
  runningDelta: number,
  dailyTotalTimeCal: number,
): number {
  return Math.max(todayTotalSeconds + runningDelta, dailyTotalTimeCal)
}

function toLocalDate(d: Date): string {
  return d.toLocaleDateString('sv-SE') // YYYY-MM-DD
}

/**
 * "/api/v1/records/summary"에 보낼 오늘 날짜. 서버는 startDate=D를 자정이 아니라
 * 회원의 dailyResetHour 경계로 해석한다(RecordSummaryService). 자정 기준 달력
 * 날짜를 그대로 보내면 자정~resetHour 사이엔 아직 오지 않은 구간을 조회해 0이
 * 나온다 — "오늘 기록시간"만 자정에 떨어지고 "오늘 태그 기록시간"(리셋 배치가
 * resetHour까지 유지)은 안 떨어져 서로 어긋나 보이는 원인이다.
 *
 * resetHour를 아직 모르면(로딩 중) null을 돌려준다 — 잘못된 경계로 조회해
 * "0건"을 진짜 값처럼 보여주는 것보다, 조회를 미루는 쪽이 안전하다.
 */
export function resolveTodaySummaryDateParam(now: Date, resetHour: number | null): string | null {
  if (resetHour === null) return null
  return toLocalDate(logicalDateOf(now, resetHour))
}
