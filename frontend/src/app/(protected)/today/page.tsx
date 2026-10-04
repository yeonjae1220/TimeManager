'use client'

import { useAuthStore } from '@/store/authStore'
import TodayView from '@/views/TodayView'

// 홈 화면 앱·네이티브 앱의 시작 화면. URL 에 회원 id 가 없어 랜딩을 거치지 않고 바로 열 수 있다.
// 회원은 인증 스토어에서 읽는다 — 보호 레이아웃이 memberId 가 있을 때만 이 화면을 그리고,
// 로그아웃 상태면 /login 으로 보낸다.
export default function Page() {
  const memberId = useAuthStore((s) => s.memberId)
  if (memberId === null) return null
  // 쿠키가 캐시와 다른 회원의 것이면 refresh 가 memberId 를 바꾼다. /members/[id] 경로는
  // 보호 레이아웃이 URL 을 고쳐 화면이 새로 열리지만, 여기는 고칠 URL 이 없으므로 key 로
  // 다시 열어 이전 회원 기준으로 불러온 태그·타이머를 버린다.
  return <TodayView key={memberId} memberId={memberId} />
}
