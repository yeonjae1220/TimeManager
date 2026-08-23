/**
 * "오늘"의 경계는 자정이 아니라 회원의 dailyResetHour다(백엔드 RecordSummaryService·
 * TagRecordDerivedFieldsSyncService.isToday와 동일 규칙). 자정 기준 달력 날짜를 그대로
 * 쓰면 자정~resetHour 사이에 어제 날짜를 조회해야 할 때 오늘 날짜를 보내 값이 어긋난다.
 */
export function logicalDateOf(date: Date, resetHour: number): Date {
  return new Date(date.getTime() - resetHour * 60 * 60 * 1000)
}
