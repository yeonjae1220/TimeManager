import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useCallback } from 'react'

import { useAsyncData } from './useAsyncData'

// 이 훅이 존재하는 이유는 LogsView 의 4개 탭이 전부 아래처럼 실패를 삼켰기 때문이다.
//
//   try { setData(res.data) } catch { setData(null) } finally { setLoading(false) }
//
// 에러 객체가 어디에도 남지 않아 콘솔에도 화면에도 흔적이 없었고, WeeklyTab·
// MonthlyTab 은 실패를 아예 표시하지 않았으며 TagTab 은 합계 0 을 정상값처럼
// 렌더했다. 즉 "실패" 와 "기록 없음" 이 구분 불가능했다(GLOBAL-PIT-020 계열).
//
// 따라서 이 훅의 계약은 세 가지다:
//   ① 실패를 삼키지 않는다 — error 를 노출하고 console.error 로 남긴다
//   ② 실패와 빈 데이터를 혼동시키지 않는다 — 실패 시 data 는 null
//   ③ 사용자가 스스로 복구할 수 있다 — reload()

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** loader 를 useCallback 으로 고정해 훅이 매 렌더마다 재요청하지 않게 한다. */
function renderWithLoader<T>(loader: () => Promise<T>) {
  return renderHook(() => useAsyncData(useCallback(loader, [])))
}

