/**
 * "오늘 기록시간"(Today's record time) 표시 초를 계산한다.
 *
 * - todayTotalSeconds: 서버 summary가 준 모든 태그 오늘 합계(스냅샷 — 실시간 증가 안 함).
 *   아직 한 번도 로드되지 않았으면 null — "0건"과 구분해야 한다(아래 참조).
 * - runningDelta: 실행 중인 현재 세션의 경과 초(정지되면 0).
 * - dailyTotalTimeCal: 현재 태그 하나의 오늘 누적(하한 가드).
 *
 * 실행 중엔 `todayTotalSeconds + runningDelta`가 실시간으로 오르고, 정지 순간
 * runningDelta는 0으로 떨어진다. 그래서 호출부는 정지 시 방금 끝낸 세그먼트를
 * todayTotalSeconds에 낙관적으로 더해, 서버 재조회 도착 전까지 값이 이전으로
 * 튀지 않게 한다(no-drop 불변식). dailyTotalTimeCal은 summary가 너무 작을 때의 하한.
 *
 * todayTotalSeconds가 null(요약 미도착)일 때 하한(dailyTotalTimeCal)만으로 계산하면,
 * 캐시 시드로 태그 통계만 먼저 채워진 화면에서 "오늘 태그 기록시간"과 "오늘 기록시간"이
 * 우연히 같은 값으로 보였다가 요약 도착 시 다른 값으로 바뀌는 것처럼 보인다(회귀) —
 * 그래서 null 은 그대로 null 을 돌려주고, 호출부가 로딩 중 표시를 하도록 한다.
 */
import { logicalDateOf } from '@/utils/dayBoundary'

export function computeTodayRecordTotal(
  todayTotalSeconds: number | null,
  runningDelta: number,
  dailyTotalTimeCal: number,
): number | null {
  if (todayTotalSeconds === null) return null
  return Math.max(todayTotalSeconds + runningDelta, dailyTotalTimeCal)
}

function toLocalDate(d: Date, timeZone?: string): string {
  // timeZone을 지정하지 않으면 런타임(브라우저) 기본 시간대를 쓴다 — 회원의
  // 프로필 시간대를 아직 모를 때의 기존 동작과 동일하게 유지한다.
  return timeZone
    ? d.toLocaleDateString('sv-SE', { timeZone }) // YYYY-MM-DD
    : d.toLocaleDateString('sv-SE')
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
 *
 * timezone은 회원 프로필의 시간대(예: "Asia/Seoul")다. 서버는 이 시간대 기준으로
 * "하루"를 나누는데(RecordSummaryService의 ZoneId.of(member.getTimezone())), 클라이언트가
 * 브라우저의 로컬 시간대로 날짜 문자열을 만들면 기기 시간대가 프로필 시간대와 다를 때
 * (여행 중이거나 프로필이 실제 위치와 다르게 설정된 경우) 하루 어긋난 구간을 조회한다.
 * 아직 모르면(undefined) 브라우저 기본 시간대로 계산해 기존 동작을 그대로 유지한다.
 */
export function resolveTodaySummaryDateParam(
  now: Date,
  resetHour: number | null,
  timezone?: string,
): string | null {
  if (resetHour === null) return null
  return toLocalDate(logicalDateOf(now, resetHour), timezone)
}
