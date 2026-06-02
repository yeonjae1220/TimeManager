'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n/I18nProvider'

interface TabBarProps {
  isRunning?: boolean
}

export default function TabBar({ isRunning = false }: TabBarProps) {
  const pathname = usePathname()
  const memberId = useAuthStore((s) => s.memberId)
  const { t } = useI18n()

  const isToday = pathname?.includes('/today') ?? false
  const isTags = pathname?.includes('/tags') ?? false
  const isLogs = pathname === '/logs'
  const isProfile = pathname === '/profile'

  return (
    <nav className={`tab-bar${isRunning ? ' tab-bar--running' : ''}`}>
      {isRunning && <div className="tab-bar--running-line" />}

      <Link href={`/members/${memberId}/today`} className={`tab${isToday ? ' tab--active' : ''}`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.1 4.1l1.4 1.4M12.5 12.5l1.4 1.4M4.1 13.9l1.4-1.4M12.5 5.5l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="tab-label">{t('nav.today')}</span>
      </Link>

      <Link href={`/members/${memberId}/tags`} className={`tab${isTags ? ' tab--active' : ''}`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 5h12M3 9h8M3 13h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="tab-label">{t('nav.tags')}</span>
      </Link>

      <Link href="/logs" className={`tab${isLogs ? ' tab--active' : ''}`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="3" y="3" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M6 7h6M6 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="tab-label">{t('nav.logs')}</span>
      </Link>

      <Link href="/profile" className={`tab${isProfile ? ' tab--active' : ''}`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M3.5 14.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="tab-label">{t('nav.profile')}</span>
      </Link>
    </nav>
  )
}
