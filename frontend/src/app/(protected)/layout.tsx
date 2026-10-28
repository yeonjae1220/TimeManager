'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { canOpenOptimistically, useAuthStore } from '@/store/authStore'
import { getRecentRefreshOutcome, refreshAuth } from '@/utils/refreshAuth'
import { useI18n } from '@/i18n/I18nProvider'
import { NativeTimerSync } from '@/components/NativeTimerSync'

type AuthPhase = 'restoring' | 'ready' | 'offline'

const MEMBER_PATH = /^\/members\/(\d+)(?=\/|$)/

/** 랜딩에서 이 레이아웃까지의 라우팅 시간만 덮으면 된다 — 길면 진짜 재시도를 막는다. */
const RECENT_REFRESH_REUSE_MS = 5_000

/**
 * URL 의 회원 id 가 인증된 회원과 다르면 고친 경로를, 같거나 URL 에 회원 id 가 없으면 null.
 * 낙관적 진입은 캐시된 memberId 로 URL 을 만들기 때문에, 쿠키가 다른 회원의 것이면
 * 그 회원의 토큰으로 남의 자원을 요청해 403 이 쏟아진다.
 */
function correctedMemberPath(pathname: string | null, memberId: number): string | null {
  const match = pathname ? MEMBER_PATH.exec(pathname) : null
  if (!match || Number(match[1]) === memberId) return null
  return pathname!.replace(MEMBER_PATH, `/members/${memberId}`)
}

function AuthSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        {[70, 50, 50, 30].map((w, i) => (
          <div key={i} style={{
            height: 12, borderRadius: 6, background: 'var(--surface-2)',
            width: `${w}%`, animation: 'pulse 1.4s ease infinite',
            animationDelay: `${i * 0.12}s`,
          }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
    </div>
  )
}

function ReconnectScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useI18n()
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 280, textAlign: 'center' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s ease infinite' }} />
        <p role="status" aria-live="polite" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{t('auth.reconnecting')}</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onRetry}
          disabled={retrying}
          style={{ height: 36, padding: '0 20px', fontSize: 13 }}
        >
          {t('auth.retry')}
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
    </div>
  )
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { memberId, accessToken, clearAuth } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  // accessToken이 있으면(인앱 네비게이션) 물론이고, 최근에 인증된 세션 흔적만 남아
  // 있어도(콜드 스타트, canOpenOptimistically) 낙관적으로 즉시 통과시킨다 — refresh 왕복이
  // 끝날 때까지 스켈레톤으로 화면 전체를 막으면 그 뒤 타이머 화면(태그 로드·시작
  // 버튼)까지 통째로 지연된다. restore()는 그대로 아래 effect에서 백그라운드로
  // 돌고, unauthenticated로 판명되면 clearAuth()가 memberId를 지워 아래
  // `!memberId` 가드가 화면을 안전하게 닫는다(오프라인 재전송 큐와 같은 원칙:
  // 먼저 낙관적으로 반영 → 서버 응답으로 화해).
  //
  // ⚠️ 이 낙관적 판정을 useState 초기화에서 하면 안 된다. 서버에는 스토어도
  // localStorage 도 없어 항상 'restoring'(스켈레톤)이 나오는데, 클라이언트 첫
  // 렌더가 zustand persist 로 복원된 memberId 를 보고 'ready'(children)를 내면
  // 서버 HTML 과 다른 트리가 된다. 이때 hydration 은 서버가 그린 스켈레톤 노드를
  // **지우지 않고 그대로 남긴 채** 앱 본체를 형제로 덧붙인다 — 실측한 컨테이너:
  //   [0] <div> 828B  ← 펄스 스켈레톤(회색 막대 4개), 살아남음
  //   [1] <div class="app-shell">  ← 새로 붙은 앱 본체
  // .app-shell 은 position:fixed 라 [0] 위에 겹치는데 그 자신이 투명하면
  // 스켈레톤이 콘텐츠 영역 전체에 비쳐 "모든 화면 뒤에서 회색 막대가 깜빡"인다.
  // React 가 recoverable error 조차 남기지 않아 콘솔에 아무 흔적이 없다.
  // 첫 렌더는 서버와 똑같이 두고, 판정은 아래 마운트 effect 에서 한다
  // (회귀 테스트: layout.test.tsx 의 'hydration 후 서버 스켈레톤이 DOM 에 남지 않는다').
  const [phase, setPhase] = useState<AuthPhase>('restoring')
  const [retrying, setRetrying] = useState(false)
  const inFlight = useRef(false)

  const restore = useCallback(async () => {
    if (inFlight.current) return
    // 이미 메모리에 토큰이 있으면(앱 내 네비게이션) refresh 불필요
    if (useAuthStore.getState().accessToken) {
      setPhase('ready')
      return
    }
    inFlight.current = true
    setRetrying(true)
    try {
      const result = await refreshAuth()
      if (result.status === 'authenticated') {
        setPhase('ready')
      } else if (result.status === 'unauthenticated') {
        clearAuth()
        router.replace('/login')
      } else {
        setPhase('offline')
      }
    } finally {
      inFlight.current = false
      setRetrying(false)
    }
  }, [clearAuth, router])

  // 최초 복원 — localStorage의 memberId 유무로 restore 자체를 막지 않는다.
  // 진짜 자격증명은 httpOnly refresh 쿠키이고, restore()가 이를 시도해 실패하면
  // (unauthenticated) 그때 /login으로 보낸다. memberId는 iOS 콜드 스타트에서
  // 쿠키보다 먼저 사라질 수 있어(GLOBAL-PIT-052 계열), 이를 게이트로 쓰면
  // 쿠키가 살아있어도 refresh를 시도조차 안 하고 강제 로그아웃되는 버그가 생긴다.
  useEffect(() => {
    const state = useAuthStore.getState()
    // accessToken 이 있으면(앱 내 네비게이션) 확정 통과 — refresh 불필요.
    if (state.accessToken) {
      setPhase('ready')
      return
    }
    // 최근에 인증된 세션 흔적이 있으면(콜드 스타트) 먼저 열고, restore() 는 그대로
    // 배경에서 돌려 서버 응답으로 화해한다. 흔적이 오래됐으면(서버 세션이 이미 만료됐을
    // 수 있음) 열었다가 로그인으로 튕기는 대신 결과를 기다린다.
    if (canOpenOptimistically(state, Date.now())) setPhase('ready')
    // 랜딩이 방금 refresh 사슬을 다 돌고 offline 을 받아 이리 보냈다면 같은 사슬을 다시
    // 돌리지 않는다 — 그동안 스켈레톤이 화면을 막는다. refresh 를 건너뛰는 게 아니라
    // 방금 끝난 시도의 결과를 쓰는 것이고, 다음 시도는 연결 복구 신호(아래 effect)가 맡는다.
    else if (getRecentRefreshOutcome(RECENT_REFRESH_REUSE_MS)?.status === 'offline') {
      setPhase('offline')
      return
    }
    void restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 인증이 확정된 뒤 URL 의 회원이 다르면 바로잡는다. restore() 안이 아니라 여기서
  // 보는 이유: 랜딩이 먼저 시작한 refresh 가 이 레이아웃 마운트 전에 끝나면 restore()
  // 는 토큰이 이미 있다고 보고 바로 통과한다 — 그 경로에서도 잡혀야 한다.
  useEffect(() => {
    if (!accessToken || memberId === null) return
    const corrected = correctedMemberPath(pathname, memberId)
    if (corrected) router.replace(corrected)
  }, [accessToken, memberId, pathname, router])

  // 연결 복구 시(온라인 전환·앱 포그라운드 복귀) 자동 재시도
  useEffect(() => {
    if (phase !== 'offline') return
    const onReconnectSignal = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void restore()
      }
    }
    window.addEventListener('online', onReconnectSignal)
    document.addEventListener('visibilitychange', onReconnectSignal)
    return () => {
      window.removeEventListener('online', onReconnectSignal)
      document.removeEventListener('visibilitychange', onReconnectSignal)
    }
  }, [phase, restore])

  if (phase === 'restoring') return <AuthSkeleton />

  // 오프라인이라도 이 기기에 이전 세션 흔적(memberId)이 있으면 앱을 연다.
  // 화면은 로컬 캐시(태그 idb·타이머 localStorage)로 서고, 타이머 조작은 대기 큐에
  // 쌓였다가 복귀 시 재전송된다 — 그 기계는 이미 있고 테스트로 지켜진다.
  // 흔적이 없으면 보여줄 데이터도 이어붙일 세션도 없으므로 재연결 화면을 유지한다.
  //
  // ⚠️ 이 분기는 refreshAuth 가 이미 'offline' 을 돌려준 뒤에만 닿는다. memberId 로
  // 복원 시도 자체를 막지 않는다는 원칙(로컬 캐시는 쿠키보다 먼저 사라질 수 있다)은
  // 위 restore() 에서 그대로 지켜진다.
  if (phase === 'offline' && !memberId) {
    return <ReconnectScreen onRetry={() => void restore()} retrying={retrying} />
  }
  if (!memberId) return null

  return <><NativeTimerSync memberId={memberId} />{children}</>
}
