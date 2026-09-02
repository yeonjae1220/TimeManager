/**
 * "오늘"의 경계는 자정이 아니라 회원의 dailyResetHour다(백엔드 RecordSummaryService·
 * TagRecordDerivedFieldsSyncService.isToday와 동일 규칙). 자정 기준 달력 날짜를 그대로
 * 쓰면 자정~resetHour 사이에 어제 날짜를 조회해야 할 때 오늘 날짜를 보내 값이 어긋난다.
 */
export function logicalDateOf(date: Date, resetHour: number): Date {
  return new Date(date.getTime() - resetHour * 60 * 60 * 1000)
}

/**
 * 어떤 시각이 속한 "논리적 날짜"를 서버가 받는 것과 같은 "YYYY-MM-DD" 문자열로 만든다.
 * `/api/v1/records/summary` 의 startDate/endDate 와 클라이언트가 날짜별로 값을 모을 때
 * 쓰는 버킷 키가 같은 규칙 위에 있어야, 화면에 찍힌 날짜와 그 날짜를 눌러 들어간
 * 상세가 서로 다른 하루를 가리키지 않는다.
 *
 * timeZone 은 회원 프로필의 시간대(예: "Asia/Seoul")다. 서버는 이 시간대로 하루를
 * 나누므로(RecordSummaryService), 기기 시간대가 프로필과 다르면 브라우저 로컬로
 * 만든 날짜 문자열은 하루 어긋난다. 아직 모르면(undefined) 브라우저 기본 시간대를
 * 쓴다 — 이 값을 알기 전의 기존 동작과 같다.
 */
export function logicalDateStringOf(date: Date, resetHour: number, timeZone?: string): string {
  const shifted = logicalDateOf(date, resetHour)
  return timeZone
    ? shifted.toLocaleDateString('sv-SE', { timeZone }) // YYYY-MM-DD
    : shifted.toLocaleDateString('sv-SE')
}
