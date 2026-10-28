'use client'
import apiClient from './apiClient'
import { useAuthStore } from '@/store/authStore'

export interface RecordWrite {
  tagId?: number
  newTagId?: number
  newStartTime: string
  newEndTime: string
  forceOverwrite: boolean
  overlapToken?: string
  recordToken?: string
}
export interface PendingRecord {
  id: string; path: string; method: 'post' | 'put'; data: RecordWrite; failed: boolean
}
const key = (memberId: number) => `tm-record-pending:${memberId}`
export function readPendingRecords(memberId: number): PendingRecord[] {
  try { const value = JSON.parse(localStorage.getItem(key(memberId)) ?? '[]'); return Array.isArray(value) ? value.filter((e) => typeof e.id === 'string' && /^\/api\/v1\/records(?:\/\d+)?$/.test(e.path) && ['post', 'put'].includes(e.method) && e.data && typeof e.data.newStartTime === 'string' && typeof e.data.newEndTime === 'string') : [] } catch { return [] }
}
function update(memberId: number, fn: (entries: PendingRecord[]) => PendingRecord[]) {
  localStorage.setItem(key(memberId), JSON.stringify(fn(readPendingRecords(memberId))))
  window.dispatchEvent(new Event('record-pending'))
}
export function removePendingRecord(memberId: number, id: string) {
  update(memberId, (entries) => entries.filter((e) => e.id !== id))
}
export function recordsChanged() { window.dispatchEvent(new Event('records-changed')) }

/** Manual writes have one queue on web and native. Destructive confirmations never replay. */
export async function writeRecord(method: 'post' | 'put', path: string, data: RecordWrite): Promise<'saved' | 'pending'> {
  const memberId = useAuthStore.getState().memberId
  try { await apiClient[method](path.replace('/records', '/manual-records'), data); if (useAuthStore.getState().memberId === memberId) recordsChanged(); return 'saved' }
  catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (!memberId || data.forceOverwrite || (status && status < 500)) throw error
    // Deduplicate repeated clicks/retries against the same frozen request.
    const id = JSON.stringify([method, path, data])
    update(memberId, (entries) => entries.some((e) => e.id === id) ? entries : [...entries, { id, method, path, data, failed: false }])
    return 'pending'
  }
}

let replaying = false
export const isRecordReplayRunning = () => replaying
export async function retryRecordWrites(memberId: number) {
  if (replaying || useAuthStore.getState().memberId !== memberId) return
  replaying = true
  window.dispatchEvent(new Event('record-pending'))
  try {
    for (const entry of readPendingRecords(memberId)) {
      if (entry.failed || useAuthStore.getState().memberId !== memberId) continue
      // Defensive check for persisted data from another version of the application.
      if (entry.data.forceOverwrite) { update(memberId, (list) => list.map((e) => e.id === entry.id ? { ...e, failed: true } : e)); continue }
      try {
        await apiClient[entry.method](entry.path.replace('/records', '/manual-records'), entry.data)
        removePendingRecord(memberId, entry.id)
        if (useAuthStore.getState().memberId === memberId) recordsChanged()
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status
        if (!status || status >= 500 || status === 401) break
        update(memberId, (list) => list.map((e) => e.id === entry.id ? { ...e, failed: true } : e))
      }
    }
  } finally { replaying = false; window.dispatchEvent(new Event('record-pending')) }
}
