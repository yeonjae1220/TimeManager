import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `capacitor-shell/offline.html` 은 네이티브 셸이 원격 문서를 못 받았을 때 뜨는 화면이다
 * (capacitor.config.ts 의 `server.errorPath`). 빌드 파이프라인을 타지 않는 순수 HTML 이라
 * 타입체크도 린트도 안 걸리고, 사람이 기내모드를 만들어야만 실행되는 코드다.
 *
 * 그래서 파일에서 인라인 스크립트를 꺼내 jsdom 에서 직접 돌린다. `location` 은 함수 인자로
 * 넘겨 전역을 가린다 — jsdom 의 navigation 미구현을 피하면서 이동 여부를 관찰할 수 있다.
 *
 * ⚠️ 이 파일은 `capacitor-shell/` 원본만 검증한다. `android/app/src/main/assets/public/` 의
 * 사본은 `npx cap copy android` 가 갱신하며, 동기화 누락은 아래 마지막 테스트가 잡는다.
 */

function findRepoRoot(): string {
  let dir = process.cwd()
  for (;;) {
    if (existsSync(join(dir, 'backend')) && existsSync(join(dir, 'frontend'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`모노repo 루트를 찾지 못했습니다 (cwd=${process.cwd()})`)
    dir = parent
  }
}

const SHELL_PATH = 'frontend/capacitor-shell/offline.html'
const ANDROID_COPY_PATH = 'frontend/android/app/src/main/assets/public/offline.html'

function readShell(relative: string): string {
  const path = resolve(findRepoRoot(), relative)
  try {
    return readFileSync(path, 'utf8')
  } catch (cause) {
    throw new Error(`오프라인 셸을 읽지 못했습니다: ${path}`, { cause })
  }
}

const html = readShell(SHELL_PATH)
const scriptSource = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
const bodyHtml = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1]

/** jsdom 의 visibilityState 는 프로토타입 getter라 vi.spyOn 이 먹지 않는다. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

interface Page {
  location: { replace: ReturnType<typeof vi.fn> }
  /** 이 페이지에서 떠난다. 실제 브라우저의 문서 파기에 해당한다. */
  close: () => void
}

/**
 * 페이지를 한 번 여는 것과 같다. 세션 스토리지는 그대로 남으므로 재방문을 표현할 수 있다.
 *
 * jsdom 의 document·window 는 테스트 파일 전체가 공유하므로, 스크립트가 등록한 리스너와
 * 타이머를 그대로 두면 <b>이전 페이지가 계속 살아 움직인다</b> — probe 호출 수를 세는
 * 검증이 통째로 무의미해진다. 그래서 전역을 함수 인자로 가려 등록을 가로채고,
 * {@link Page.close} 에서 되돌린다. `location` 을 가리는 것은 jsdom 의 navigation
 * 미구현을 피하는 목적도 겸한다.
 */
/** 테스트가 끝날 때 남은 페이지를 확실히 닫기 위한 등록부. */
const openPages: Page[] = []

function open(): Page {
  const location = { replace: vi.fn() }
  const listeners: Array<{ target: EventTarget; type: string; fn: EventListener }> = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let closed = false

  const trackingProxy = (target: EventTarget & Record<string, unknown>) =>
    new Proxy(target, {
      get(t, prop, receiver) {
        if (prop === 'addEventListener') {
          return (type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
            listeners.push({ target: t, type, fn })
            t.addEventListener(type, fn, opts)
          }
        }
        const value = Reflect.get(t, prop, receiver)
        return typeof value === 'function' ? value.bind(t) : value
      },
    })

  const setT = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!closed) fn()
    }, ms)
    timers.add(id)
    return id
  }
  const clearT = (id: ReturnType<typeof setTimeout>) => {
    timers.delete(id)
    clearTimeout(id)
  }

  document.body.innerHTML = (bodyHtml ?? '').replace(/<script>[\s\S]*?<\/script>/g, '')
  new Function(
    'location',
    'document',
    'window',
    'setTimeout',
    'clearTimeout',
    scriptSource ?? '',
  )(
    location,
    trackingProxy(document as unknown as EventTarget & Record<string, unknown>),
    trackingProxy(window as unknown as EventTarget & Record<string, unknown>),
    setT,
    clearT,
  )

  const page: Page = {
    location,
    close() {
      closed = true
      for (const id of timers) clearTimeout(id)
      timers.clear()
      for (const l of listeners) l.target.removeEventListener(l.type, l.fn)
      listeners.length = 0
    },
  }
  openPages.push(page)
  return page
}

