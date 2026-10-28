import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('@/utils/recordMutations', () => ({ writeRecord: vi.fn() }))
vi.mock('@/components/TagPickerModal', () => ({ default: ({ onSelect }: { onSelect: (id: number) => void }) => <button onClick={() => onSelect(2)}>choose second tag</button> }))
import { writeRecord } from '@/utils/recordMutations'
import { I18nProvider } from '@/i18n/I18nProvider'
import { useTagStore, type Tag } from '@/store/tagStore'
import AddRecordModal from './AddRecordModal'
const tags = [{ id: 1, name: 'First', children: [] }, { id: 2, name: 'Second', children: [] }] as unknown as Tag[]
beforeEach(() => { vi.resetAllMocks(); useTagStore.setState({ tagTree: tags }); vi.mocked(writeRecord).mockResolvedValue('saved') })
afterEach(cleanup)
const renderForm = (extra = {}) => render(<I18nProvider initialLanguage="en"><AddRecordModal tagTree={tags} defaultTagId={1} defaultDate="2026-10-01" resetHour={5} timezone="Asia/Seoul" onClose={vi.fn()} onSaved={vi.fn()} {...extra} /></I18nProvider>)

describe('editable manual record defaults', () => {
  it('lets the user replace tag, start date/time and end date/time', async () => {
    const view = renderForm()
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: '2026-10-02T23:30' } })
    fireEvent.change(screen.getByLabelText(/^end$/i), { target: { value: '2026-10-03T01:00' } })
    fireEvent.click(screen.getByText('First'))
    fireEvent.click(screen.getByText('choose second tag'))
    view.rerender(<I18nProvider initialLanguage="en"><AddRecordModal tagTree={tags} defaultTagId={1} defaultDate="2026-10-04" resetHour={5} timezone="Asia/Seoul" onClose={vi.fn()} onSaved={vi.fn()} /></I18nProvider>)
    expect((screen.getByLabelText(/^start$/i) as HTMLInputElement).value).toBe('2026-10-02T23:30')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(writeRecord).toHaveBeenCalledWith('post', '/api/v1/records', expect.objectContaining({ tagId: 2, newStartTime: '2026-10-02T14:30:00.000Z', newEndTime: '2026-10-02T16:00:00.000Z', forceOverwrite: false })))
  })
  it('shows deletion candidates only after collision and resets confirmation on edit', async () => {
    vi.mocked(writeRecord).mockRejectedValueOnce({ response: { data: { code: 'RECORD_OVERLAP', overlapToken: 'v1', recordsToDelete: [{ recordId: 9, tagName: 'Existing', startTime: '2026-10-01T00:00Z', endTime: '2026-10-01T01:00Z' }] } } })
    renderForm()
    expect(screen.queryByText(/Existing/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText(/Existing/)
    fireEvent.change(screen.getByLabelText(/^end$/i), { target: { value: '2026-10-01T08:00' } })
    expect(screen.queryByText(/Existing/)).toBeNull()
  })
})
