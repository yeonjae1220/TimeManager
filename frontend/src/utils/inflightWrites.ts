'use client'

/**
 * 진행 중인 쓰기 요청(GET·HEAD·OPTIONS 외) 수. apiClient 인터셉터가 센다.
 *
 * 타이머 시작·정지 같은 조작은 요청이 실패했을 때만 오프라인 큐에 들어간다. 응답 전에
 * 페이지를 다시 열면 요청이 끊겨 큐에도 서버에도 남지 않으므로, 새로고침하는 쪽
 * (RenderWatchdog)이 이 값을 보고 기다린다.
 */
let inflightWrites = 0

const READ_METHODS = new Set(['get', 'head', 'options'])

export function isWriteMethod(method: string | undefined): boolean {
  return !READ_METHODS.has((method ?? 'get').toLowerCase())
}

export function trackWriteStart(): void {
  inflightWrites += 1
}

export function trackWriteEnd(): void {
  inflightWrites = Math.max(0, inflightWrites - 1)
}

export function hasInflightWrites(): boolean {
  return inflightWrites > 0
}
