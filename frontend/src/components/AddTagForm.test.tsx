import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import AddTagForm from './AddTagForm'

function renderForm(props: Partial<React.ComponentProps<typeof AddTagForm>> = {}) {
  const onAdd = props.onAdd ?? vi.fn().mockResolvedValue(undefined)
  const onCancel = props.onCancel ?? vi.fn()
  render(
    <I18nProvider initialLanguage="ko">
      <AddTagForm siblingNames={props.siblingNames ?? []} onAdd={onAdd} onCancel={onCancel} />
    </I18nProvider>,
  )
  return { onAdd, onCancel }
}

beforeEach(() => {
  localStorage.setItem(LANG_KEY, 'ko')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('AddTagForm', () => {
  it('이름을 입력하고 추가를 누르면 trim된 값으로 onAdd를 부른다', async () => {
    const { onAdd } = renderForm()

    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: '  독서  ' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('독서'))
  })

  it('빈 이름은 추가 버튼이 비활성화된다', () => {
    renderForm()
    expect((screen.getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('중복 이름이면 경고를 보여주되 제출은 막지 않는다', () => {
    renderForm({ siblingNames: ['독서'] })
    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: '독서' } })
    expect(screen.getByText('중복 이름')).toBeTruthy()
    expect((screen.getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('[회귀] onAdd가 실패하면 에러를 보여주고 폼이 열린 채로 남는다', async () => {
    // 예전엔 TagListView.handleAddChild가 catch 없이 await만 해서, 생성 실패가
    // unhandled rejection으로 새고 폼은 아무 표시 없이 멈췄다(GLOBAL-PIT 계열).
    const onAdd = vi.fn().mockRejectedValue(new Error('서버 오류'))
    const { onCancel } = renderForm({ onAdd })

    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: '독서' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(screen.getByText('저장에 실패했습니다.')).toBeTruthy())
    expect(onCancel).not.toHaveBeenCalled()
    // 재시도할 수 있어야 한다 — 버튼이 비활성 상태로 멈춰 있으면 안 된다.
    expect((screen.getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('취소를 누르면 onCancel을 부른다', () => {
    const { onCancel } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
