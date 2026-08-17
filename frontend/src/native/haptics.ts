'use client'

import { withPlugin } from '@/utils/nativeBridge'

/**
 * 타이머 조작의 촉각 피드백. 웹에서는 아무 일도 일어나지 않는다.
 *
 * 실패를 기다리지 않는다 — 호출부는 await 하지 말 것. 햅틱은 부가 효과이고
 * 타이머 조작을 한 틱이라도 늦춰서는 안 된다.
 */

const HAPTICS = 'Haptics'

/** 시작: 짧고 분명한 한 번. */
export function hapticStart(): void {
  void withPlugin(HAPTICS, () => import('@capacitor/haptics'), ({ Haptics, ImpactStyle }) =>
    Haptics.impact({ style: ImpactStyle.Medium }),
  )
}

/** 정지: "완료" 패턴 — 시작과 촉감이 달라야 눈으로 확인하지 않고도 구분된다. */
export function hapticStop(): void {
  void withPlugin(HAPTICS, () => import('@capacitor/haptics'), ({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Success }),
  )
}
