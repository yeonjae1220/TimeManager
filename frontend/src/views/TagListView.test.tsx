import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// 이 테스트의 초점은 "이름 클릭 = 이동만, 시작 버튼 클릭 = 이동 + autostart" 분기
// 하나다. 드래그앤드롭·편집 모달 등 나머지 트리 UI는 대상이 아니므로 실제 스토어
// 구현(selectTagList 등)만 재사용하고 상태는 고정 데이터로 대체한다.
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push }),
}))
const appShellProps: { onRefresh?: () => Promise<unknown> } = {}
vi.mock('@/components/layout/AppShell', () => ({
  default: ({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => Promise<unknown> }) => {
    appShellProps.onRefresh = onRefresh
    return <div>{children}</div>
  },
}))

vi.mock('@/store/tagStore', async () => {
  const actual = await vi.importActual<typeof import('@/store/tagStore')>('@/store/tagStore')
  const leafTag = { id: 10, name: '독서', type: 'CUSTOM', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [] }
  const rootTag = { id: 1, name: 'ROOT', type: 'ROOT', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [leafTag] }
  const state = {
    tagTree: [rootTag],
    loadTags: vi.fn(),
    fetchError: false,
    isRefreshing: false,
    createTag: vi.fn(),
    renameTag: vi.fn(),
    moveTag: vi.fn(),
    reorderTags: vi.fn(),
    discardTag: vi.fn(),
  }
  return {
    ...actual,
    // 컴포넌트가 셀렉터 있이/없이 둘 다 부른다(트리용 vs 액션 구조분해).
    useTagStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    // 테스트에서 loadTags 호출 여부를 검증하기 위한 통로 — 실제 스토어엔 없는 필드.
    __mockState: state,
  }
})

import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import TagListView from './TagListView'
// @ts-expect-error 테스트 전용 export — 위 vi.mock의 __mockState
import { __mockState as tagStoreMockState } from '@/store/tagStore'

function renderView() {
  return render(
    <I18nProvider initialLanguage="ko">
      <TagListView />
    </I18nProvider>,
  )
}

beforeEach(() => {
  push.mockReset()
  localStorage.setItem(LANG_KEY, 'ko')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('TagListView — 리프 태그에서 오늘 화면으로 이동', () => {
  it('이름을 클릭하면 autostart 없이 이동한다(시작하지 않고 보러만 감)', () => {
    renderView()
    fireEvent.click(screen.getByText('독서'))
    expect(push).toHaveBeenCalledWith('/members/1/today?tagId=10')
  })

  it('[회귀] 시작 버튼을 누르면 autostart=1 을 붙여 이동한다', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: '시작' }))
    expect(push).toHaveBeenCalledWith('/members/1/today?tagId=10&autostart=1')
  })
})

describe('TagListView — pull-to-refresh 연결', () => {
  it('[회귀] AppShell에 onRefresh를 넘기고, 호출 시 태그 트리를 다시 조회한다', async () => {
    renderView()
    expect(typeof appShellProps.onRefresh).toBe('function')

    ;(tagStoreMockState.loadTags as ReturnType<typeof vi.fn>).mockClear()
    await appShellProps.onRefresh?.()

    expect(tagStoreMockState.loadTags).toHaveBeenCalledWith(1)
  })
})
