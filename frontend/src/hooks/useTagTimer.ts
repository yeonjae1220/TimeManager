'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import apiClient from '@/utils/apiClient'
import {
  clearTimerState,
  enqueuePendingTimerOperation,
  peekPendingTimerOperation,
  peekResetTimerMarker,
  peekTimerState,
  saveResetTimerMarker,
  saveTimerState,
  shouldApplyResetTimerMarker,
} from '@/utils/timerPersistence'
import { useTagStore, type Tag } from '@/store/tagStore'
import { syncNativeRunningSession } from '@/native/runningSession'

export interface StopwatchState {
  isRunning: boolean
  latestStartTime: number
  latestEndTime: number
  elapsedTime: number
  dailyTotalTime: number
  dailyGoalTime: number
  tagTotalTime: number
  totalTime: number
  elapsedTimeCal: number
  dailyTotalTimeCal: number
  tagTotalTimeCal: number
  totalTimeCal: number
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00'
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const INITIAL_STATE: StopwatchState = {
  isRunning: false,
  latestStartTime: 0,
  latestEndTime: 0,
  elapsedTime: 0,
  dailyTotalTime: 0,
  dailyGoalTime: 0,
  tagTotalTime: 0,
  totalTime: 0,
  elapsedTimeCal: 0,
  dailyTotalTimeCal: 0,
  tagTotalTimeCal: 0,
  totalTimeCal: 0,
}

/**
 * 포그라운드 복귀 시 재조회 최소 간격. 앱 전환을 빠르게 반복해도 API 를 도배하지 않는다.
 */
const FOREGROUND_REFRESH_THROTTLE_MS = 5_000

/**
 * 태그 스냅샷(네트워크 응답 또는 캐시된 Tag)으로부터 StopwatchState 를 계산한다.
 * 순수 함수 — 로컬 스냅샷(peekTimerState)·리셋 마커와의 화해 규칙은 입력이 네트워크
 * 응답이든 IndexedDB 캐시든 동일하게 적용된다. loadTag 가 콜드 스타트에서 네트워크
 * 왕복 전에 캐시로 먼저 그리고(stale-while-revalidate), 응답이 오면 같은 함수로
 * 다시 계산해 항상 서버값이 이기게 한다.
 *
 * data 타입을 Tag(옵셔널 필드)로 느슨하게 받는 것은 의도적이다 — 캐시 경로(태그
 * 트리)는 이 필드들이 비어 있을 수 있고, 네트워크 응답 경로는 항상 채워져 있다.
 * 아래 계산은 이미 전부 `|| 0`/`Number.isFinite` 로 방어돼 있으므로 두 입력을
 * 같은 함수로 처리해도 안전하다.
 */
function computeStopwatchState(tagId: number, data: Tag): StopwatchState {
  const saved = peekTimerState()
  const useLocalState = saved &&
    saved.tagId === tagId &&
    saved.savedAt > (data.latestStartTimeMs || 0) &&
    saved.savedAt > (data.latestStopTimeMs || 0)
  const resetMarker = peekResetTimerMarker(tagId)
  const useResetMarker = shouldApplyResetTimerMarker(
    resetMarker,
    data.latestStartTimeMs,
    data.latestStopTimeMs
  )

  // 형제 필드들은 전부 `|| 0` 로 받는데 elapsedTime 만 응답을 그대로 썼다. 타입에
  // number 라고 적혀 있어도 검증되지 않은 응답이라 타입체크가 못 잡고, NaN 하나가
  // 화면 타이머와 네이티브 알림 기준시각을 동시에 망가뜨린다.
  const restoredElapsed = useResetMarker
    ? 0
    : useLocalState ? saved!.elapsedTime : data.elapsedTime
  const elapsed = Number.isFinite(restoredElapsed) ? restoredElapsed : 0

  // 서버가 RUNNING인데 시작시각이 EPOCH(0) 등 무효면 신뢰하지 않는다 — 그대로
  // isRunning=true 로 받아들이면 tick()이 매번 무효 앵커를 만나 영구히 동결되고,
  // 다음 loadTag(포그라운드 복귀마다)도 같은 응답을 받아 다시 동결된다(재시작으로도
  // 안 풀림). 경계에서 걸러 화면이 조용히 멈추는 대신 정지 상태로 안전하게 강등한다.
  const rawStartMs = useLocalState ? saved!.latestStartTime : data.latestStartTimeMs
  const hasValidStart = Number.isFinite(rawStartMs) && (rawStartMs ?? 0) > 0
  const serverRunning = useLocalState ? saved!.isRunning : data.state
  if (!useResetMarker && serverRunning && !hasValidStart) {
    console.error('Tag reported RUNNING without a valid start time — treating as stopped:', tagId)
  }
  const isRunning = useResetMarker ? false : serverRunning && hasValidStart
  const latestStartTime = useResetMarker || !isRunning ? 0 : (rawStartMs ?? 0)

  // 실행 중이면 로드 시점까지의 경과를 즉시 반영한다(base로 되돌리지 않는다).
  // 안 그러면 재조회가 성공해도 다음 tick이 돌 때까지 화면이 base에 멈춰 보인다
  // — 인터벌이 죽어 있었다면 그 상태가 영구화된다.
  const liveDelta = isRunning ? Math.max(0, Math.floor((Date.now() - latestStartTime) / 1000)) : 0
  const dailyTotalTime = data.dailyTotalTime || 0
  const tagTotalTime = data.tagTotalTime || 0
  const totalTime = data.totalTime || 0

  return {
    isRunning,
    latestStartTime,
    latestEndTime: useResetMarker ? 0 : useLocalState ? (saved!.latestEndTime ?? 0) : (data.latestStopTimeMs ?? 0),
    elapsedTime: elapsed,
    dailyTotalTime,
    dailyGoalTime: data.dailyGoalTime || 0,
    tagTotalTime,
    totalTime,
    elapsedTimeCal: elapsed + liveDelta,
    dailyTotalTimeCal: dailyTotalTime + liveDelta,
    tagTotalTimeCal: tagTotalTime + liveDelta,
    totalTimeCal: totalTime + liveDelta,
  }
}

export function useTagTimer() {
  const [tag, setTag] = useState<Tag | null>(null)
  const [sw, setSw] = useState<StopwatchState>(INITIAL_STATE)
  // 네트워크 응답으로 확정된 tag id. loadTag의 캐시 시드 단계에서는 갱신하지
  // 않는다 — 호출부(TodayView의 autostart 등)가 "지금 보이는 tag/sw가 stale
  // 캐시가 아니라 서버가 확정한 값"임을 구분해야 할 때 이 값과 tag.id를 비교한다.
  const [confirmedTagId, setConfirmedTagId] = useState<number | null>(null)
  const [isWakeLockActive, setIsWakeLockActive] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const isRunningRef = useRef(false)
  // 실행 중인 1초 인터벌의 id. 포그라운드 복귀 시 죽어 있을 수 있는 인터벌을
  // 재무장(armTicker)하기 위해 effect 밖에서도 정리할 수 있게 ref로 든다.
  const tickerIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 포그라운드 복귀 재조회용 — 마지막으로 loadTag 에 넘어온 인자와 마지막 재조회 시각.
  const lastLoadArgsRef = useRef<{ tagId: number; memberId: number } | null>(null)
  const lastForegroundRefreshRef = useRef(0)
  // loadTag 가 이미 이 tagId에 대해 상태를 적용했는지 — 캐시 시드는 최초 1회만
  // (콜드 스타트 직후 loadTag 재호출, 예: 포그라운드 복귀 재조회에서 반복 적용해
  // 라이브로 흐르던 화면을 캐시로 되돌리지 않기 위함).
  const hydratedTagIdRef = useRef<number | null>(null)

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    // 이미 보유 중이면 중복 취득 방지
    if (wakeLockRef.current) return
    // 문서가 보이지 않으면 취득 불가(NotAllowedError) — visibilitychange에서 재시도
    if (document.visibilityState !== 'visible') return
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      wakeLockRef.current = sentinel
      setIsWakeLockActive(true)
      sentinel.addEventListener('release', () => {
        wakeLockRef.current = null
        setIsWakeLockActive(false)
      })
    } catch (e) {
      // 자동 절전·백그라운드 전환 등으로 거부될 수 있음 — 조용히 무시하고 재시도에 맡김
      console.warn('Wake Lock 요청 실패:', e)
      setIsWakeLockActive(false)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    setIsWakeLockActive(false)
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {
        /* 이미 해제됨 — 무시 */
      }
      wakeLockRef.current = null
    }
  }, [])

  // isRunningRef를 sw.isRunning과 동기화 — visibilitychange 핸들러에서 안전하게 읽기 위함
  useEffect(() => { isRunningRef.current = sw.isRunning }, [sw.isRunning])

  // 언마운트 시 wake lock 해제 — today 화면을 떠나면 sentinel 정리
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [])

  const tick = useCallback(() => {
    setSw((prev) => {
      if (!prev.isRunning || prev.latestStartTime <= 0) return prev
      // 시계 역행(NTP 보정 등)으로 델타가 음수가 되어도 화면을 얼리지 않는다 — 0으로
      // 클램프하고 시계가 다시 앞으로 가면 자연히 정상 진행한다.
      const delta = Math.max(0, Math.floor((Date.now() - prev.latestStartTime) / 1000))
      return {
        ...prev,
        elapsedTimeCal: delta + prev.elapsedTime,
        dailyTotalTimeCal: prev.dailyTotalTime + delta,
        tagTotalTimeCal: prev.tagTotalTime + delta,
        totalTimeCal: prev.totalTime + delta,
      }
    })
  }, [])

  // 인터벌을 (재)무장한다. 기존 인터벌이 있으면 먼저 정리해 중복으로 쌓이지 않게 한다.
  // 브라우저가 백그라운드 전환 중 인터벌을 얼리거나 완전히 멈춰도(모바일 WebView에서
  // 흔함), 포그라운드 복귀 시 이 함수를 다시 부르면 화면이 스스로 회복한다 — 지금까지는
  // 죽은 인터벌을 되살릴 방법이 없어 앱을 완전히 재시작해야만 했다.
  const armTicker = useCallback(() => {
    if (tickerIdRef.current !== null) {
      clearInterval(tickerIdRef.current)
      tickerIdRef.current = null
    }
    if (!isRunningRef.current) return
    tick() // 즉시 1회 실행 — 얼어 있던 동안의 경과를 복귀와 동시에 반영
    tickerIdRef.current = setInterval(tick, 1000)
  }, [tick])

  // 1초 인터벌 — RAF 60fps 대비 배터리/CPU 60배 절감
  useEffect(() => {
    armTicker()
    return () => {
      if (tickerIdRef.current !== null) {
        clearInterval(tickerIdRef.current)
        tickerIdRef.current = null
      }
    }
  }, [sw.isRunning, armTicker])

  const loadTag = useCallback(async (tagId: number, memberId: number) => {
    lastLoadArgsRef.current = { tagId, memberId }

    // 네트워크 왕복 전에 로컬 캐시(태그 트리 IndexedDB 캐시)로 먼저 그린다 — 콜드
    // 스타트에서 온라인 요청이 끝나기 전까지 화면이 "태그 선택" 상태로 보이며 시작
    // 버튼이 무력화되는 것을 막는다(오프라인 재전송 큐와 같은 원칙: 잠정 표시 →
    // 서버 응답으로 화해). 같은 태그를 다시 불러올 때(포그라운드 복귀 재조회 등)는
    // 건너뛴다 — 안 그러면 라이브로 흐르던 화면이 매번 캐시 스냅샷으로 되튄다.
    // 네이티브 알림은 이 잠정 값으로 건드리지 않는다 — 권위는 항상 네트워크 응답이다.
    // TODO: 이 캐시가 "실행중"으로 stale 하면(다른 기기에서 정지된 뒤 이 기기의
    // 태그 트리 캐시가 아직 안 따라잡은 경우) 네트워크 왕복 1회 동안 잘못된
    // 경과시간이 화면에 잠깐 보일 수 있다(자가 치유됨, 화면 잠금·네이티브 알림
    // 같은 부작용은 없음 — 각각 별도로 해제/차단됨). 필요해지면
    // useTagStore.getState().lastFetchedAt 신선도로 이 분기 자체를 게이팅할 것.
    if (hydratedTagIdRef.current !== tagId) {
      const cached = useTagStore.getState().findById(tagId)
      if (cached) {
        hydratedTagIdRef.current = tagId
        setTag(cached)
        const cachedSw = computeStopwatchState(tagId, cached)
        setSw(cachedSw)
        if (cachedSw.isRunning) requestWakeLock()
        else releaseWakeLock()
      }
    }

    try {
      const response = await apiClient.get<Tag & {
        elapsedTime: number
        dailyTotalTime: number
        dailyGoalTime: number
        tagTotalTime: number
        totalTime: number
        latestStartTimeMs: number | null
        latestStopTimeMs: number | null
        state: boolean
      }>(`/api/v1/tags/${tagId}?memberId=${memberId}`)
      const data = response.data
      hydratedTagIdRef.current = tagId
      setTag(data)
      setConfirmedTagId(tagId)

      const newSw = computeStopwatchState(tagId, data)
      setSw(newSw)
      // 캐시 시드가 (stale 데이터로) 잠금을 먼저 취득했을 수 있으므로, 서버가
      // 정지로 화해하면 여기서 반드시 해제한다 — 안 그러면 시작 버튼이 이미
      // "시작"으로 바뀌어 있어 사용자가 stopStopwatch를 통해 해제할 방법이 없고
      // 화면이 언마운트될 때까지 잠금이 조용히 남는다.
      if (newSw.isRunning) requestWakeLock()
      else releaseWakeLock()

      // 네이티브 표면의 기준점. 이 API 는 서버에서 reconcileRunningTimersQuietly() 를 먼저
      // 돌리고, newSw 는 그 결과를 로컬 스냅샷·리셋 마커와 화해시킨 값이다. 즉 여기가
      // "지금 정말로 실행 중인가" 에 가장 가까운 답이라, 다른 기기에서 정지된 세션의
      // 유령 알림도 여기서 정리된다.
      void syncNativeRunningSession(
        newSw.isRunning
          ? {
              tagId,
              tagName: data.name,
              startedAtMs: newSw.latestStartTime,
              baseElapsedSec: newSw.elapsedTime,
              dailyBaseSec: newSw.dailyTotalTime,
              dailyGoalSec: newSw.dailyGoalTime,
            }
          : null
      )
    } catch (e) {
      console.error('Failed to load tag:', e instanceof Error ? e.message : String(e))
    }
  }, [requestWakeLock, releaseWakeLock])

  // 포그라운드 복귀 처리. 세 가지를 한다:
  //  1) 실행 중이면 Wake Lock 재취득 — OS 가 백그라운드 전환 시 자동 해제한다.
  //  2) 인터벌 재무장 — 백그라운드 전환 중 브라우저/WebView 가 인터벌을 얼리거나
  //     완전히 멈출 수 있다(모바일에서 흔함). 네트워크와 무관하게 즉시 동작해야
  //     하므로 loadTag 와 분리한다 — 오프라인이어도 화면 시계는 바로 회복해야 한다.
  //  3) loadTag 재조회 — "다른 기기에서 정지"로 생긴 유령 알림/유령 Live Activity 를
  //     죽이는 유일한 실효 수단이다. 재조회 결과가 loadTag 안에서 그대로
  //     syncNativeRunningSession 으로 흘러가므로 여기에 별도 sync 를 두지 않는다.
  // Capacitor WebView 는 앱 전환에도 visibilitychange 를 발화하므로 appStateChange
  // 리스너를 따로 붙일 필요가 없다.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (isRunningRef.current) {
        requestWakeLock()
        armTicker()
      }

      const args = lastLoadArgsRef.current
      if (!args) return
      const now = Date.now()
      if (now - lastForegroundRefreshRef.current < FOREGROUND_REFRESH_THROTTLE_MS) return
      lastForegroundRefreshRef.current = now
      void loadTag(args.tagId, args.memberId)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [requestWakeLock, armTicker, loadTag])

  const startStopwatch = useCallback(async () => {
    if (!tag || sw.isRunning) return
    const startTime = Date.now()
    const newSw = { ...sw, isRunning: true, latestStartTime: startTime }
    setSw(newSw)
    useTagStore.getState().setTagState(tag.id, true)

    saveTimerState({
      tagId: tag.id,
      isRunning: true,
      elapsedTime: sw.elapsedTime,
      latestStartTime: startTime,
      latestEndTime: sw.latestEndTime,
      latestStopTimeMs: null,
      dailyTotalTime: sw.dailyTotalTime,
      dailyGoalTime: sw.dailyGoalTime,
    })
    requestWakeLock()

    // API 호출 **전**에 건다. 오프라인이면 start 는 큐로 가지만 로컬 타이머는 이미 돌고
    // 있으므로, 알림까지 취소하면 오프라인 사용자만 알림을 못 받는 퇴행이 된다.
    void syncNativeRunningSession({
      tagId: tag.id,
      tagName: tag.name,
      startedAtMs: startTime,
      baseElapsedSec: sw.elapsedTime,
      dailyBaseSec: sw.dailyTotalTime,
      dailyGoalSec: sw.dailyGoalTime,
    })

    try {
      await apiClient.post(`/api/v1/tags/${tag.id}/timer/start`, {
        startTime: new Date(startTime).toISOString(),
      })
    } catch (e) {
      enqueuePendingTimerOperation({
        type: 'start',
        tagId: tag.id,
        latestStartTime: startTime,
      })
      console.warn('Start API failed (offline?):', e)
    }
  }, [tag, sw, requestWakeLock])

  const stopStopwatch = useCallback(async () => {
    if (!tag || !sw.isRunning) return
    const endTime = Date.now()
    // 시계 역행 등으로 구간이 음수가 되면 그 구간은 0으로 클램프(누적 elapsed는 보존).
    const segment = Math.max(0, Math.floor((endTime - sw.latestStartTime) / 1000))
    const elapsed = segment + sw.elapsedTime
    // 이 세그먼트를 daily/tag/total base에 접어넣는다. 서버는 stop 시 [start,end] 구간으로
    // Record를 만들어 이 파생값들을 +segment 하므로(TimerCommandService.stopTimer) 정확히 일치한다.
    // base를 갱신하지 않으면 재시작 tick이 `prev.dailyTotalTime + delta`를 로드 시점 base로 다시
    // 계산해, 직전 세션분을 잃고 이전 값으로 떨어진다(리로드 전까지). elapsedTime과 동일한 누적 방식.
    const newSw = {
      ...sw,
      isRunning: false,
      latestEndTime: endTime,
      elapsedTime: elapsed,
      elapsedTimeCal: elapsed,
      dailyTotalTime: sw.dailyTotalTime + segment,
      dailyTotalTimeCal: sw.dailyTotalTime + segment,
      tagTotalTime: sw.tagTotalTime + segment,
      tagTotalTimeCal: sw.tagTotalTime + segment,
      totalTime: sw.totalTime + segment,
      totalTimeCal: sw.totalTime + segment,
    }
    setSw(newSw)
    useTagStore.getState().setTagState(tag.id, false)
    releaseWakeLock()

    saveTimerState({
      tagId: tag.id,
      isRunning: false,
      elapsedTime: elapsed,
      latestStartTime: sw.latestStartTime,
      latestEndTime: endTime,
      latestStopTimeMs: endTime,
      dailyTotalTime: sw.dailyTotalTime,
      dailyGoalTime: sw.dailyGoalTime,
    })

    // 정지도 API 전에. 로컬이 이미 멈췄으므로 오프라인이어도 알림은 즉시 사라져야 한다.
    void syncNativeRunningSession(null)

    try {
      await apiClient.post(`/api/v1/tags/${tag.id}/timer/stop`, {
        elapsedTime: elapsed,
        timestamps: {
          startTime: new Date(sw.latestStartTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        },
      })
      clearTimerState()
    } catch (e) {
      enqueuePendingTimerOperation({
        type: 'stop',
        tagId: tag.id,
        elapsedTime: elapsed,
        latestStartTime: sw.latestStartTime,
        latestEndTime: endTime,
      })
      console.warn('Stop API failed (offline?):', e)
    }

    // 방금 끝낸 세그먼트를 호출부(TodayView)가 "오늘 기록시간"에 낙관적으로 더할 수 있게 반환한다.
    // 오프라인이어도 세션은 큐에 남아 재전송되므로 반환값은 동일하게 유효하다.
    return segment
  }, [tag, sw, releaseWakeLock])

  const resetStopwatch = useCallback(async () => {
    if (!tag || sw.isRunning) return
    const hasPendingTimerOperation = peekPendingTimerOperation() !== null
    setSw((prev) => ({ ...prev, elapsedTime: 0, elapsedTimeCal: 0 }))
    saveResetTimerMarker(tag.id)
    clearTimerState()
    void syncNativeRunningSession(null)

    const tagStore = useTagStore.getState()

    // 대기 중인 op(오프라인 stop 등)가 있으면 reset을 직접 POST하지 않고 큐 끝에 넣는다.
    // retryPendingTimerOp이 [기존 op…, reset] 순서로 흘려보내 reset이 마지막에 적용되며,
    // 서버로 reset이 한 번만 전송된다(직접 POST + 재생으로 인한 이중 전송 방지).
    if (hasPendingTimerOperation) {
      enqueuePendingTimerOperation({ type: 'reset', tagId: tag.id, elapsedTime: 0 })
      tagStore.retryPendingTimerOp().then(() => {
        if (tag.memberId) tagStore.refreshTags(tag.memberId)
      })
      return
    }

    try {
      await apiClient.post(`/api/v1/tags/${tag.id}/timer/reset`, {
        elapsedTime: 0,
      })
      if (tag.memberId) tagStore.refreshTags(tag.memberId)
    } catch (e) {
      enqueuePendingTimerOperation({
        type: 'reset',
        tagId: tag.id,
        elapsedTime: 0,
      })
      console.warn('Reset API failed (offline?):', e)
    }
  }, [tag, sw.isRunning])

  const formattedElapsedTime = formatTime(sw.elapsedTimeCal)
  const formattedDailyTotalTime = formatTime(sw.dailyTotalTimeCal)
  const formattedTagTotalTime = formatTime(sw.tagTotalTimeCal)
  const formattedTotalTime = formatTime(sw.totalTimeCal)
  const formattedRemainingTime = formatTime(Math.max(0, sw.dailyGoalTime - sw.dailyTotalTimeCal))
  const formattedStartTime = sw.latestStartTime
    ? new Date(sw.latestStartTime).toLocaleTimeString()
    : '—'
  const formattedEndTime = sw.latestEndTime
    ? new Date(sw.latestEndTime).toLocaleTimeString()
    : '—'

  return {
    tag,
    sw,
    confirmedTagId,
    isWakeLockActive,
    loadTag,
    startStopwatch,
    stopStopwatch,
    resetStopwatch,
    formatTime,
    formattedElapsedTime,
    formattedDailyTotalTime,
    formattedTagTotalTime,
    formattedTotalTime,
    formattedRemainingTime,
    formattedStartTime,
    formattedEndTime,
  }
}
