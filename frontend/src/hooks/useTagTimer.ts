'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import apiClient from '@/utils/apiClient'
import { saveTimerState, peekTimerState, clearTimerState } from '@/utils/timerPersistence'
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
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const isRunningRef = useRef(false)

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null })
    } catch (e) {
      console.warn('Wake Lock 요청 실패:', e)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }, [])

  // isRunningRef를 sw.isRunning과 동기화 — visibilitychange 핸들러에서 안전하게 읽기 위함
  useEffect(() => { isRunningRef.current = sw.isRunning }, [sw.isRunning])

  // 탭이 다시 활성화되면 타이머 실행 중일 때 Wake Lock 재취득
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunningRef.current) {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [requestWakeLock])

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

      const newSw: StopwatchState = {
        isRunning: useLocalState ? saved!.isRunning : data.state,
        latestStartTime: useLocalState ? (saved!.latestStartTime ?? 0) : (data.latestStartTimeMs ?? 0),
        latestEndTime: useLocalState ? (saved!.latestEndTime ?? 0) : (data.latestStopTimeMs ?? 0),
        elapsedTime: useLocalState ? saved!.elapsedTime : data.elapsedTime,
        dailyTotalTime: data.dailyTotalTime || 0,
        dailyGoalTime: data.dailyGoalTime || 0,
        tagTotalTime: data.tagTotalTime || 0,
        totalTime: data.totalTime || 0,
        elapsedTimeCal: useLocalState ? saved!.elapsedTime : data.elapsedTime,
        dailyTotalTimeCal: data.dailyTotalTime || 0,
        tagTotalTimeCal: data.tagTotalTime || 0,
        totalTimeCal: data.totalTime || 0,
      }
      setSw(newSw)
      if (newSw.isRunning) requestWakeLock()
    } catch (e) {
      console.error('Failed to load tag:', e)
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
      console.warn('Stop API failed (offline?):', e)
    }
  }, [tag, sw, releaseWakeLock])

  const resetStopwatch = useCallback(() => {
    if (!tag || sw.isRunning) return
    setSw((prev) => ({ ...prev, elapsedTime: 0, elapsedTimeCal: 0 }))
    clearTimerState()
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
