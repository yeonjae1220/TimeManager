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

export function useTagTimer() {
  const [tag, setTag] = useState<Tag | null>(null)
  const [sw, setSw] = useState<StopwatchState>(INITIAL_STATE)
  const [isWakeLockActive, setIsWakeLockActive] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const isRunningRef = useRef(false)

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

  // 탭이 다시 활성화되면 타이머 실행 중일 때 Wake Lock 재취득
  // (OS가 백그라운드 전환 시 자동으로 wake lock을 해제하므로 복귀 시 재취득 필요)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunningRef.current) {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [requestWakeLock])

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
    } catch (e) {
      console.error('Failed to load tag:', e instanceof Error ? e.message : String(e))
    }
  }, [requestWakeLock])

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
    const elapsed = Math.floor((endTime - sw.latestStartTime) / 1000) + sw.elapsedTime
    const newSw = { ...sw, isRunning: false, latestEndTime: endTime, elapsedTime: elapsed, elapsedTimeCal: elapsed }
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
  }, [tag, sw, releaseWakeLock])

  const resetStopwatch = useCallback(async () => {
    if (!tag || sw.isRunning) return
    const hasPendingTimerOperation = peekPendingTimerOperation() !== null
    setSw((prev) => ({ ...prev, elapsedTime: 0, elapsedTimeCal: 0 }))
    saveResetTimerMarker(tag.id)
    clearTimerState()

    try {
      await apiClient.post(`/api/v1/tags/${tag.id}/timer/reset`, {
        elapsedTime: 0,
      })
      const tagStore = useTagStore.getState()
      if (hasPendingTimerOperation) {
        enqueuePendingTimerOperation({
          type: 'reset',
          tagId: tag.id,
          elapsedTime: 0,
        })
        tagStore.retryPendingTimerOp().then(() => {
          if (tag.memberId) tagStore.refreshTags(tag.memberId)
        })
      } else if (tag.memberId) {
        tagStore.refreshTags(tag.memberId)
      }
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
