/**
 * 세션의 종료 시각이 시작 시각과 다른 달력 날짜에 있을 때 붙일 꼬리표("(+1)").
 * 같은 날에 끝났으면 null.
 *
 * 기록 목록과 일별 세션 타임라인은 시작·종료를 시:분으로만 보여준다. 그래서 자정을
 * 넘긴 세션이 `23:00 → 01:30` 처럼 **시간이 거꾸로 흐른 것처럼** 읽힌다 — 종료가
 * 다음 날이라는 사실이 화면에서 사라진다(편집 모달만 start/end 날짜를 따로 보여줘
 * 목록과 표현이 어긋나 있었다).
 *
 * 기준이 회원의 dailyResetHour 경계가 아니라 **달력 자정**인 것은 의도적이다.
 * 이 꼬리표가 설명하는 것은 "어느 날의 기록으로 집계되는가"가 아니라(그건 시작 시각
 * 기준 단일 귀속이라 세션 하나가 두 날에 걸리지 않는다) "옆에 찍힌 시계가 왜 되감긴
 * 것처럼 보이는가"이고, 그 시계는 브라우저 로컬 자정에서 되감긴다. 시계와 꼬리표가
 * 같은 시간대·같은 경계 위에 있어야 서로를 설명할 수 있다.
 */
export function dayOffsetSuffix(start: Date, end: Date): string | null {
  const days = calendarDayDiff(start, end)
  return days > 0 ? `(+${days})` : null
}

/**
 * 두 시각의 로컬 달력 날짜 차이(일). 자정으로 내린 뒤 빼고 반올림한다 —
 * DST 전환일의 하루는 24시간이 아니라 23·25시간이라, 밀리초 차를 86400000으로
 * 그냥 나누면 그날만 결과가 밀린다.
 */
function calendarDayDiff(start: Date, end: Date): number {
  const ms = startOfLocalDay(end) - startOfLocalDay(start)
  return Math.round(ms / 86_400_000)
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
