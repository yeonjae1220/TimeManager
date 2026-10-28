'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseLocalDate, toLocalDate } from '@/views/logs/shared'

/** Keep each tab's cursor when changing tabs, drilling down, or refreshing. */
export function useLogQuery() {
  const router = useRouter()
  const params = useSearchParams()
  const query = params?.toString() ?? ''
  const values = useMemo(() => new URLSearchParams(query), [query])
  function set(key: string, value: string | null) {
    const next = new URLSearchParams(query)
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/logs?${next}`, { scroll: false })
  }
  return { values, set }
}

export function useLogDate(key: string) {
  const { values, set } = useLogQuery()
  const raw = values.get(key)
  const date = useMemo(() => raw ? parseLocalDate(raw) : null, [raw])
  return [date, (next: Date | null) => set(key, next ? toLocalDate(next) : null)] as const
}
