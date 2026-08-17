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

export function useTagTimer() {
  const [tag, setTag] = useState<Tag | null>(null)
  const [sw, setSw] = useState<StopwatchState>(INITIAL_STATE)
  const [isWakeLockActive, setIsWakeLockActive] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const isRunningRef = useRef(false)
  // 포그라운드 복귀 재조회용 — 마지막으로 loadTag 에 넘어온 인자와 마지막 재조회 시각.
  const lastLoadArgsRef = useRef<{ tagId: number; memberId: number } | null>(null)
  const lastForegroundRefreshRef = useRef(0)

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
      const delta = Math.floor((Date.now() - prev.latestStartTime) / 1000)
      if (delta < 0) return prev
      return {
        ...prev,
        elapsedTimeCal: delta + prev.elapsedTime,
        dailyTotalTimeCal: prev.dailyTotalTime + delta,
        tagTotalTimeCal: prev.tagTotalTime + delta,
        totalTimeCal: prev.totalTime + delta,
      }
    })
  }, [])

  // 1초 인터벌 — RAF 60fps 대비 배터리/CPU 60배 절감
  useEffect(() => {
    if (!sw.isRunning) return
    tick() // 즉시 1회 실행 (시작 시 0초 표시 방지)
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sw.isRunning, tick])

  const loadTag = useCallback(async (tagId: number, memberId: number) => {
    lastLoadArgsRef.current = { tagId, memberId }
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
      setTag(data)

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

      const newSw: StopwatchState = {
        isRunning: useResetMarker ? false : useLocalState ? saved!.isRunning : data.state,
        latestStartTime: useResetMarker ? 0 : useLocalState ? (saved!.latestStartTime ?? 0) : (data.latestStartTimeMs ?? 0),
        latestEndTime: useResetMarker ? 0 : useLocalState ? (saved!.latestEndTime ?? 0) : (data.latestStopTimeMs ?? 0),
        elapsedTime: useResetMarker ? 0 : useLocalState ? saved!.elapsedTime : data.elapsedTime,
        dailyTotalTime: data.dailyTotalTime || 0,
        dailyGoalTime: data.dailyGoalTime || 0,
        tagTotalTime: data.tagTotalTime || 0,
        totalTime: data.totalTime || 0,
        elapsedTimeCal: useResetMarker ? 0 : useLocalState ? saved!.elapsedTime : data.elapsedTime,
        dailyTotalTimeCal: data.dailyTotalTime || 0,
        tagTotalTimeCal: data.tagTotalTime || 0,
        totalTimeCal: data.totalTime || 0,
      }
      setSw(newSw)
      if (newSw.isRunning) requestWakeLock()

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
  }, [requestWakeLock])

  // 포그라운드 복귀 처리. 두 가지를 한다:
  //  1) 실행 중이면 Wake Lock 재취득 — OS 가 백그라운드 전환 시 자동 해제한다.
  //  2) loadTag 재조회 — "다른 기기에서 정지"로 생긴 유령 알림/유령 Live Activity 를
  //     죽이는 유일한 실효 수단이다. 재조회 결과가 loadTag 안에서 그대로
  //     syncNativeRunningSession 으로 흘러가므로 여기에 별도 sync 를 두지 않는다.
  // Capacitor WebView 는 앱 전환에도 visibilitychange 를 발화하므로 appStateChange
  // 리스너를 따로 붙일 필요가 없다.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (isRunningRef.current) requestWakeLock()

      const args = lastLoadArgsRef.current
      if (!args) return
      const now = Date.now()
      if (now - lastForegroundRefreshRef.current < FOREGROUND_REFRESH_THROTTLE_MS) return
      lastForegroundRefreshRef.current = now
      void loadTag(args.tagId, args.memberId)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [requestWakeLock, loadTag])

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
