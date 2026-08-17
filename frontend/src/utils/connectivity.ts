'use client'

/**
 * 연결 상태를 **관찰된 사실**로부터 판단한다.
 *
 * navigator.onLine 과 online/offline 이벤트를 쓰지 않는 이유: Android WebView 는
 * 시스템 연결 상태를 추적하지 않아 기내모드에서도 navigator.onLine 이 true 로
 * 고정되고 두 이벤트가 아예 발생하지 않는다(에뮬레이터 실측). 네이티브 셸에서는
 * 그 API 가 통째로 죽은 코드라, 그걸 근거로 배너를 띄우거나 재전송을 트리거하면
 * 웹에서만 동작하고 앱에서는 조용히 아무 일도 안 일어난다.
 *
 * 대신 실제 API 요청의 성공/실패를 1차 신호로 쓴다(apiClient 인터셉터가 보고).
 * 요청이 오가는 동안에는 추가 비용이 0이고, 끊긴 것이 확인됐을 때만 probe 를
 * 돌려 복귀를 감지한다.
 */

type Listener = (online: boolean) => void

/** 동일 오리진의 가장 가벼운 정적 자산. 복귀 감지에는 도달 여부만 있으면 된다. */
const PROBE_PATH = '/favicon.ico'
const PROBE_TIMEOUT_MS = 4_000
const INITIAL_DELAY_MS = 3_000
const MAX_DELAY_MS = 30_000

let online = true
let listeners = new Set<Listener>()
let probeTimer: ReturnType<typeof setTimeout> | null = null
let probeDelay = INITIAL_DELAY_MS

export function isOnline(): boolean {
  return online
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) {
    // 한 구독자의 예외가 나머지 구독자와 상태 전이를 삼키지 않도록 격리한다.
    try {
      listener(online)
    } catch (e) {
      console.warn('[connectivity] 구독자 처리 실패', e)
    }
  }
}

function setOnline(next: boolean): void {
  if (online === next) return
  online = next
  notify()
}

function stopProbing(): void {
  if (probeTimer !== null) {
    clearTimeout(probeTimer)
    probeTimer = null
  }
  probeDelay = INITIAL_DELAY_MS
}

function scheduleProbe(delay: number): void {
  if (probeTimer !== null) clearTimeout(probeTimer)
  probeTimer = setTimeout(runProbe, delay)
}

async function runProbe(): Promise<void> {
  probeTimer = null
  if (online) return

  const controller = new AbortController()
  const kill = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    await fetch(`${PROBE_PATH}?_=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(kill)
    reportReachable()
  } catch {
    clearTimeout(kill)
    // 오래 끊겨 있는 기기가 같은 간격으로 계속 두드리지 않도록 서서히 늦춘다.
    probeDelay = Math.min(Math.round(probeDelay * 1.5), MAX_DELAY_MS)
    scheduleProbe(probeDelay)
  }
}

/** 서버에 실제로 닿았다. 요청이 성공할 때마다 호출해도 되도록 저렴하게 유지한다. */
export function reportReachable(): void {
  stopProbing()
  setOnline(true)
}

/** 서버에 닿지 못했다(응답 없는 네트워크 오류). 복귀 감지 probe 를 시작한다. */
export function reportUnreachable(): void {
  setOnline(false)
  if (probeTimer === null) scheduleProbe(probeDelay)
}

/**
 * 지금 바로 한 번 확인한다. 앱으로 돌아온 순간처럼 연결이 회복돼 있을 가능성이
 * 큰 시점에 백오프를 기다리지 않기 위해 쓴다.
 */
export function probeNow(): void {
  if (online) return
  probeDelay = INITIAL_DELAY_MS
  scheduleProbe(0)
}

/** 테스트 전용 — 모듈 스코프 상태 초기화. */
export function __resetConnectivity(): void {
  stopProbing()
  online = true
  listeners = new Set()
}
