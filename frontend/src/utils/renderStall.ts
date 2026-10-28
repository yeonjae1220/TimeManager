'use client'

import { hasInflightWrites } from '@/utils/inflightWrites'
import { getPendingRefresh } from '@/utils/refreshAuth'

/**
 * 화면 갱신 정지 판정과 복구.
 *
 * iOS 홈 화면 PWA 가 백그라운드에서 돌아온 뒤, JS(타이머·네트워크)는 정상으로 도는데
 * 화면 갱신만 멈춰 터치할 때만 잠깐 그려지는 상태가 관찰됐다. 서버는 30초마다 타이머
 * 재조회를 받고 있었는데 화면 시계는 00:00:00 에 고정돼 있었고, "동기화 중" 표시는 이미
 * 끝난 뒤에도 터치할 때까지 남아 있었다. 앱을 강제 종료하고 다시 켜면 풀렸다.
 * 앱 코드로는 그 상태를 되돌릴 수 없으므로 페이지를 다시 연다 — 타이머 상태는 서버와
 * localStorage 에 있고 대기 중인 조작도 localStorage 큐에 있어 새로 열어도 잃지 않는다.
 * 단, 응답을 기다리는 요청은 큐에 없으므로 그동안은 새로고침을 미룬다(isReloadUnsafe).
 */

/** 요청한 프레임·커밋이 이 시간 넘게 오지 않으면 정지로 본다. */
export const RENDER_STALL_THRESHOLD_MS = 6_000

/**
 * 감시가 새로고침한 뒤 다시 새로고침하지 않는 기간. 오탐이 나도 새로고침 루프가 되지 않게
 * 막는 안전장치다 — 그 대가로 이 기간 안에 재발하면 사용자가 직접 앱을 다시 켜야 한다.
 */
export const RENDER_RELOAD_COOLDOWN_MS = 120_000

const RELOAD_MARK_KEY = 'timemgr-render-stall-reload-at'

/** frame: 브라우저가 프레임을 그리지 않는다. commit: React 가 상태 변경을 화면에 반영하지 않는다. */
export type RenderStallKind = 'frame' | 'commit'

/** 요청한 프레임·커밋이 임계값을 넘도록 오지 않았으면 그 종류, 아니면 null. */
export function detectRenderStall(
  now: number,
  frameRequestedAt: number | null,
  commitRequestedAt: number | null,
  thresholdMs: number = RENDER_STALL_THRESHOLD_MS,
): RenderStallKind | null {
  // 미래 시각(시계 역행)에 찍힌 요청은 나이를 알 수 없으므로 판정하지 않는다.
  const overdue = (at: number | null) => at !== null && now >= at && now - at >= thresholdMs
  if (overdue(frameRequestedAt)) return 'frame'
  if (overdue(commitRequestedAt)) return 'commit'
  return null
}

/**
 * 지금 새로고침하면 끊기는 요청이 있는지. 감지된 정지는 이게 풀릴 때까지 미룬다.
 * - 쓰기 요청: 타이머 조작은 실패해야만 오프라인 큐에 들어간다. 끊기면 큐에도 서버에도
 *   남지 않아, 정지가 끊기면 서버에 실행 중으로 남고 기록이 사라진다.
 * - 토큰 갱신: 서버는 회전할 때 옛 토큰을 바로 지운다. 응답 전에 끊으면 새 쿠키를 못 받아
 *   강제 로그아웃된다(refreshAuth.ts REFRESH_TIMEOUT_MS 참조).
 * 둘 다 axios 타임아웃이 있어 영영 미뤄지지는 않는다.
 */
export function isReloadUnsafe(): boolean {
  return hasInflightWrites() || getPendingRefresh() !== null
}

interface ReloadOptions {
  now?: number
  reload?: () => void
}

/** 쿨다운 밖이면 페이지를 다시 열고 true. 쿨다운 안이거나 시각을 남길 수 없으면 false. */
export function reloadForRenderStall(
  kind: RenderStallKind,
  { now = Date.now(), reload = () => window.location.reload() }: ReloadOptions = {},
): boolean {
  let lastReloadAt = 0
  try {
    lastReloadAt = Number(sessionStorage.getItem(RELOAD_MARK_KEY)) || 0
  } catch {
    /* 읽을 수 없으면 기록이 없는 것으로 본다 — 아래 쓰기가 실패하면 어차피 새로고침하지 않는다 */
  }
  if (now >= lastReloadAt && now - lastReloadAt < RENDER_RELOAD_COOLDOWN_MS) {
    console.warn(`[render-watchdog] ${kind} 정지 감지 — 직전 새로고침 쿨다운 중이라 건너뜀`)
    return false
  }

  // 시각을 남기지 못하면 쿨다운도 걸 수 없다. 오탐이면 새로고침 루프가 되므로 포기한다.
  try {
    sessionStorage.setItem(RELOAD_MARK_KEY, String(now))
  } catch {
    console.warn(`[render-watchdog] ${kind} 정지 감지 — 저장소를 쓸 수 없어 새로고침하지 않음`)
    return false
  }

  console.warn(`[render-watchdog] ${kind} 정지 감지 — 페이지를 다시 연다`)
  reload()
  return true
}
