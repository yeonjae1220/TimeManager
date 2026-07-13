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
export function computeTodayRecordTotal(
  todayTotalSeconds: number,
  runningDelta: number,
  dailyTotalTimeCal: number,
): number {
  return Math.max(todayTotalSeconds + runningDelta, dailyTotalTimeCal)
}