describe('useAsyncData — 로딩/성공 경로', () => {
  it('성공하면 data 를 채우고 error 는 null, loading 은 false 로 끝난다', async () => {
    const { result } = renderWithLoader(async () => ({ totalSeconds: 42 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ totalSeconds: 42 })
    expect(result.current.error).toBeNull()
  })

  it('빈 결과(0건)도 성공이다 — 실패로 오인하지 않는다', async () => {
    // 서버가 정상적으로 "기록 없음"을 응답한 경우. data 는 null 이 아니라
    // 빈 값이어야 하고 error 도 없어야 한다. 이걸 구분 못 하면 정상 사용자가
    // 매번 에러 화면을 보게 된다.
    const { result } = renderWithLoader(async () => ({ totalSeconds: 0, tagSummaries: [] }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual({ totalSeconds: 0, tagSummaries: [] })
  })
})

describe('useAsyncData — 아직 요청하지 않는 상태', () => {
  it('loader 가 null 이면 요청하지 않고 로딩 중으로도 보이지 않는다', async () => {
    // TagTab 은 태그를 고르기 전엔 조회하지 않는다. 이때 loading 이 true 로
    // 남으면 아무것도 안 골랐는데 스피너가 영원히 도는 화면이 된다.
    const { result } = renderHook(() => useAsyncData<never>(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('null → loader 로 바뀌면 그때 조회한다', async () => {
    const loader = vi.fn(async () => ({ totalSeconds: 5 }))
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => {
      const memo = useCallback(() => loader(), [])
      return useAsyncData(on ? memo : null)
    }, { initialProps: { on: false } })

    expect(loader).not.toHaveBeenCalled()

    rerender({ on: true })
    await waitFor(() => expect(result.current.data).toEqual({ totalSeconds: 5 }))
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('useAsyncData — 실패를 삼키지 않는다', () => {
  it('실패하면 error 를 노출하고 data 는 null, loading 은 반드시 해제된다', async () => {
    const boom = new Error('500 Internal Server Error')
    const { result } = renderWithLoader(async () => {
      throw boom
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(boom)
    expect(result.current.data).toBeNull()
  })

  it('[회귀] 실패를 조용히 넘기지 않고 console.error 로 남긴다', async () => {
    // 이게 없으면 운영에서 사용자가 "안 나온다"고 해도 원인을 찾을 단서가 0 이다.
    const { result } = renderWithLoader(async () => {
      throw new Error('network down')
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(consoleError).toHaveBeenCalled()
    const logged = consoleError.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('network down')
  })
})

describe('useAsyncData — falsy 한 실패 원인', () => {
  it('[회귀] undefined 로 reject 돼도 실패로 인식한다', async () => {
    // 호출부가 `error != null` 로 실패를 판정하면, Promise.reject() 처럼 원인이
    // falsy 한 실패가 조용히 성공처럼 취급된다 — 지금 고치고 있는 결함과 같은 부류다.
    // 그래서 실패 여부는 원인의 truthiness 가 아니라 별도 플래그로 판정한다.
    const { result } = renderWithLoader(() => Promise.reject(undefined))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.failed).toBe(true)
    expect(result.current.data).toBeNull()
  })

  it('성공 경로에서는 failed 가 false 다', async () => {
    const { result } = renderWithLoader(async () => ({ ok: true }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.failed).toBe(false)
  })
})

describe('useAsyncData — 조회 중단', () => {
  it('loader 가 다시 null 이 되면 이전 결과를 남기지 않는다', async () => {
    const loader = vi.fn(async () => ({ totalSeconds: 5 }))
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => {
      const memo = useCallback(() => loader(), [])
      return useAsyncData(on ? memo : null)
    }, { initialProps: { on: true } })

    await waitFor(() => expect(result.current.data).toEqual({ totalSeconds: 5 }))

    // 조회 조건이 풀렸는데 옛 데이터가 남아 있으면 화면이 이전 선택 결과를 계속 보여준다.
    rerender({ on: false })
    expect(result.current.data).toBeNull()
    expect(result.current.failed).toBe(false)
  })
})

describe('useAsyncData — loader 가 동기적으로 던지는 경우', () => {
  it('[회귀] Promise 를 만들기 전에 던져도 스피너가 영원히 돌지 않는다', async () => {
    // loader 안에서 URL 조립이나 날짜 계산이 동기적으로 던지면 .then 이 아예
    // 달리지 않는다. 그대로 두면 예외가 effect 밖으로 튀어 화면이 통째로
    // 에러 바운더리로 넘어가거나, 최악에는 loading=true 로 굳는다.
    const { result } = renderWithLoader(() => {
      throw new Error('동기 실패')
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.failed).toBe(true)
  })
})

describe('useAsyncData — 언마운트', () => {
  it('언마운트 뒤 도착한 응답을 반영하지 않는다', async () => {
    let resolveLate: (v: { late: boolean }) => void = () => {}
    const late = new Promise<{ late: boolean }>((r) => {
      resolveLate = r
    })

    const { result, unmount } = renderWithLoader(() => late)
    unmount()

    await act(async () => {
      resolveLate({ late: true })
      await late
    })

    // 언마운트된 컴포넌트의 상태를 건드리지 않았으므로 마지막 스냅샷이 그대로다.
    expect(result.current.data).toBeNull()
  })
})

describe('useAsyncData — 복구', () => {
  it('reload() 로 재시도해 성공하면 이전 error 가 지워진다', async () => {
    let attempt = 0
    const loader = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('일시적 실패')
      return { totalSeconds: 7 }
    })

    const { result } = renderHook(() => useAsyncData(useCallback(loader, [])))

    await waitFor(() => expect(result.current.error).toBeTruthy())

    await act(async () => {
      result.current.reload()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // stale error 가 남으면 성공했는데도 에러 화면이 계속 보인다.
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual({ totalSeconds: 7 })
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('useAsyncData — 경쟁 조건', () => {
  it('늦게 도착한 옛 요청이 최신 결과를 덮어쓰지 않는다', async () => {
    // 사용자가 날짜 화살표를 빠르게 두 번 누르면 요청 2개가 겹친다.
    // 1번(느림)이 2번(빠름)보다 늦게 도착하면 화면이 옛 날짜 데이터로 되돌아간다.
    let resolveSlow: (v: { label: string }) => void = () => {}
    const slow = new Promise<{ label: string }>((r) => {
      resolveSlow = r
    })

    let call = 0
    const loader = () => {
      call += 1
      return call === 1 ? slow : Promise.resolve({ label: 'new' })
    }

    const { result, rerender } = renderHook(({ k }: { k: number }) =>
      // k 가 바뀌면 loader identity 가 바뀌어 재요청된다 (실제 코드의 날짜 변경과 동일).
      // useCallback(loader, [k]) 로 쓰면 안 된다 — 같은 loader 참조를 그대로
      // 돌려주므로 identity 가 영원히 그대로라 재요청 자체가 안 걸린다.
      useAsyncData(useCallback(() => loader(), [k])),
    { initialProps: { k: 1 } })

    rerender({ k: 2 })
    await waitFor(() => expect(result.current.data).toEqual({ label: 'new' }))

    // 이제 1번 요청이 뒤늦게 완료된다.
    await act(async () => {
      resolveSlow({ label: 'old' })
      await slow
    })

    expect(result.current.data).toEqual({ label: 'new' })
  })

  it('늦게 도착한 옛 요청의 실패가 최신 성공을 에러로 만들지 않는다', async () => {
    let rejectSlow: (e: unknown) => void = () => {}
    const slow = new Promise<{ label: string }>((_, rej) => {
      rejectSlow = rej
    })

    let call = 0
    const loader = () => {
      call += 1
      return call === 1 ? slow : Promise.resolve({ label: 'new' })
    }

    const { result, rerender } = renderHook(({ k }: { k: number }) =>
      useAsyncData(useCallback(() => loader(), [k])),
    { initialProps: { k: 1 } })

    rerender({ k: 2 })
    await waitFor(() => expect(result.current.data).toEqual({ label: 'new' }))

    await act(async () => {
      rejectSlow(new Error('옛 요청 실패'))
      await slow.catch(() => {})
    })

    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual({ label: 'new' })
  })
})
