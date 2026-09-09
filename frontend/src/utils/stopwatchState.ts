import type { Tag } from '@/store/tagStore'
import { peekTimerState, peekResetTimerMarker, serverTimerChangedAt, shouldApplyResetTimerMarker } from './timerPersistence'

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

export function computeStopwatchState(tagId: number, data: Tag): StopwatchState {
  const saved = peekTimerState()
  const useLocalState = saved &&
    saved.tagId === tagId &&
    saved.savedAt > serverTimerChangedAt(data.latestStartTimeMs, data.latestStopTimeMs)
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

