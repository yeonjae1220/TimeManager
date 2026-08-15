'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncData<T> {
  /** 성공했을 때의 결과. 로딩 중이거나 실패했으면 null. */
  data: T | null
  loading: boolean
  /**
   * 실패 여부. 화면 분기는 반드시 이 값으로 하고 `error` 의 truthiness 로 하지 말 것 —
   * `Promise.reject()` 처럼 원인이 undefined 인 실패가 조용히 성공으로 취급된다.
   */
  failed: boolean
  /** 실패 원인(진단용). 원인 없이 reject 되면 실패인데도 undefined 일 수 있다. */
  error: unknown
  /** 같은 loader 로 다시 시도한다. */
  reload: () => void
}

/**
 * 비동기 로딩의 loading/data/error 를 한 곳에서 다룬다.
 *
 * 이 훅을 만든 이유는 LogsView 의 4개 탭이 전부 `catch { setData(null) }` 로
 * 실패를 삼키고 있었기 때문이다. 에러 객체가 어디에도 남지 않아 "실패" 와
 * "기록 없음" 이 화면에서 구분되지 않았다(GLOBAL-PIT-020 계열).
 *
 * `loader` 는 반드시 useCallback 등으로 고정해야 한다 — identity 가 바뀔 때마다
 * 재요청하며, 그것이 곧 "날짜가 바뀌면 다시 불러온다" 의 트리거다.
 *
 * `loader` 가 null 이면 아직 조회할 조건이 아니라는 뜻이다(예: TagTab 에서 태그
 * 미선택). 이때 loading 을 true 로 두면 스피너가 영원히 도는 화면이 된다.
 */
export function useAsyncData<T>(loader: (() => Promise<T>) | null): AsyncData<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(loader != null)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // reload() 가 loader identity 를 바꾸지 않고도 effect 를 다시 돌리게 하는 카운터.
  const [attempt, setAttempt] = useState(0)

  // 어떤 요청의 응답을 반영해도 되는지 판별한다. 사용자가 날짜 화살표를 빠르게
  // 누르면 요청이 겹치는데, 먼저 보낸 느린 요청이 나중에 도착하면 최신 화면을
  // 옛 데이터로 덮어쓴다. 응답마다 자기 번호가 아직 최신인지 확인해서 막는다.
  const latestRun = useRef(0)

  useEffect(() => {
    // 조회 조건이 아직 안 갖춰졌다. 진행 중이던 응답도 무효화해서
    // 조건이 풀린 뒤 옛 결과가 뒤늦게 들어오지 않게 한다.
    if (loader == null) {
      latestRun.current += 1
      setLoading(false)
      // 옛 결과를 남기면 조건이 풀린 뒤에도 이전 선택의 데이터가 계속 보인다.
      setData(null)
      setFailed(false)
      setError(null)
      return
    }

    const runId = ++latestRun.current
    const isStale = () => latestRun.current !== runId

    const fail = (cause: unknown) => {
      if (isStale()) return
      // 삼키지 않는다. 운영에서 "안 나온다"는 제보를 받았을 때
      // 브라우저 콘솔이 유일한 단서가 된다.
      console.error('[useAsyncData] 데이터 로딩 실패:', cause)
      setData(null)
      setFailed(true)
      setError(cause)
      setLoading(false)
    }

    setLoading(true)

    // loader 가 Promise 를 만들기 전에 동기적으로 던지면 .then 이 달리지 않는다.
    // 그대로 두면 예외가 effect 밖으로 튀어 loading=true 인 채로 굳는다.
    let pending: Promise<T>
    try {
      pending = loader()
    } catch (cause) {
      fail(cause)
      return
    }

    pending.then(
      (result) => {
        if (isStale()) return
        setData(result)
        setFailed(false)
        setError(null)
        setLoading(false)
      },
      fail,
    )

    // 언마운트(또는 재요청) 시 이 실행을 낡은 것으로 만든다. 뒤늦게 도착한
    // 응답이 사라진 화면의 상태를 건드리지 않게 한다.
    return () => {
      latestRun.current += 1
    }
  }, [loader, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return { data, loading, failed, error, reload }
}
