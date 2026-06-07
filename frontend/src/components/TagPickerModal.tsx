'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { type Tag } from '@/store/tagStore'
import { useTagStore } from '@/store/tagStore'
import { useI18n } from '@/i18n/I18nProvider'

interface TagPickerModalProps {
  tagTree: Tag[]
  currentTagId: number | null
  onSelect: (tagId: number) => void
  onClose: () => void
}

function getVisibleChildren(tagTree: Tag[]): Tag[] {
  const root = tagTree.find((t) => t.type === 'ROOT')
  if (!root) return []
  return root.children.filter((t) => t.type !== 'DISCARDED')
}

function findNode(nodes: Tag[], id: number): Tag | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

function flattenTags(nodes: Tag[], path: string[] = []): { tag: Tag; path: string }[] {
  return nodes.flatMap((tag) => {
    const nextPath = [...path, tag.name]
    const visibleChildren = tag.children.filter((t) => t.type !== 'DISCARDED')
    return [
      { tag, path: nextPath.join(' / ') },
      ...flattenTags(visibleChildren, nextPath),
    ]
  })
}

export default function TagPickerModal({ tagTree, currentTagId, onSelect, onClose }: TagPickerModalProps) {
  const { t: tr } = useI18n()
  const [pathIds, setPathIds] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const recentTagIds = useTagStore((s) => s.recentTagIds)
  const findById = useTagStore((s) => s.findById)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const currentChildren: Tag[] = pathIds.length === 0
    ? getVisibleChildren(tagTree)
    : (() => {
        const node = findNode(tagTree, pathIds[pathIds.length - 1])
        return node?.children.filter((t) => t.type !== 'DISCARDED') ?? []
      })()

  const navigateInto = useCallback((tag: Tag) => {
    const hasChildren = tag.children.filter((t) => t.type !== 'DISCARDED').length > 0
    if (hasChildren) {
      setPathIds((prev) => [...prev, tag.id])
    } else {
      onSelect(tag.id)
    }
  }, [onSelect])

  const selectTag = useCallback((tagId: number) => {
    onSelect(tagId)
  }, [onSelect])

  const navigateBack = useCallback(() => {
    setPathIds((prev) => prev.slice(0, -1))
  }, [])

  const breadcrumb: Tag[] = pathIds.map((id) => findNode(tagTree, id)).filter(Boolean) as Tag[]
  const flattenedTags = useMemo(() => flattenTags(getVisibleChildren(tagTree)), [tagTree])
  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = normalizedQuery
    ? flattenedTags.filter(({ path }) => path.toLowerCase().includes(normalizedQuery)).slice(0, 12)
    : []
  const recentTags = recentTagIds
    .map((id) => findById(id))
    .filter((tag): tag is Tag => tag !== null && tag.type !== 'DISCARDED')
    .slice(0, 4)
  const runningTags = flattenedTags
    .map(({ tag }) => tag)
    .filter((tag) => tag.state && tag.type !== 'DISCARDED')
    .slice(0, 4)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'blur(2px)', padding: '20px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', maxHeight: '70vh', overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        {pathIds.length > 0 ? (
          <button
            onClick={navigateBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <div style={{ width: 20 }} />
        )}

        {/* Breadcrumb */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: pathIds.length > 0 ? 'pointer' : 'default', flexShrink: 0 }}
            onClick={() => setPathIds([])}
          >
            {tr('tagPicker.root')}
          </span>
          {breadcrumb.map((b) => (
            <span key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 0 }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M2 1.5l3 2.5-3 2.5" stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
            </span>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          {tr('tagPicker.search')}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px' }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
            <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('tagPicker.searchPlaceholder')}
            style={{ width: '100%', height: 38, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label={tr('common.cancel')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, color: 'var(--text-3)', cursor: 'pointer' }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tag list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!normalizedQuery && runningTags.length > 0 && (
          <div style={{ padding: '6px 16px 10px' }}>
            <p className="mono" style={{ fontSize: 9, color: 'var(--running)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{tr('tagPicker.running')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {runningTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => selectTag(tag.id)}
                  style={{ minHeight: 34, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--running)', boxShadow: '0 0 8px var(--running)' }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!normalizedQuery && recentTags.length > 0 && (
          <div style={{ padding: '6px 16px 10px' }}>
            <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{tr('tagPicker.recent')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recentTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => selectTag(tag.id)}
                  style={{ minHeight: 34, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: tag.state ? 'var(--running)' : 'var(--text-3)' }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {normalizedQuery && searchResults.length === 0 && (
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '40px 20px' }}>
            {tr('tagPicker.noResults')}
          </p>
        )}

        {normalizedQuery && searchResults.map(({ tag, path }) => {
          const isActive = tag.id === currentTagId
          return (
            <button
              key={tag.id}
              onClick={() => selectTag(tag.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '10px 20px', background: isActive ? 'var(--accent-bg)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: isActive ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: tag.state ? 'var(--running)' : isActive ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
                <span className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
              </span>
            </button>
          )
        })}

        {!normalizedQuery && currentChildren.length === 0 && (
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '40px 20px' }}>
            {tr('tagPicker.empty')}
          </p>
        )}
        {!normalizedQuery && currentChildren.map((t) => {
          const hasChildren = t.children.filter((c) => c.type !== 'DISCARDED').length > 0
          const isActive = t.id === currentTagId

          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-subtle)',
                background: isActive ? 'var(--accent-bg)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text)',
              }}
            >
              <button
                onClick={() => navigateInto(t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: 1,
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                  minWidth: 0,
                  minHeight: 52,
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: t.state ? 'var(--running)' : isActive ? 'var(--accent)' : 'var(--text-3)',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                {(t.dailyTotalTime ?? 0) > 0 && (
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
                    {Math.floor((t.dailyTotalTime ?? 0) / 3600)}h {Math.floor(((t.dailyTotalTime ?? 0) % 3600) / 60)}m
                  </span>
                )}
                {hasChildren && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              {hasChildren && (
                <button
                  onClick={() => selectTag(t.id)}
                  aria-label={tr('tagPicker.selectAria', { name: t.name })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 78,
                    height: 52,
                    padding: '0 12px',
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: isActive ? 'var(--accent)' : 'var(--text-3)',
                    borderLeft: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                  }}
                >
                  {tr('tagPicker.selectThis')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}
