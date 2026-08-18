'use client'

import { withPlugin } from '@/utils/nativeBridge'
import { isNativeApp } from '@/utils/platform'
import { readUiLangFromClient, translate } from '@/i18n/messages/index'
import type { TimerState } from '@/utils/timerPersistence'
import { checkNotificationPermission, NOTIFICATION_PLUGIN } from './notificationPermission'
import {
  buildTimerNotificationContent,
  goalReachAtMs,
  hideTimerNotification,
  isGoalReached,
  showTimerNotification,
  supportsTimerNotification,
} from './timerNotification'

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
const GOAL_NOTIFICATION_ID = 90001

/**
 * 장시간 리마인더는 3발만. 무한 반복하면 알림 피로로 사용자가 채널을 꺼버리고,
 * 그러면 목표 알림까지 같이 죽는다.
 * 시각과 id 를 한 자리에 묶어둔다 — 항목을 추가할 때 id 를 같이 정하지 않으면 안 되게.
 */
const LONG_RUN_REMINDERS = [
  { hours: 3, id: 90003 },
  { hours: 6, id: 90006 },
  { hours: 12, id: 90012 },
] as const

const HOUR_MS = 60 * 60 * 1000

interface ScheduledNotification {
  id: number
  title: string
  body: string
  atMs: number
}

/**
 * 마지막으로 수렴시킨 세션의 서명. 실패하거나 권한이 없어 건너뛰었으면 null 로
 * 되돌려 다음 호출이 다시 시도한다.
 *
 * **표면마다 따로 든다.** 예약(LocalNotifications)과 실행중 표시는 실패 이유가 서로
 * 다르기 때문이다 — 예컨대 "실행중 타이머" 채널만 꺼둔 사용자에게는 실행중 표시만
 * 영구히 실패하는데, 서명이 하나면 멀쩡히 걸려 있는 리마인더 4개를 매 sync 마다
 * 취소하고 다시 건다. 상시 표시라 채널만 꺼두는 사용자는 드물지 않다.
 *
 * 서명이 같으면 그 표면은 건드리지 않으므로, 포그라운드 복귀마다 호출돼도
 * 브리지 호출이 0 이다(서명 계산 자체는 localStorage·쿠키를 한 번 읽는다).
 */
let lastReminderSignature: string | null = null
let lastOngoingSignature: string | null = null

/** 마지막으로 선언된 세션. 권한 허용 직후 같은 세션으로 다시 수렴시키기 위해 들고 있는다. */
let lastSession: NativeRunningSession | null = null

/** 동시 호출 직렬화 — getPending → cancel → schedule 사이에 다른 sync 가 끼어들면 어긋난다. */
let queue: Promise<void> = Promise.resolve()

/**
 * 예약·문구를 바꾸는 모든 입력이 서명에 들어가야 한다.
 * tagId·startedAtMs 만 넣으면 "실행 중에 목표를 새로 설정" 하는 흔한 흐름에서
 * 서명이 그대로라 조기 return 에 걸려 목표 알림이 영영 안 걸린다(회귀 테스트 있음).
 *
 * 알림에 그대로 드러나는 값은 전부 여기 있어야 한다 — tagName(제목·본문),
 * baseElapsedSec(Chronometer 기준시각), 언어. 빠지면 바뀌어도 옛 내용이 그대로 남는데,
 * 실패가 아니라 **정상 동작으로 보이는** 종류의 어긋남이라 아무도 눈치채지 못한다.
 */
function signatureOf(session: NativeRunningSession | null): string {
  if (!session) return 'none'
  // \u0000 으로 잇는다 — 태그 이름에 구분자가 들어가도 서로 다른 세션이 같은 서명을
  // 가질 수 없게.
  return [
    session.tagId,
    session.startedAtMs,
    session.baseElapsedSec,
    session.dailyGoalSec,
    session.dailyBaseSec,
    session.tagName,
    readUiLangFromClient(),
    // "달성 예정 HH:MM" 은 그 시각이 지나면 거짓이 된다. 이미 떠 있는 알림은 앱이
    // 다시 손대기 전까지 옛 문구 그대로이므로, 지나는 순간을 서명이 반영해야
    // 다음 sync(대개 포그라운드 복귀)가 "달성" 으로 고쳐 쓴다.
    goalPassed(session),
  ].join('\u0000')
}

