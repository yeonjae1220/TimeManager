'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { useTagStore, selectTagList, type Tag } from '@/store/tagStore'
import { useI18n } from '@/i18n/I18nProvider'

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function findDiscardedId(tagTree: Tag[]): number | null {
  for (const node of tagTree) {
    if (node.type === 'DISCARDED') return node.id
    for (const child of node.children) {
      if (child.type === 'DISCARDED') return child.id
    }
  }
  return null
}

function getSiblingNames(tagTree: Tag[], parentId: number | null, excludeId?: number): string[] {
  const search = (nodes: Tag[]): string[] => {
    for (const n of nodes) {
      if (n.id === parentId) {
        return n.children
          .filter((c) => c.type !== 'DISCARDED' && c.id !== excludeId)
          .map((c) => c.name.toLowerCase())
      }
      const found = search(n.children)
      if (found.length > 0 || n.id === parentId) return found
    }
    return []
  }
  if (parentId === null) return []
  return search(tagTree)
}

function getParentId(tagTree: Tag[], tagId: number): number | null {
  const search = (nodes: Tag[], parent: Tag | null): number | null => {
    for (const n of nodes) {
      if (n.id === tagId) return parent?.id ?? null
      const found = search(n.children, n)
      if (found !== undefined && found !== null) return found
      // check if direct child matched
      if (n.children.some((c) => c.id === tagId)) return n.id
    }
    return null
  }
  return search(tagTree, null)
}

// ────────────────────────────────────────────────────────────
// Edit Modal
// ────────────────────────────────────────────────────────────

interface EditModalProps {
  tag: Tag
  tagTree: Tag[]
  onClose: () => void
  onRename: (id: number, name: string) => Promise<void>
  onMove: (id: number, newParentId: number) => Promise<void>
  onDiscard: (id: number) => Promise<void>
}

