'use client'
import { useEffect, useState } from 'react'

type Preferences = { favorites: number[]; collapsed: number[] }
const empty: Preferences = { favorites: [], collapsed: [] }
export function useTagPreferences(memberId: number) {
  const key = `tm-tag-preferences:${memberId}`
  const [state, setState] = useState<{ key: string; value: Preferences }>({ key: '', value: empty })
  useEffect(() => {
    const read = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? '{}')
        const ids = (v: unknown) => Array.isArray(v) ? v.filter((id) => Number.isSafeInteger(id) && id > 0) : []
        setState({ key, value: { favorites: ids(raw.favorites), collapsed: ids(raw.collapsed) } })
      } catch { setState({ key, value: empty }) }
    }
    read()
    window.addEventListener('storage', read)
    window.addEventListener('tag-preferences', read)
    return () => { window.removeEventListener('storage', read); window.removeEventListener('tag-preferences', read) }
  }, [key])
  const value = state.key === key ? state.value : empty
  function toggle(kind: keyof Preferences, id: number) {
    const next = { ...value, [kind]: value[kind].includes(id) ? value[kind].filter((n) => n !== id) : [...value[kind], id] }
    setState({ key, value: next })
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event('tag-preferences')) } catch { /* session-only preference */ }
  }
  return { ...value, toggle }
}
