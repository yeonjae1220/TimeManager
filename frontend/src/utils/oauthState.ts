'use client'

const COOKIE_NAME = 'timemgr_oauth_state'
const MAX_AGE = 300

export function saveOauthState(state: string): void {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${state}; path=/; max-age=${MAX_AGE}; SameSite=Lax${secure}`
}

export function consumeOauthState(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
  return match ? decodeURIComponent(match[1]) : null
}
