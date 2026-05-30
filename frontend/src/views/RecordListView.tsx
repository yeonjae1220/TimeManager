'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import apiClient from '@/utils/apiClient'

interface Record {
  id: number
  elapsedTime: number
  startTime: string
  endTime: string
}

interface Tag {
  id: number
  name: string
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00'
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function RecordListView() {
  const params = useParams()
  const router = useRouter()
  const tagId = Number(params?.id)

  const [tag, setTag] = useState<Tag | null>(null)
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tagId) return
    setLoading(true)
    Promise.all([
      apiClient.get<Tag>(`/api/v1/tags/${tagId}`),
      apiClient.get<Record[]>(`/api/v1/records?tagId=${tagId}&page=0&size=100`),
    ])
      .then(([tagRes, recordsRes]) => {
        setTag(tagRes.data)
        setRecords(recordsRes.data)
      })
      .catch(() => setError('기록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [tagId])

  return (
    <AppShell>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
          <button
            onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>

        <div style={{ padding: '24px 0' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            tag · {tagId}
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, marginBottom: 24 }}>
            {tag?.name ?? 'Sessions'}
          </h1>

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
                  <span className="mono" style={{ fontSize: 13 }}>{formatTime(record.elapsedTime)}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {new Date(record.startTime).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
                  <span className="mono">{new Date(record.startTime).toLocaleTimeString()}</span>
                  <span>→</span>
                  <span className="mono">{new Date(record.endTime).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
