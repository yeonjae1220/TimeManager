'use client'

import { useCallback } from 'react'
import apiClient from '@/utils/apiClient'
import { useAsyncData } from './useAsyncData'

/** memberId → dailyResetHour. 프로필 저장 성공 시 invalidateDailyResetHour로 즉시 무효화된다. */
const cache = new Map<number, number>()

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
      .get<{ dailyResetHour: number }>(`/api/v1/members/${memberId}`)
      .then((res) => {
        cache.set(memberId as number, res.data.dailyResetHour)
        return res.data.dailyResetHour
      })
  }, [memberId])

  const { data, reload } = useAsyncData(memberId != null ? loader : null)
  return { resetHour: data, reload }
}
