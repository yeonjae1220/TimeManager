import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get as idbGet } from 'idb-keyval'
import apiClient from '@/utils/apiClient'
import { useAuthStore } from './authStore'
import { useTagStore, type Tag } from './tagStore'

vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('@/native/runningSession', () => ({ sessionFromTimerState: vi.fn(), syncNativeRunningSession: vi.fn() }))

const leaf = (id: number): Tag => ({
  id, name: `Tag ${id}`, type: 'LEAF', state: false, elapsedTime: 0,
  latestStopTimeMs: null, children: [],
})
const tree = [{ ...leaf(1), type: 'ROOT' as const, children: [leaf(2), leaf(3), leaf(4)] }]
const read = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null')

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  useAuthStore.setState({ memberId: 7 })
  useTagStore.setState({
    tagTree: [], recentTagIds: [], _activeMemberId: null,
    lastFetchedAt: null, isRefreshing: false, _pendingRefreshMemberId: null, fetchError: false,
  })
  vi.mocked(idbGet).mockResolvedValue(undefined)
  vi.mocked(apiClient.get).mockResolvedValue({ data: tree })
})

afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('recent tags after the account-scoped storage upgrade', () => {
  it.each(['cache', 'server'])('restores owned nested tags in their original order from %s', async (source) => {
    localStorage.setItem('recentTagIds', JSON.stringify([3, 99, 2]))
    if (source === 'cache') {
      vi.mocked(idbGet).mockResolvedValue(tree)
      await useTagStore.getState().loadTagsFromCache(7)
    } else {
      await useTagStore.getState().loadTags(7)
    }
    expect(useTagStore.getState().recentTagIds).toEqual([3, 2])
    expect(read('recentTagIds:7')).toEqual([3, 2])
    // Another account can still reclaim its own history later.
    expect(read('recentTagIds')).toEqual([99])
    useAuthStore.setState({ memberId: 8 })
    vi.mocked(idbGet).mockResolvedValue([leaf(99)])
    await useTagStore.getState().loadTagsFromCache(8)
    expect(useTagStore.getState().recentTagIds).toEqual([99])
    expect(read('recentTagIds:7')).toEqual([3, 2])
  })

  it('keeps post-upgrade activity first, deduplicates and persists across a reload', async () => {
    localStorage.setItem('recentTagIds:7', JSON.stringify([4, 2]))
    localStorage.setItem('recentTagIds', JSON.stringify([3, 2]))
    await useTagStore.getState().loadTags(7)
    expect(useTagStore.getState().recentTagIds).toEqual([4, 2, 3])
    await useTagStore.getState().clearCache()
    await useTagStore.getState().loadTags(7)
    expect(useTagStore.getState().recentTagIds).toEqual([4, 2, 3])
  })

  it.each(['{broken', '{}', 'null', '["2",null,-1,3,3]'])('tolerates invalid legacy data: %s', async (raw) => {
    localStorage.setItem('recentTagIds', raw)
    await useTagStore.getState().loadTags(7)
    expect(useTagStore.getState().recentTagIds).toEqual(raw.startsWith('[') ? [3] : [])
    expect(useTagStore.getState().fetchError).toBe(false)
  })

  it('preserves legacy history if writing the new storage fails', async () => {
    localStorage.setItem('recentTagIds', '[3,2]')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await useTagStore.getState().loadTags(7)
    expect(read('recentTagIds')).toEqual([3, 2])
    expect(useTagStore.getState().recentTagIds).toEqual([3, 2])
  })

  it.each(['cache', 'server'])('does not migrate a late %s response after an account switch', async (source) => {
    localStorage.setItem('recentTagIds', '[3,99]')
    let resolve!: (value: Tag[]) => void
    const delayed = new Promise<Tag[]>((r) => { resolve = r })
    useTagStore.setState({ _activeMemberId: 7 })
    const pending = source === 'cache'
      ? (vi.mocked(idbGet).mockReturnValue(delayed), useTagStore.getState().loadTagsFromCache(7))
      : (vi.mocked(apiClient.get).mockImplementationOnce(async () => ({ data: await delayed })), useTagStore.getState()._doRefreshTags(7))
    useAuthStore.setState({ memberId: 8 })
    useTagStore.setState({ _activeMemberId: 8, recentTagIds: [99] })
    resolve(tree)
    await pending
    expect(useTagStore.getState().recentTagIds).toEqual([99])
    expect(read('recentTagIds:7')).toBeNull()
    expect(read('recentTagIds')).toEqual([3, 99])
  })
})
