import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./apiClient', () => ({ default: { post: vi.fn(), put: vi.fn() } }))
import apiClient from './apiClient'
import { useAuthStore } from '@/store/authStore'
import { readPendingRecords, retryRecordWrites, writeRecord } from './recordMutations'
const data = { tagId: 1, newStartTime: '2026-10-01T01:00Z', newEndTime: '2026-10-01T02:00Z', forceOverwrite: false }
beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); useAuthStore.setState({ memberId: 7 }) })

describe('manual record queue', () => {
  it('deduplicates failed writes, scopes them by account and replays once', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'))
    expect(await writeRecord('post', '/api/v1/records', data)).toBe('pending')
    await writeRecord('post', '/api/v1/records', data)
    expect(readPendingRecords(7)).toHaveLength(1)
    expect(readPendingRecords(8)).toEqual([])
    vi.mocked(apiClient.post).mockResolvedValue({ data: 1 })
    await retryRecordWrites(7)
    expect(readPendingRecords(7)).toEqual([])
    expect(apiClient.post).toHaveBeenLastCalledWith('/api/v1/manual-records', data)
  })
  it('never queues destructive overwrite, even on a lost response', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'))
    await expect(writeRecord('post', '/api/v1/records', { ...data, forceOverwrite: true })).rejects.toThrow()
    expect(readPendingRecords(7)).toEqual([])
  })
  it('preserves 401 and requires review after a collision', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'))
    await writeRecord('post', '/api/v1/records', data)
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 401 } })
    await retryRecordWrites(7)
    expect(readPendingRecords(7)[0].failed).toBe(false)
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 409 } })
    await retryRecordWrites(7)
    expect(readPendingRecords(7)[0].failed).toBe(true)
    vi.mocked(apiClient.post).mockClear()
    await retryRecordWrites(7)
    expect(apiClient.post).not.toHaveBeenCalled()
  })
})
