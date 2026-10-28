import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ replaying: false }))
vi.mock('@/utils/recordMutations', () => ({
  isRecordReplayRunning: () => state.replaying,
  readPendingRecords: (member: number) => member === 7 ? [{ id: 'draft', method: 'post', path: '/api/v1/records', failed: true, data: { tagId: 1, newStartTime: '2026-10-01T01:00Z', newEndTime: '2026-10-01T02:00Z' } }] : [],
  removePendingRecord: vi.fn(),
  retryRecordWrites: vi.fn(() => { state.replaying = true; window.dispatchEvent(new Event('record-pending')) }),
}))
vi.mock('@/utils/connectivity', () => ({ isOnline: () => true, subscribeConnectivity: () => () => {} }))
vi.mock('@/hooks/useDailyResetHour', () => ({ useDailyResetHour: () => ({ timezone: 'Asia/Seoul' }) }))
vi.mock('./AddRecordModal', () => ({ default: () => <div role="dialog">old account draft</div> }))
vi.mock('./EditRecordModal', () => ({ default: () => null }))
import PendingRecords from './PendingRecords'
import { useAuthStore } from '@/store/authStore'
import { I18nProvider } from '@/i18n/I18nProvider'
beforeEach(() => { state.replaying = false; useAuthStore.setState({ memberId: 7 }); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }) })
afterEach(cleanup)
const mount = () => render(<I18nProvider initialLanguage="en"><PendingRecords /></I18nProvider>)

it('disables draft actions as soon as automatic replay starts', () => {
  mount()
  expect((screen.getByRole('button', { name: 'Delete', hidden: true }) as HTMLButtonElement).disabled).toBe(true)
})

it('does not resurrect an open draft when switching accounts and returning', () => {
  mount()
  act(() => { state.replaying = false; window.dispatchEvent(new Event('record-pending')) })
  fireEvent.click(screen.getByRole('button', { name: /edit/i, hidden: true }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  act(() => useAuthStore.setState({ memberId: 8 }))
  act(() => useAuthStore.setState({ memberId: 7 }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
