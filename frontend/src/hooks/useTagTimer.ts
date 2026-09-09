'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import apiClient from '@/utils/apiClient'
import {
  clearTimerState,
  enqueuePendingTimerOperation,
  peekPendingTimerOperation,
  peekPendingTimerOperations,
  peekTimerState,
  serverTimerChangedAt,
  saveResetTimerMarker,
  saveTimerState,
} from '@/utils/timerPersistence'
import { useTagStore, type Tag } from '@/store/tagStore'
import { computeStopwatchState, type StopwatchState } from '@/utils/stopwatchState'
import { isOnline } from '@/utils/connectivity'
import { syncNativeRunningSession } from '@/native/runningSession'

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
 * TodayView도 "오늘 기록시간"(summary) 재조회 스로틀에 동일 값을 재사용한다.
 */
export const FOREGROUND_REFRESH_THROTTLE_MS = 5_000
export const TIMER_REFRESH_INTERVAL_MS = 30_000
const RUNNING_CACHE_FRESH_MS = 30_000


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
  const loadVersionRef = useRef(0)
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
    const loadVersion = loadVersionRef
    return () => {
      loadVersion.current++
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

    const version = ++loadVersionRef.current
    const firstLoad = hydratedTagIdRef.current !== tagId
    const store = useTagStore.getState()
    const cached = firstLoad ? store.findById(tagId) : null
    const local = peekTimerState()
    const isFresh = (at: number | null) => at !== null &&
      Date.now() >= at && Date.now() - at < RUNNING_CACHE_FRESH_MS
    const fresh = isFresh(store.lastFetchedAt)
    // 오래된 서버 캐시의 RUNNING은 확인 전 표시하지 않는다. 오프라인 또는
    // 이 기기의 최신 조작은 복원해 네트워크 없이도 타이머를 계속 쓸 수 있게 한다.
    const localWins = cached && local?.tagId === tagId && local.savedAt >
      serverTimerChangedAt(cached.latestStartTimeMs, cached.latestStopTimeMs) &&
      (isFresh(local.savedAt) || peekPendingTimerOperations().some((op) => op.tagId === tagId))
    const cachedSw = cached ? computeStopwatchState(tagId, cached) : null
    const seedCache = () => {
      if (!cached || !cachedSw) return
      hydratedTagIdRef.current = tagId
      setTag(cached)
      setSw(cachedSw)
      if (cachedSw.isRunning) void requestWakeLock()
      else void releaseWakeLock()
    }
    if (firstLoad) {
      setConfirmedTagId(null)
      setTag(null)
      setSw(INITIAL_STATE)
      void releaseWakeLock()
      if (cachedSw && (!cachedSw.isRunning || fresh || localWins || !isOnline())) seedCache()
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
      if (version !== loadVersionRef.current) return
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
      if (version !== loadVersionRef.current) return
      // 요청 자체가 연결 불가를 확정한 뒤에는 오래된 캐시라도 오프라인 복원한다.
      if (firstLoad && !isOnline()) seedCache()
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
    const poll = setInterval(() => {
      if (isOnline() && isRunningRef.current) handleVisibilityChange()
    }, TIMER_REFRESH_INTERVAL_MS)
    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [requestWakeLock, armTicker, loadTag])

  const startStopwatch = useCallback(async () => {
    if (!tag || sw.isRunning) return
    loadVersionRef.current++
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

  // onSegment는 네트워크 POST 전, setSw와 같은 동기 구간에서 호출된다. 호출부(TodayView)가
  // "오늘 기록시간"을 낙관적으로 갱신하는 데 쓰는데, POST의 await 이후(반환값으로만) 갱신하면
  // 그 사이 한 번의 렌더가 isRunning=false·러닝 델타=0 인 상태로 화면에 노출돼 총합이 잠깐
  // 실제보다 작게 보였다가(POST 완료 시) 되돌아오는 깜빡임이 생긴다(GLOBAL-PIT류 회귀).
  const stopStopwatch = useCallback(async (onSegment?: (segment: number) => void) => {
    if (!tag || !sw.isRunning) return
    loadVersionRef.current++
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

    // setSw(newSw)와 동일한 동기 구간 — 아래 await 로 넘어가기 전에 반드시 불러야
    // 위 주석의 깜빡임이 안 생긴다.
    onSegment?.(segment)

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
    loadVersionRef.current++
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
