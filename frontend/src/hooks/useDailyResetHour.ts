'use client'

import { useCallback } from 'react'
import apiClient from '@/utils/apiClient'
import { useAsyncData } from './useAsyncData'

interface CachedSettings {
  resetHour: number
  /** 회원 프로필의 시간대(IANA 이름, 예: "Asia/Seoul"). 응답에 없으면 undefined —
   * 호출부는 이를 "브라우저 기본 시간대를 쓰라"는 뜻으로 받아들인다. */
  timezone: string | undefined
}

/** memberId → {dailyResetHour, timezone}. 프로필 저장 성공 시 invalidateDailyResetHour로 즉시 무효화된다. */
const cache = new Map<number, CachedSettings>()

/** 테스트 전용 — 모듈 전체 캐시 격리(여러 memberId를 다루는 테스트 간 격리용). */
export function __resetDailyResetHourCache(): void {
  cache.clear()
}

/**
 * 회원이 dailyResetHour를 바꾼 뒤 호출한다(ProfileView 저장 성공 경로). TTL 없이
 * 세션 내내 캐시하므로, 저장 직후 즉시 무효화하지 않으면 같은 세션에서 재방문한
 * 화면이 낡은 경계로 "오늘"을 계산해 이 훅이 없애려던 바로 그 불일치가
 * 캐시를 통해 재도입된다.
 */
export function invalidateDailyResetHour(memberId: number): void {
  cache.delete(memberId)
}

export interface DailyResetHourState {
  resetHour: number | null
  /** 회원 프로필의 시간대. resetHour와 마찬가지로 로딩 중·실패 시 undefined —
   * 호출부(resolveTodaySummaryDateParam)는 이 경우 브라우저 기본 시간대로 계산한다. */
  timezone: string | undefined
  /**
   * 확정 실패 여부. "로딩 중"(resetHour===null && failed===false)과 구분해야 한다 —
   * 구분 못 하면 로딩 중에도 reload()를 걸어 마운트마다 요청이 중복되거나, 반대로
   * 확정 실패를 로딩 중으로 오인해 재시도를 놓친다. 호출부(TodayView)는 이 값으로
   * connectivity 신호(온라인 전환)와 무관하게 재시도할지 판단한다 — 그 신호는 응답이
   * 있는 4xx/5xx 실패에는 오지 않는다(apiClient 인터셉터가 reportReachable()을 부름).
   */
  failed: boolean
  /** 최초 조회가 실패했을 때 재시도한다. 실패 후 자동 재시도는 없으므로 호출부가 명시적으로 불러야 한다. */
  reload: () => void
}

/**
 * "오늘"의 경계(자정이 아니라 dailyResetHour)를 계산하는 데 필요한 회원 설정.
 *
 * 로딩 중이거나 실패했을 때 5(백엔드 기본값) 같은 임의 기본값으로 조용히 대체하지
 * 않는다 — 실제 설정이 다르면 잘못된 경계로 조회해 GLOBAL-PIT-108 계열의 값 위장이
 * 된다. 호출부는 null을 "아직 이 경계로 조회할 수 없다"는 뜻으로 받아 그 조회를
 * 미뤄야 한다.
 */
export function useDailyResetHour(memberId: number | null): DailyResetHourState {
  const loader = useCallback(() => {
    const cached = cache.get(memberId as number)
    if (cached !== undefined) return Promise.resolve(cached)
    return apiClient
      .get<{ dailyResetHour: number; timezone?: string }>(`/api/v1/members/${memberId}`)
      .then((res) => {
        const settings: CachedSettings = { resetHour: res.data.dailyResetHour, timezone: res.data.timezone }
        cache.set(memberId as number, settings)
        return settings
      })
  }, [memberId])

  const { data, failed, reload } = useAsyncData(memberId != null ? loader : null)
  return { resetHour: data?.resetHour ?? null, timezone: data?.timezone, failed, reload }
}
