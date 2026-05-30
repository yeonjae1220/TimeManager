'use client'

import TabBar from './TabBar'

interface AppShellProps {
  children: React.ReactNode
  isRunning?: boolean
}

export default function AppShell({ children, isRunning = false }: AppShellProps) {
  return (
    <div className="app-shell">
      {children}
      <TabBar isRunning={isRunning} />
    </div>
  )
}