function EditTagModal({ tag, tagTree, onClose, onRename, onMove, onDiscard }: EditModalProps) {
  const { t } = useI18n()
  const parentId = getParentId(tagTree, tag.id)
  const siblings = getSiblingNames(tagTree, parentId, tag.id)

  const [name, setName] = useState(tag.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isDuplicateName = name.trim().toLowerCase() !== tag.name.toLowerCase() &&
    siblings.includes(name.trim().toLowerCase())

  // Flat list of eligible parent tags (all non-DISCARDED, non-self, non-descendant)
  function collectParents(nodes: Tag[], excludeId: number, depth = 0): { id: number; name: string; depth: number }[] {
    const result: { id: number; name: string; depth: number }[] = []
    for (const n of nodes) {
      if (n.id === excludeId) continue
      if (n.type === 'DISCARDED') continue
      if (n.type !== 'LEAF') result.push({ id: n.id, name: n.name, depth })
      result.push(...collectParents(n.children, excludeId, depth + 1))
    }
    return result
  }
  const parentOptions = collectParents(tagTree, tag.id)
  const [selectedParent, setSelectedParent] = useState<number>(parentId ?? 0)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError('')
    try {
      if (trimmed !== tag.name) await onRename(tag.id, trimmed)
      if (selectedParent && selectedParent !== parentId) await onMove(tag.id, selectedParent)
      onClose()
    } catch {
      setError(t('common.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDiscard() {
    if (!confirm(t('tags.discardConfirm', { name: tag.name }))) return
    setSaving(true)
    try {
      await onDiscard(tag.id)
      onClose()
    } catch {
      setError(t('tags.discardFail'))
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'blur(2px)', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: 'var(--shadow-modal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t('tags.editTag')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ background: 'var(--input-bg)', border: `1px solid ${isDuplicateName ? 'var(--warning, #f59e0b)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          {isDuplicateName && (
            <p className="mono" style={{ fontSize: 10, color: 'var(--warning, #f59e0b)' }}>{t('tags.dupName')}</p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('tags.parentTag')}</label>
          <select
            value={selectedParent}
            onChange={(e) => setSelectedParent(Number(e.target.value))}
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          >
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {'  '.repeat(p.depth)}{p.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={handleDiscard}
            disabled={saving}
            style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving ? 0.4 : 1 }}
          >
            {t('common.delete')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving || !name.trim() ? 0.4 : 1 }}
            >
              {saving ? '...' : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Add Tag inline form
// ────────────────────────────────────────────────────────────

interface AddTagFormProps {
  parentId: number
  siblingNames: string[]
  onAdd: (name: string) => Promise<void>
  onCancel: () => void
}

function AddTagForm({ parentId: _parentId, siblingNames, onAdd, onCancel }: AddTagFormProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const isDuplicate = name.trim() !== '' && siblingNames.includes(name.trim().toLowerCase())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onAdd(trimmed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 8px 20px' }}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('tags.namePlaceholder')}
        style={{ flex: 1, background: 'var(--input-bg)', border: `1px solid ${isDuplicate ? 'var(--warning, #f59e0b)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
      />
      {isDuplicate && <span className="mono" style={{ fontSize: 9, color: 'var(--warning, #f59e0b)', whiteSpace: 'nowrap' }}>{t('tags.dupShort')}</span>}
      <button type="submit" disabled={saving || !name.trim()} style={{ padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', opacity: saving || !name.trim() ? 0.4 : 1 }}>
        {saving ? '...' : t('common.add')}
      </button>
      <button type="button" onClick={onCancel} style={{ padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
        ✕
      </button>
    </form>
  )
}

// ────────────────────────────────────────────────────────────
// Tag row
// ────────────────────────────────────────────────────────────

interface TagRowProps {
  tag: Tag
  depth: number
  memberId: number
  tagTree: Tag[]
  discardedId: number | null
  dragState: DragState
  onDragStart: (e: React.DragEvent, tag: Tag) => void
  onDragOver: (e: React.DragEvent, tag: Tag) => void
  onDrop: (e: React.DragEvent, tag: Tag) => void
  onDragEnd: () => void
  onEditOpen: (tag: Tag) => void
  onAddChildOpen: (parentId: number) => void
  onRename: (id: number, name: string) => Promise<void>
  onMove: (id: number, newParentId: number) => Promise<void>
  onDiscard: (id: number) => Promise<void>
}

interface DragState {
  draggingId: number | null
  overId: number | null
}

function TagRow({
  tag, depth, memberId, tagTree, discardedId, dragState,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onEditOpen, onAddChildOpen,
}: TagRowProps) {
  const router = useRouter()
  const { t } = useI18n()
  const isRunning = tag.state
  const isDragging = dragState.draggingId === tag.id
  const isOver = dragState.overId === tag.id

  const visibleChildren = tag.children.filter((c) => c.type !== 'DISCARDED')
  const isLeaf = visibleChildren.length === 0

  function handleClick() {
    if (isLeaf) {
      router.push(`/members/${memberId}/today?tagId=${tag.id}`)
    }
  }

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, tag)}
        onDragOver={(e) => onDragOver(e, tag)}
        onDrop={(e) => onDrop(e, tag)}
        onDragEnd={onDragEnd}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: depth * 16 + 4,
          paddingRight: 8,
          minHeight: 50,
          paddingTop: 8,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-subtle)',
          opacity: isDragging ? 0.4 : 1,
          background: isOver ? 'var(--surface-2)' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        {/* Drag handle */}
        <span style={{ color: 'var(--text-3)', cursor: 'grab', display: 'flex', flexShrink: 0, opacity: 0.5 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="4" cy="3" r="1" fill="currentColor"/>
            <circle cx="8" cy="3" r="1" fill="currentColor"/>
            <circle cx="4" cy="6" r="1" fill="currentColor"/>
            <circle cx="8" cy="6" r="1" fill="currentColor"/>
            <circle cx="4" cy="9" r="1" fill="currentColor"/>
            <circle cx="8" cy="9" r="1" fill="currentColor"/>
          </svg>
        </span>

        {/* Status dot */}
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRunning ? 'var(--running)' : 'var(--border)', flexShrink: 0, boxShadow: isRunning ? '0 0 6px var(--running)' : undefined }} />

        {/* Name — leaf tags navigate to Today */}
        <span
          onClick={handleClick}
          style={{ flex: 1, fontSize: 13, color: 'var(--text)', cursor: isLeaf ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {tag.name}
        </span>

        {isRunning && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--running)', letterSpacing: '0.15em' }}>LIVE</span>
        )}

        {!isLeaf && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {t('tags.childCount', { n: visibleChildren.length })}
          </span>
        )}

        {isLeaf && (
          <button
            onClick={handleClick}
            title={t('tags.startTimer')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 34, padding: '0 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M3 1.5l7.5 4.5L3 10.5V1.5z" fill="currentColor"/>
            </svg>
            {t('tags.startTimer')}
          </button>
        )}

        {/* Add child */}
        <button
          onClick={() => onAddChildOpen(tag.id)}
          title={t('tags.addChildTitle')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0, opacity: 0.75 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Edit */}
        <button
          onClick={() => onEditOpen(tag)}
          title={t('tags.editTitle')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0, opacity: 0.75 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Children */}
      {visibleChildren.map((child) => (
        <TagRow
          key={child.id}
          tag={child}
          depth={depth + 1}
          memberId={memberId}
          tagTree={tagTree}
          discardedId={discardedId}
          dragState={dragState}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onEditOpen={onEditOpen}
          onAddChildOpen={onAddChildOpen}
          onRename={async () => {}}
          onMove={async () => {}}
          onDiscard={async () => {}}
        />
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────

export default function TagListView() {
  const params = useParams()
  const { t } = useI18n()
  const memberId = Number(params?.id)
  const tagTree = useTagStore((s) => s.tagTree)
  const tagList = useTagStore(selectTagList)
  const { loadTags, fetchError, isRefreshing, createTag, renameTag, moveTag, reorderTags, discardTag } = useTagStore()

  const discardedId = findDiscardedId(tagTree)

  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [addingChildOf, setAddingChildOf] = useState<number | null>(null)

  // Drag & drop state
  const [dragState, setDragState] = useState<DragState>({ draggingId: null, overId: null })
  const dragTagRef = useRef<Tag | null>(null)

  useEffect(() => {
    if (memberId) loadTags(memberId)
  }, [memberId, loadTags])

  function handleDragStart(e: React.DragEvent, tag: Tag) {
    dragTagRef.current = tag
    setDragState({ draggingId: tag.id, overId: null })
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, tag: Tag) {
    e.preventDefault()
    if (dragTagRef.current?.id === tag.id) return
    setDragState((prev) => ({ ...prev, overId: tag.id }))
  }

  function handleDrop(e: React.DragEvent, target: Tag) {
    e.preventDefault()
    const dragging = dragTagRef.current
    if (!dragging || dragging.id === target.id) return

    const draggingParentId = getParentId(tagTree, dragging.id)
    const targetParentId = getParentId(tagTree, target.id)

    if (draggingParentId === targetParentId && draggingParentId !== null) {
      // Same parent — reorder
      const parentTag = tagTree
        .flatMap(function collect(n: Tag): Tag[] { return [n, ...n.children.flatMap(collect)] })
        .find((n) => n.id === draggingParentId)
      if (!parentTag) return
      const siblings = parentTag.children.filter((c) => c.type !== 'DISCARDED')
      const oldIdx = siblings.findIndex((c) => c.id === dragging.id)
      const newIdx = siblings.findIndex((c) => c.id === target.id)
      if (oldIdx < 0 || newIdx < 0) return
      const reordered = [...siblings]
      reordered.splice(oldIdx, 1)
      reordered.splice(newIdx, 0, dragging)
      reorderTags(draggingParentId, reordered.map((c) => c.id))
    }

    setDragState({ draggingId: null, overId: null })
    dragTagRef.current = null
  }

  function handleDragEnd() {
    setDragState({ draggingId: null, overId: null })
    dragTagRef.current = null
  }

  async function handleAddChild(name: string) {
    if (!addingChildOf) return
    await createTag(name, addingChildOf)
    setAddingChildOf(null)
  }

  async function handleDiscard(tagId: number) {
    if (!discardedId) return
    await discardTag(tagId, discardedId)
  }

  const addingChildSiblings = addingChildOf !== null
    ? getSiblingNames(tagTree, addingChildOf)
    : []
  const rootTag = tagTree.find((t) => t.type === 'ROOT')

  function openRootAdd() {
    if (rootTag) setAddingChildOf(rootTag.id)
  }

  return (
    <AppShell>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
        </div>

        <div style={{ padding: '24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {t('tags.eyebrow')}
            </p>
            {tagTree.length > 0 && (
              <button
                onClick={openRootAdd}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 34, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 10px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                {t('tags.newTag')}
              </button>
            )}
          </div>

          {fetchError && (
            <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 16 }}>
              {t('tags.loadError')}
            </p>
          )}

          {addingChildOf === rootTag?.id && (
            <div style={{ marginBottom: 14, borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <AddTagForm
                parentId={rootTag.id}
                siblingNames={addingChildSiblings}
                onAdd={handleAddChild}
                onCancel={() => setAddingChildOf(null)}
              />
            </div>
          )}

          {tagList.length === 0 && !isRefreshing ? (
            <div style={{ display: 'grid', gap: 12, justifyItems: 'start', padding: '28px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('tags.empty')}</p>
              {rootTag && (
                <button
                  onClick={openRootAdd}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 42, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '0 14px', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {t('tags.createFirst')}
                </button>
              )}
            </div>
          ) : (
            <div>
              {tagList.map((tag) => (
                <div key={tag.id}>
                  <TagRow
                    tag={tag}
                    depth={0}
                    memberId={memberId}
                    tagTree={tagTree}
                    discardedId={discardedId}
                    dragState={dragState}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onEditOpen={setEditingTag}
                    onAddChildOpen={setAddingChildOf}
                    onRename={renameTag}
                    onMove={moveTag}
                    onDiscard={handleDiscard}
                  />
                  {addingChildOf === tag.id && (
                    <AddTagForm
                      parentId={tag.id}
                      siblingNames={addingChildSiblings}
                      onAdd={handleAddChild}
                      onCancel={() => setAddingChildOf(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingTag && (
        <EditTagModal
          tag={editingTag}
          tagTree={tagTree}
          onClose={() => setEditingTag(null)}
          onRename={renameTag}
          onMove={moveTag}
          onDiscard={handleDiscard}
        />
      )}
    </AppShell>
  )
}
