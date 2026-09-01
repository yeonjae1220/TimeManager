import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import TagPickerModal from './TagPickerModal'
import type { Tag } from '@/store/tagStore'

const createTag = vi.fn()
vi.mock('@/store/tagStore', () => ({
  useTagStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ recentTagIds: [], findById: () => null, createTag }),
}))

const WORK_LEAF: Tag = { id: 20, name: '공부', type: 'LEAF', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [] }
const WORK_CATEGORY: Tag = { id: 10, name: '업무', type: 'CATEGORY', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [WORK_LEAF] }
const ROOT: Tag = { id: 1, name: 'ROOT', type: 'ROOT', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [WORK_CATEGORY] }

function renderPicker(props: Partial<React.ComponentProps<typeof TagPickerModal>> = {}) {
  const onSelect = props.onSelect ?? vi.fn()
  const onClose = props.onClose ?? vi.fn()
  render(
    <I18nProvider initialLanguage="ko">
      <TagPickerModal
        tagTree={[ROOT]}
        currentTagId={null}
        onSelect={onSelect}
        onClose={onClose}
        allowCreate={props.allowCreate}
      />
    </I18nProvider>,
  )
  return { onSelect, onClose }
}

beforeEach(() => {
  localStorage.setItem(LANG_KEY, 'ko')
  createTag.mockReset()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('TagPickerModal — 새 태그 만들기', () => {
  it('allowCreate가 없으면(기본값) 새 태그 만들기 버튼이 없다', () => {
    renderPicker()
    expect(screen.queryByText('새 태그 만들기')).toBeNull()
  })

  it('[회귀] 최상위 레벨에서 만들면 루트를 부모로 createTag를 부르고 성공 시 onSelect한다', async () => {
    createTag.mockResolvedValue(99)
    const { onSelect } = renderPicker({ allowCreate: true })

    fireEvent.click(screen.getByText('새 태그 만들기'))
    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: '운동' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(createTag).toHaveBeenCalledWith('운동', ROOT.id))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(99))
  })

  it('[회귀] 중첩된 카테고리 안에서 만들면 그 카테고리를 부모로 넘긴다', async () => {
    createTag.mockResolvedValue(101)
    renderPicker({ allowCreate: true })

    // "업무" 카테고리로 들어간다.
    fireEvent.click(screen.getByText('업무'))
    fireEvent.click(screen.getByText('새 태그 만들기'))
    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: '회의' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(createTag).toHaveBeenCalledWith('회의', WORK_CATEGORY.id))
  })

  it('생성 실패 시 에러를 보여주고 onSelect를 부르지 않는다', async () => {
    createTag.mockRejectedValue(new Error('서버 오류'))
    const { onSelect } = renderPicker({ allowCreate: true })

    fireEvent.click(screen.getByText('새 태그 만들기'))
    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: '운동' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(screen.getByText('저장에 실패했습니다.')).toBeTruthy())
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('검색 중에는 새 태그 만들기 버튼이 보이지 않는다(어느 레벨에 만들지 모호해서)', () => {
    renderPicker({ allowCreate: true })
    fireEvent.change(screen.getByPlaceholderText('태그 검색'), { target: { value: '아무거나' } })
    expect(screen.queryByText('새 태그 만들기')).toBeNull()
  })
})
