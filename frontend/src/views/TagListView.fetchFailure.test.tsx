import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// TagListView.test.tsx 는 useTagStore 를 평범한 함수로 갈아끼워서 zustand 의
// useSyncExternalStore 경로를 타지 않는다. 그래서 "셀렉터가 매 호출 새 값을
// 돌려주면 무한 렌더"라는 이 회귀를 원천적으로 못 잡는다 — 여기서는 실제
// 스토어를 그대로 쓰고 네트워크·IndexedDB 경계만 막는다.
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))
// 캐시도 비어 있는 상태 — 첫 실행이거나 캐시가 지워진 기기.
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}))

import apiClient from '@/utils/apiClient'
import { useTagStore } from '@/store/tagStore'
import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import TagListView from './TagListView'

const get = apiClient.get as unknown as ReturnType<typeof vi.fn>

function serverError() {
  return Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } })
}

function renderView() {
  return render(
    <I18nProvider initialLanguage="ko">
      <TagListView />
    </I18nProvider>,
  )
}

beforeEach(() => {
  localStorage.setItem(LANG_KEY, 'ko')
  useTagStore.setState({ tagTree: [], lastFetchedAt: null, isRefreshing: false, fetchError: false })
  get.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('TagListView — 태그 조회 실패(캐시 없음)', () => {
  it('[회귀] 무한 렌더(Maximum update depth exceeded)로 터지지 않고 실패 상태를 보여준다', async () => {
    get.mockRejectedValue(serverError())

    renderView()

    expect(await screen.findByText('태그를 불러오지 못했습니다.')).toBeTruthy()
  })

  it('[회귀] 실패를 "태그가 없습니다"(빈 데이터)로 위장하지 않는다 — GLOBAL-PIT-108', async () => {
    get.mockRejectedValue(serverError())

    renderView()

    await screen.findByText('태그를 불러오지 못했습니다.')
    expect(screen.queryByText('태그가 없습니다.')).toBeNull()
    expect(screen.queryByText('첫 태그 만들기')).toBeNull()
  })

  it('다시 시도를 누르면 재조회하고, 성공하면 목록을 보여준다', async () => {
    get.mockRejectedValueOnce(serverError())
    renderView()
    const retry = await screen.findByRole('button', { name: '다시 시도' })

    const leaf = { id: 10, name: '독서', type: 'LEAF', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [] }
    const root = { id: 1, name: 'ROOT', type: 'ROOT', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [leaf] }
    get.mockResolvedValueOnce({ data: [root] })
    await act(async () => { fireEvent.click(retry) })

    await waitFor(() => expect(screen.getByText('독서')).toBeTruthy())
    expect(screen.queryByText('태그를 불러오지 못했습니다.')).toBeNull()
    expect(get).toHaveBeenCalledTimes(2)
  })
})
