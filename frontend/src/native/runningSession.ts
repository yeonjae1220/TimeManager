'use client'

import { withPlugin } from '@/utils/nativeBridge'
import { isNativeApp } from '@/utils/platform'
import { readUiLangFromClient, translate } from '@/i18n/messages/index'
import type { TimerState } from '@/utils/timerPersistence'
import { checkNotificationPermission, NOTIFICATION_PLUGIN } from './notificationPermission'

/**
 * 네이티브 표면(로컬 알림, 나중에 Live Activity·Foreground Service)을 실행 중인 세션에
 * 맞춰 재수렴시키는 **단 하나의 지점**.
 *
 * 설계: 네이티브 표면은 파생 상태다. "start 에서 켜고 stop 에서 끈다"가 아니라 호출할
 * 때마다 **전체 상태를 선언**한다(idempotent). 경로 하나를 빠뜨려도 다음 sync 가 자가
 * 치유하고, 영속 상태를 따로 두지 않는다 — 무엇이 예약돼 있는지는 OS(getPending)에게
 * 묻는다. 로컬에 "내가 뭘 걸었더라" 를 기록하면 그게 곧 두 번째 진실의 소스가 된다.
 *
 * Tier 2(Live Activity / Foreground Service)는 호출부를 건드리지 않고 이 함수 안에서
 * 늘어난다.
 */

export interface NativeRunningSession {
  tagId: number
  tagName: string
  /** sw.latestStartTime — 이 시각 하나로 OS 가 스스로 경과시간을 센다. */
  startedAtMs: number
  /** sw.elapsedTime — 이번 세션 시작 시점까지 누적된 태그 경과시간(초). */
  baseElapsedSec: number
  /** sw.dailyTotalTime — 오늘 누적(초), 이번 실행분 제외. */
  dailyBaseSec: number
  /** sw.dailyGoalTime — 오늘 목표(초). 0 이면 목표 없음. */
  dailyGoalSec: number
}

/** 이 앱이 건 알림임을 표시하는 네임스페이스. getPending 결과에서 우리 것만 골라낸다. */
const NS = 'tm-timer'

/** 알림 id. 동시에 실행되는 세션은 최대 1개(로컬 타이머 슬롯이 단일)라 고정값으로 충분하다. */
const NOTIFICATION_ID = {
  goal: 90001,
  h3: 90003,
  h6: 90006,
  h12: 90012,
} as const

/**
 * 장시간 리마인더는 3발만. 무한 반복하면 알림 피로로 사용자가 채널을 꺼버리고,
 * 그러면 목표 알림까지 같이 죽는다.
 */
const LONG_RUN_HOURS = [3, 6, 12] as const

const HOUR_MS = 60 * 60 * 1000

interface ScheduledNotification {
  id: number
  title: string
  body: string
  atMs: number
}

/**
 * 마지막으로 수렴시킨 세션의 서명. 같은 서명이면 즉시 return 하므로
 * 포그라운드 복귀마다 호출돼도 비용이 0 이다.
 * 실패하면 null 로 되돌려 다음 호출이 다시 시도하게 한다.
 */
let lastSignature: string | null = null

/** 동시 호출 직렬화 — getPending → cancel → schedule 사이에 다른 sync 가 끼어들면 어긋난다. */
let queue: Promise<void> = Promise.resolve()

function signatureOf(session: NativeRunningSession | null): string {
  return session ? `${session.tagId}:${session.startedAtMs}` : 'none'
}

/** 로컬 타이머 스냅샷을 네이티브 세션으로. 실행 중이 아니면 null(= 네이티브 표면 없음). */
export function sessionFromTimerState(
  state: TimerState | null,
  tagName?: string,
): NativeRunningSession | null {
  if (!state || !state.isRunning) return null
  if (!state.latestStartTime || state.latestStartTime <= 0) return null
  return {
    tagId: state.tagId,
    tagName: tagName ?? '',
    startedAtMs: state.latestStartTime,
    baseElapsedSec: state.elapsedTime,
    dailyBaseSec: state.dailyTotalTime,
    dailyGoalSec: state.dailyGoalTime,
  }
}

