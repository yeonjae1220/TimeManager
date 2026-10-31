import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/i18n/I18nProvider'
import { useTagStore, type Tag } from '@/store/tagStore'
import AddRecordModal from './AddRecordModal'

vi.mock('@/utils/recordMutations', () => ({ writeRecord: vi.fn() }))
afterEach(cleanup)

describe('record modal and nested tag picker', () => {
  it('escapes only the top dialog, restores its trigger and keeps the draft outside the scrolling shell', () => {
    const tags = [{ id: 1, name: 'Root', type: 'ROOT', children: [
      { id: 2, name: 'Work', type: 'NORMAL', children: [] },
      { id: 3, name: 'Study', type: 'NORMAL', children: [] },
    ] }] as unknown as Tag[]
    useTagStore.setState({ tagTree: tags, recentTagIds: [] })
    const onClose = vi.fn()
    render(<I18nProvider initialLanguage="en"><div className="app-content"><AddRecordModal tagTree={tags} defaultTagId={2} timezone="Asia/Seoul" onSaved={vi.fn()} onClose={onClose} /></div></I18nProvider>)
    const form = screen.getByRole('dialog')
    expect(form.closest('.app-content')).toBeNull()
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: '2026-10-02T23:50' } })
    const trigger = within(form).getByRole('button', { name: 'Work' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    const picker = screen.getByRole('dialog', { name: /^tag$/i })
    expect(picker.contains(document.activeElement)).toBe(true)
    const first = within(picker).getByRole('button', { name: 'Cancel' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).not.toBe(first)
    expect(picker.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
    expect((screen.getByLabelText(/^start$/i) as HTMLInputElement).value).toBe('2026-10-02T23:50')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
