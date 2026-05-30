'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { useTagStore, type Tag } from '@/store/tagStore'

function TagItem({ tag, depth = 0 }: { tag: Tag; depth?: number }) {
  const isRunning = tag.state

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 0',
        paddingLeft: depth * 16,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: isRunning ? 'var(--running)' : 'var(--border)', flexShrink: 0, boxShadow: isRunning ? '0 0 6px var(--running)' : undefined }} />
        <span style={{ flex: 1, fontSize: 13 }}>{tag.name}</span>
        {isRunning && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--running)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>LIVE</span>
        )}
      </div>
      {tag.children?.map((child) => (
        <TagItem key={child.id} tag={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function TagListView() {
  const params = useParams()
  const memberId = Number(params?.id)
  const tagStore = useTagStore()

  useEffect(() => {
    if (memberId) tagStore.loadTags(memberId)
  }, [memberId, tagStore])

  const tagList = tagStore.rootTag?.children ?? []

  return (
    <AppShell>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
        </div>

        <div style={{ padding: '24px 0' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
            tags
          </p>

          {tagStore.fetchError && (
            <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 16 }}>
              태그를 불러오지 못했습니다.
            </p>
          )}

          {tagList.length === 0 && !tagStore.isRefreshing ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>태그가 없습니다.</p>
          ) : (
            <div>
              {tagList.map((tag) => (
                <TagItem key={tag.id} tag={tag} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