function buildNotifications(session: NativeRunningSession, nowMs: number): ScheduledNotification[] {
  const lang = readUiLangFromClient()
  const tag = session.tagName || translate(lang, 'notif.untitledTag')
  const planned: ScheduledNotification[] = []

  // 목표 도달 예정 시각. 목표가 없거나 이미 지났으면 걸지 않는다.
  if (session.dailyGoalSec > 0) {
    const remainingSec = session.dailyGoalSec - session.dailyBaseSec
    if (remainingSec > 0) {
      planned.push({
        id: NOTIFICATION_ID.goal,
        title: translate(lang, 'notif.goalReached.title'),
        body: translate(lang, 'notif.goalReached.body', { tag }),
        atMs: session.startedAtMs + remainingSec * 1000,
      })
    }
  }

  for (const hours of LONG_RUN_HOURS) {
    planned.push({
      id: NOTIFICATION_ID[`h${hours}` as keyof typeof NOTIFICATION_ID],
      title: translate(lang, 'notif.longRun.title'),
      body: translate(lang, 'notif.longRun.body', { tag, hours }),
      atMs: session.startedAtMs + hours * HOUR_MS,
    })
  }

  // 이미 지난 시각으로 예약하면 OS 가 즉시 발화한다 — 앱을 켜자마자 "3시간 되었습니다"가
  // 쏟아지는 상황을 막는다.
  return planned.filter((n) => n.atMs > nowMs)
}

/**
 * 네이티브 표면을 인자에 맞춰 재수렴시킨다.
 *
 * @param session 실행 중인 세션, 또는 실행 중이 아니면 null
 */
export async function syncNativeRunningSession(
  session: NativeRunningSession | null,
): Promise<void> {
  const signature = signatureOf(session)
  if (signature === lastSignature) return
  lastSignature = signature

  const run = queue.then(async () => {
    const ok = await withPlugin(
      NOTIFICATION_PLUGIN,
      () => import('@capacitor/local-notifications'),
      async ({ LocalNotifications }) => {
        const pending = await LocalNotifications.getPending()
        const ours = pending.notifications.filter(
          (n) => (n.extra as { ns?: string } | undefined)?.ns === NS,
        )

        // 이번 세션에 속하지 않는 예약은 전부 취소한다. 정지·리셋·태그 전환·다른 기기에서의
        // 정지가 전부 이 한 줄로 처리된다 — 경로별 취소 코드를 두지 않는 이유다.
        const belongsToSession = (n: { extra?: unknown }) => {
          if (!session) return false
          const extra = n.extra as { tagId?: number; startedAtMs?: number } | undefined
          return extra?.tagId === session.tagId && extra?.startedAtMs === session.startedAtMs
        }
        const stale = ours.filter((n) => !belongsToSession(n))
        if (stale.length > 0) {
          await LocalNotifications.cancel({ notifications: stale.map(({ id }) => ({ id })) })
        }

        if (!session) return true

        // 권한이 없으면 스케줄해봐야 조용히 버려진다. 여기서 요청하지는 않는다 —
        // 요청 시점은 사용자 행위(목표 설정·첫 시작)에 붙인다.
        if ((await checkNotificationPermission()) !== 'granted') return true

        // 살아남은 예약은 그대로 둔다(같은 시각으로 다시 걸 이유가 없다).
        const alive = new Set(ours.filter(belongsToSession).map((n) => n.id))
        const toSchedule = buildNotifications(session, Date.now()).filter((n) => !alive.has(n.id))
        if (toSchedule.length === 0) return true

        await LocalNotifications.schedule({
          notifications: toSchedule.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            // allowWhileIdle 을 켜지 않는다 = inexact 스케줄링. 정확 알람은 Play 제한
            // 권한(USE_EXACT_ALARM)을 요구하는데, 이 알림들은 몇 분 늦어도 무해하다.
            schedule: { at: new Date(n.atMs) },
            extra: { ns: NS, tagId: session.tagId, startedAtMs: session.startedAtMs },
          })),
        })
        return true
      },
    )

    // 웹에서는 undefined 가 정상(no-op)이고, 네이티브에서 undefined 면 실패다.
    // 실패했으면 서명을 지워 다음 호출이 다시 시도하게 한다.
    if (ok !== true && lastSignature === signature && isNativeApp()) {
      lastSignature = null
    }
  })

  queue = run.catch(() => {})
  return run
}

/** 테스트 전용 — 모듈 스코프 캐시 초기화. */
export function __resetNativeRunningSession(): void {
  lastSignature = null
  queue = Promise.resolve()
}
