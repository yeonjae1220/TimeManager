import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }))
import apiClient from '@/utils/apiClient'
import { get as idbGet } from 'idb-keyval'
import { useTagStore, type Tag } from './tagStore'
import { useAuthStore } from './authStore'
const oldTags = [{ id: 1, name: 'private old tag', children: [] }] as unknown as Tag[]
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  useAuthStore.setState({ memberId: 7 })
  useTagStore.setState({ _activeMemberId: 7, isRefreshing: false, _pendingRefreshMemberId: null, tagTree: [], fetchError: false })
})

it('ignores a failed old account fetch instead of restoring its private cache', async () => {
  let reject!: (error: Error) => void
  vi.mocked(apiClient.get).mockReturnValueOnce(new Promise((_, r) => { reject = r }))
  vi.mocked(idbGet).mockResolvedValue(oldTags)
  const loading = useTagStore.getState()._doRefreshTags(7)
  useAuthStore.setState({ memberId: 8 })
  useTagStore.setState({ _activeMemberId: 8 })
  reject(new Error('offline'))
  await loading
  expect(useTagStore.getState().tagTree).toEqual([])
  expect(useTagStore.getState().fetchError).toBe(false)
  expect(idbGet).not.toHaveBeenCalled()
})

it('ignores a successful old response after logout clears the active member', async () => {
  let resolve!: (value: { data: Tag[] }) => void
  vi.mocked(apiClient.get).mockReturnValueOnce(new Promise((r) => { resolve = r }))
  const loading = useTagStore.getState()._doRefreshTags(7)
  useAuthStore.setState({ memberId: null })
  await useTagStore.getState().clearCache()
  resolve({ data: oldTags })
  await loading
  expect(useTagStore.getState().tagTree).toEqual([])
})

it('checks account ownership again after asynchronous cache recovery', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'))
  let resolve!: (value: Tag[]) => void
  vi.mocked(idbGet).mockReturnValueOnce(new Promise((r) => { resolve = r }))
  const loading = useTagStore.getState()._doRefreshTags(7)
  await vi.waitFor(() => expect(idbGet).toHaveBeenCalled())
  useAuthStore.setState({ memberId: 8 })
  useTagStore.setState({ _activeMemberId: 8 })
  resolve(oldTags)
  await loading
  expect(useTagStore.getState().tagTree).toEqual([])
})
