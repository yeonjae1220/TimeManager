import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('@/i18n/I18nProvider', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import { __resetConnectivity, reportReachable, reportUnreachable } from '@/utils/connectivity'
import { useTagStore } from '@/store/tagStore'
import SyncStatusPill, { SYNCING_REVEAL_DELAY_MS } from './SyncStatusPill'

beforeEach(() => {
  vi.useFakeTimers()
  __resetConnectivity()
  useTagStore.setState({ isRefreshing: false })
})

afterEach(() => {
  cleanup()
  __resetConnectivity()
  vi.useRealTimers()
})

describe('SyncStatusPill', () => {
  it('온라인이고 동기화 중이 아니면 아무것도 그리지 않는다', () => {
    render(<SyncStatusPill />)

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('서버에 닿지 못하면 오프라인(저장된 값 표시 중)임을 알린다', () => {
    render(<SyncStatusPill />)

    act(() => reportUnreachable())

    expect(screen.getByRole('status').textContent).toContain('sync.offline')
  })

  it('다시 닿으면 오프라인 표시를 거둔다', () => {
    render(<SyncStatusPill />)
    act(() => reportUnreachable())

    act(() => reportReachable())

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('동기화가 잠깐 만에 끝나면 표시하지 않는다(빠른 망에서 깜빡임 방지)', () => {
    render(<SyncStatusPill />)

    act(() => useTagStore.setState({ isRefreshing: true }))
    act(() => vi.advanceTimersByTime(SYNCING_REVEAL_DELAY_MS - 1))
    act(() => useTagStore.setState({ isRefreshing: false }))
    act(() => vi.advanceTimersByTime(SYNCING_REVEAL_DELAY_MS))

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('동기화가 지연되면 캐시 값을 보여주는 중임을 알린다', () => {
    render(<SyncStatusPill />)

    act(() => useTagStore.setState({ isRefreshing: true }))
    act(() => vi.advanceTimersByTime(SYNCING_REVEAL_DELAY_MS))

    expect(screen.getByRole('status').textContent).toContain('sync.syncing')
  })

  it('동기화가 끝나면 표시를 거둔다', () => {
    render(<SyncStatusPill />)
    act(() => useTagStore.setState({ isRefreshing: true }))
    act(() => vi.advanceTimersByTime(SYNCING_REVEAL_DELAY_MS))

    act(() => useTagStore.setState({ isRefreshing: false }))

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('오프라인이면 동기화 중이어도 오프라인을 우선 표시한다', () => {
    render(<SyncStatusPill />)

    act(() => {
      useTagStore.setState({ isRefreshing: true })
      reportUnreachable()
    })
    act(() => vi.advanceTimersByTime(SYNCING_REVEAL_DELAY_MS))

    expect(screen.getByRole('status').textContent).toContain('sync.offline')
  })

  it('마운트 시점에 이미 오프라인이면 바로 표시한다', () => {
    reportUnreachable()

    render(<SyncStatusPill />)

    expect(screen.getByRole('status').textContent).toContain('sync.offline')
  })
})