describe('offline.html (네이티브 오프라인 폴백 화면)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })

  afterEach(() => {
    for (const page of openPages.splice(0)) page.close()
    setVisibility('visible')
    sessionStorage.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('스크립트와 본문을 파일에서 실제로 꺼냈다', () => {
    expect(scriptSource, 'offline.html 에서 <script> 를 찾지 못했습니다').toBeTruthy()
    expect(bodyHtml, 'offline.html 에서 <body> 를 찾지 못했습니다').toBeTruthy()
  })

  it('연결이 돌아오면 앱으로 자동 복귀한다', async () => {
    const page = open()
    vi.mocked(fetch).mockResolvedValue({} as Response)

    await vi.advanceTimersByTimeAsync(3_000)

    expect(page.location.replace).toHaveBeenCalledWith('https://timemanager.mungji.com/')
  })

  it('probe 가 실패하면 백오프를 늘리며 계속 확인한다', async () => {
    open()

    await vi.advanceTimersByTimeAsync(3_000)
    expect(fetch).toHaveBeenCalledTimes(1)

    // 1.5배 백오프 — 같은 3초로는 다음 probe 가 오지 않는다.
    await vi.advanceTimersByTimeAsync(3_000)
    expect(fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('화면이 숨겨지면 probe 를 멈춘다 — 배터리가 아쉬운 상황에서 도는 코드다', async () => {
    open()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(fetch).toHaveBeenCalledTimes(1)

    // 이미 예약돼 있던 probe 한 번은 그대로 실행된다. 그 실행이 다음 예약을
    // 하지 않는 것이 핵심이다.
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.mocked(fetch).mockClear()

    await vi.advanceTimersByTimeAsync(300_000)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('다시 보이면 백오프를 무시하고 즉시 이어받는다', async () => {
    open()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(60_000)
    vi.mocked(fetch).mockClear()

    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('probe 예약이 갈라지지 않는다 — 복귀를 여러 번 반복해도 체인은 하나다', async () => {
    open()
    for (let i = 0; i < 5; i++) {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    }
    await vi.advanceTimersByTimeAsync(0)

    // 체인이 갈라졌다면 복귀 횟수만큼 늘어난다(예전 결함: 2^n).
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  describe('캡티브 포털 루프 차단', () => {
    /** 자동 복귀 → 앱 로드 실패 → 이 화면으로 되돌아옴, 을 한 번 재현한다. */
    async function bounceOnce() {
      const page = open()
      vi.mocked(fetch).mockResolvedValue({} as Response)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(page.location.replace, '자동 복귀가 일어나야 되돌아옴을 재현할 수 있다').toHaveBeenCalled()
      page.close() // 이동했으므로 이 문서는 파기된다
      vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    }

    it('짧은 시간 안에 두 번 되돌아오면 자동 이동을 멈춘다', async () => {
      await bounceOnce()
      await bounceOnce()

      // 세 번째 방문 — 여기서 또 자동 이동하면 무한 루프다.
      vi.mocked(fetch).mockClear() // 앞선 두 번의 probe 를 이번 관찰과 섞지 않는다
      const page = open()
      vi.mocked(fetch).mockResolvedValue({} as Response)
      await vi.advanceTimersByTimeAsync(60_000)

      expect(page.location.replace).not.toHaveBeenCalled()
      // 자동 이동을 안 할 거라면 probe 도 돌 이유가 없다.
      expect(fetch).not.toHaveBeenCalled()
    })

    it('자동이 막혀도 재시도 버튼은 언제나 동작한다', async () => {
      await bounceOnce()
      await bounceOnce()

      const page = open()
      document.getElementById('retry')!.click()

      expect(page.location.replace).toHaveBeenCalledWith('https://timemanager.mungji.com/')
    })

    it('수동 재시도는 카운터를 비워 자동 복귀를 다시 허용한다', async () => {
      await bounceOnce()
      await bounceOnce()

      const blocked = open() // 3번째 방문 — 차단 상태
      document.getElementById('retry')!.click()
      expect(blocked.location.replace).toHaveBeenCalled()
      blocked.close()

      // 수동 이동 뒤 다시 돌아왔다 — 카운터가 비었으므로 자동 복귀가 살아 있어야 한다.
      const page = open()
      vi.mocked(fetch).mockResolvedValue({} as Response)
      await vi.advanceTimersByTimeAsync(3_000)

      expect(page.location.replace).toHaveBeenCalledWith('https://timemanager.mungji.com/')
    })

    it('시간이 충분히 지난 뒤의 재방문은 되돌아온 것으로 세지 않는다', async () => {
      await bounceOnce()
      await bounceOnce()

      // 15초 창을 넘겨 다시 열면 사용자가 나중에 앱을 켠 것에 가깝다.
      await vi.advanceTimersByTimeAsync(20_000)
      const page = open()
      vi.mocked(fetch).mockResolvedValue({} as Response)
      await vi.advanceTimersByTimeAsync(3_000)

      expect(page.location.replace).toHaveBeenCalled()
    })
  })

  // android 사본은 `npx cap copy android` 가 만드는 산출물이라 gitignore 돼 있다.
  // 클린 클론·CI 에는 없는 것이 정상이므로 있을 때만 대조한다 — 그래도 실제로 빌드하는
  // 개발 머신에서는 반드시 돌아, "셸을 고쳤는데 cap copy 를 빠뜨려 APK 만 옛 코드"인
  // 상태를 잡는다(실제로 3cf0f50 의 수정이 이 사본에 반영되지 않은 채 남아 있었다).
  it.skipIf(!existsSync(resolve(findRepoRoot(), ANDROID_COPY_PATH)))(
    'android 사본이 원본과 동기화돼 있다 — cap copy 를 빠뜨리면 APK 만 옛 코드로 남는다',
    () => {
      expect(readShell(ANDROID_COPY_PATH)).toBe(html)
    },
  )
})
