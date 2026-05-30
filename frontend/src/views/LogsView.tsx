'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/utils/apiClient'

interface Record {
  id: number
  tagName: string
  elapsedTime: number
  startTime: string
  endTime: string
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00'
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function LogsView() {
  const memberId = useAuthStore((s) => s.memberId)
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!memberId) return
    setLoading(true)
    apiClient
      .get<Record[]>(`/api/v1/records?memberId=${memberId}&page=0&size=50`)
      .then((res) => setRecords(res.data))
      .catch(() => setError('기록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [memberId])

  return (
    <AppShell>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
        </div>

        <div style={{ padding: '24px 0' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
            logs
          </p>

          {loading && <div className="spinner" style={{ margin: '40px auto' }} />}
          {error && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>}

          {!loading && records.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>기록이 없습니다.</p>
          )}

          <div>
            {records.map((record) => (
              <div
                key={record.id}
                style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{record.tagName}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{formatTime(record.elapsedTime)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)' }}>
                  <span className="mono">{new Date(record.startTime).toLocaleTimeString()}</span>
                  <span>→</span>
                  <span className="mono">{new Date(record.endTime).toLocaleTimeString()}</span>
                  <span className="mono">{new Date(record.startTime).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