function goalPassed(session: NativeRunningSession): boolean {
  const goalAtMs = goalReachAtMs(session)
  return goalAtMs !== null && isGoalReached(goalAtMs)
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

  // 목표 도달 예정 시각. 목표가 없거나 이미 지났으면 null 이라 걸지 않는다.
  //
  // 실행중 알림 본문의 "달성 예정 HH:MM" 과 **같은 함수**에서 나온다. 각자 계산하면
  // 어긋나도 아무도 모르고, 사용자는 알림을 받은 뒤에도 상태표시줄에서 다른 시각을 읽는다.
  const goalAtMs = goalReachAtMs(session)
  if (goalAtMs !== null) {
    planned.push({
      id: GOAL_NOTIFICATION_ID,
      title: translate(lang, 'notif.goalReached.title'),
      body: translate(lang, 'notif.goalReached.body', { tag }),
      atMs: goalAtMs,
    })
  }

  for (const { hours, id } of LONG_RUN_REMINDERS) {
    planned.push({
      id,
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
 * Android 실행중 표시를 세션에 맞춘다.
 *
 * @returns 이 표면이 수렴했는지. 플러그인이 없는 바이너리(웹·iOS·구버전)는 **true** 다 —
 *   다룰 수 없는 것을 실패로 세면 매 sync 마다 서명이 리셋돼 예약까지 통째로 다시 도는
 *   무한 재수렴이 된다.
 */
async function convergeOngoingSurface(session: NativeRunningSession | null): Promise<boolean> {
  if (!supportsTimerNotification()) return true
  try {
    return session
      ? await showTimerNotification(buildTimerNotificationContent(session))
      : await hideTimerNotification()
  } catch (error) {
    // 이 호출은 withPlugin 의 try/catch **밖**이라, 여기서 새어 나가면 sync 전체가
    // reject 한다. 그 sync 를 await 하는 것이 로그아웃이므로 — 알림 문구 하나가
    // 세션 정리와 라우팅을 막는다. 표면 하나의 실패는 표면 하나에서 끝나야 한다.
    console.warn('[runningSession] 실행중 표시 수렴 실패', error)
    return false
  }
}

/**
 * 네이티브 표면을 인자에 맞춰 재수렴시킨다.
 *
 * @param session 실행 중인 세션, 또는 실행 중이 아니면 null
 */
export async function syncNativeRunningSession(
  session: NativeRunningSession | null,
): Promise<void> {
  lastSession = session
  const signature = signatureOf(session)
  const needsOngoing = signature !== lastOngoingSignature
  const needsReminders = signature !== lastReminderSignature
  if (!needsOngoing && !needsReminders) return

  // await 앞에서 표시해 둔다 — 뒤에서 시작한 sync 가 우리를 대체했는지
  // 아래에서 서명을 다시 비교해 알아내기 위해.
  if (needsOngoing) lastOngoingSignature = signature
  if (needsReminders) lastReminderSignature = signature

  const run = queue.then(async () => {
    // 실행중 표시는 예약과 **다른 표면**이다. 아래 withPlugin 클로저 안에 넣으면
    // 예약 쪽이 실패했을 때 hide 가 통째로 건너뛰어져, 정지했는데도 상태표시줄에
    // 타이머가 계속 흐르는 유령이 남는다. 사용자 눈에 먼저 보이는 쪽이라 순서도 먼저다.
    if (needsOngoing) {
      const converged = await convergeOngoingSurface(session)
      if (!converged && lastOngoingSignature === signature && isNativeApp()) {
        lastOngoingSignature = null
      }
    }

    if (!needsReminders) return

    const outcome = await withPlugin(
      NOTIFICATION_PLUGIN,
      () => import('@capacitor/local-notifications'),
      async ({ LocalNotifications }): Promise<'ok' | 'no-permission'> => {
        const pending = await LocalNotifications.getPending()
        const ours = pending.notifications.filter(
          (n) => (n.extra as { ns?: string } | undefined)?.ns === NS,
        )

        // 우리 예약은 전부 취소하고 필요한 것만 다시 건다. 정지·리셋·태그 전환·목표 변경·
        // 다른 기기에서의 정지가 전부 이 한 번으로 처리된다.
        //
        // id 가 같은 예약을 "살아 있다"고 보고 재사용하지 않는 이유: 목표가 바뀌면 같은
        // id(90001)의 발화 **시각**이 달라져야 하는데, id 만 비교하면 옛 시각이 그대로
        // 남는다(회귀 테스트 있음). 최대 4개짜리 집합이라 전부 다시 거는 비용이 무의미하다.
        if (ours.length > 0) {
          await LocalNotifications.cancel({ notifications: ours.map(({ id }) => ({ id })) })
        }

        if (!session) return 'ok'

        // 권한이 없으면 스케줄해봐야 조용히 버려진다. 여기서 요청하지는 않는다 —
        // 요청 시점은 사용자 행위(목표 설정·첫 시작)에 붙인다.
        if ((await checkNotificationPermission()) !== 'granted') return 'no-permission'

        const planned = buildNotifications(session, Date.now())
        if (planned.length === 0) return 'ok'

        await LocalNotifications.schedule({
          notifications: planned.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            // inexact 스케줄링. 이 알림들은 몇 분 늦어도 무해한 반면, 정확 알람은
            // Play 제한 권한을 건드린다.
            //
            // ⚠️ 이 축을 정하는 것은 isExactNotification 이다(기본 true). allowWhileIdle
            // 은 exact/inexact 와 무관하고 setExact vs setExactAndAllowWhileIdle 을
            // 고를 뿐이다. 기본값으로 두면 API 31+ 에서 플러그인이 schedule() 도중
            // 시스템 "알람 및 리마인더" 설정 화면을 띄워 사용자를 앱 밖으로 내보낸다
            // — 타이머를 켜려고 버튼을 누른 바로 그 순간에.
            isExactNotification: false,
            schedule: { at: new Date(n.atMs) },
            extra: { ns: NS, tagId: session.tagId, startedAtMs: session.startedAtMs },
          })),
        })
        return 'ok'
      },
    )

    // 웹에서는 undefined 가 정상(no-op)이라 아무것도 하지 않는다. 네이티브에서
    // 'ok' 가 아니면 — 호출 실패(undefined)든 권한 미허용이든 — 아직 수렴하지 못한
    // 것이므로 서명을 지워 다음 sync 가 다시 시도하게 한다. 권한을 나중에 허용한
    // 사용자가 포그라운드 복귀만으로 자가 치유되는 경로이기도 하다.
    if (outcome !== 'ok' && lastReminderSignature === signature && isNativeApp()) {
      lastReminderSignature = null
    }
  })

  queue = run.catch(() => {})
  return run
}

/**
 * 마지막으로 선언된 세션으로 강제 재수렴. 서명 캐시를 무시한다.
 *
 * 알림 권한을 방금 허용했을 때 쓴다 — 권한 요청은 sync 이후에 끝나므로, 그대로 두면
 * 그 세션은 알림 없이 지나가고 다음 상태 변화(정지·재시작·목표 변경) 전까지 복구되지
 * 않는다. 사용자가 "알림 켰는데 안 온다"고 느끼는 첫 세션이 정확히 이 창이다.
 */
export async function resyncNativeRunningSession(): Promise<void> {
  lastReminderSignature = null
  lastOngoingSignature = null
  return syncNativeRunningSession(lastSession)
}

/** 테스트 전용 — 모듈 스코프 캐시 초기화. */
export function __resetNativeRunningSession(): void {
  lastReminderSignature = null
  lastOngoingSignature = null
  lastSession = null
  queue = Promise.resolve()
}
