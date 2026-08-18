import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

/**
 * 계정 삭제 유예 기간은 **세 곳**에 따로 적혀 있다.
 *
 *  1. `backend/src/main/resources/application.yml` 의 `member.deletion.grace-days` — 실제 집행값
 *  2. `frontend/src/app/privacy/page.tsx` 의 `DELETION_GRACE_DAYS` — 공개 약속(개인정보처리방침)
 *  3. 9개 언어의 `profile.deleteConfirm` — 삭제 직전 사용자에게 보여주는 문구
 *
 * 셋이 어긋나도 빌드·타입체크·기존 테스트가 전부 통과하고, **어긋났다는 사실을 아무도 모른다**.
 * 공개 약속과 실제 동작이 달라지는 것이라 조용히 넘어갈 성질이 아니다.
 *
 * 주석으로 "함께 고칠 것"이라고 적어둔 것을 이 테스트가 강제로 바꾼다.
 * 모노repo 라서 프론트 테스트가 백엔드 설정을 직접 읽을 수 있다.
 */

/**
 * 모노repo 루트를 찾는다. cwd 가 `frontend/` 든 레포 루트든 동작해야 하므로 위로 훑는다.
 * `import.meta.url` 기반 경로 계산은 쓰지 않는다 — Vite 가 `new URL(..., import.meta.url)` 을
 * 에셋 참조로 정적 변환해 런타임에 엉뚱한 경로가 된다.
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

function readRepoFile(relativeToRepoRoot: string): string {
  const path = resolve(findRepoRoot(), relativeToRepoRoot)
  try {
    return readFileSync(path, 'utf8')
  } catch (cause) {
    // 파일을 못 찾으면 조용히 통과시키지 않는다 — 경로가 바뀌었으면 그것부터 고쳐야 한다.
    throw new Error(`유예 기간 대조에 필요한 파일을 읽지 못했습니다: ${path}`, { cause })
  }
}

/** application.yml 의 `grace-days: ${MEMBER_DELETION_GRACE_DAYS:30}` 에서 기본값 30 을 뽑는다. */
function readBackendGraceDays(): number {
  const yml = readRepoFile('backend/src/main/resources/application.yml')
  const match = yml.match(/grace-days:\s*\$\{[A-Z_]+:(\d+)\}/)
  expect(match, 'application.yml 에서 member.deletion.grace-days 를 찾지 못했습니다').not.toBeNull()
  return Number(match![1])
}

function readPrivacyPageGraceDays(): number {
  const source = readRepoFile('frontend/src/app/privacy/page.tsx')
  const match = source.match(/const DELETION_GRACE_DAYS\s*=\s*(\d+)/)
  expect(match, 'privacy/page.tsx 에서 DELETION_GRACE_DAYS 를 찾지 못했습니다').not.toBeNull()
  return Number(match![1])
}

/**
 * 이 테스트가 대조하는 것은 application.yml 의 <b>기본값</b>이다. 운영이 환경변수로 다른
 * 값을 주면 실제 집행값이 갈라지는데, 그때도 이 테스트는 초록으로 남아 "확인했다"는
 * 착각만 남긴다. 그래서 오버라이드가 존재하는지를 함께 확인한다 — 생기면 여기서 막고,
 * 공개 문구까지 함께 고치도록 강제한다.
 */
function findGraceDaysOverrides(): string[] {
  const searched = [
    'k8s',
    '.github/workflows',
    'backend/src/main/resources',
  ]
  const hits: string[] = []
  const root = findRepoRoot()

  const walk = (relDir: string) => {
    const absDir = resolve(root, relDir)
    if (!existsSync(absDir)) return
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const rel = join(relDir, entry.name)
      if (entry.isDirectory()) {
        walk(rel)
        continue
      }
      if (!/\.(ya?ml|properties|env)$/.test(entry.name)) continue
      // 정의 자체(application.yml 의 `grace-days: ${...:30}`)는 오버라이드가 아니다.
      if (rel === 'backend/src/main/resources/application.yml') continue
      const text = readFileSync(resolve(root, rel), 'utf8')
      if (/MEMBER_DELETION_GRACE_DAYS|grace-days\s*:/.test(text)) hits.push(rel)
    }
  }

  for (const dir of searched) walk(dir)
  const composeFile = 'docker-compose.yml'
  if (existsSync(resolve(root, composeFile))
      && /MEMBER_DELETION_GRACE_DAYS/.test(readRepoFile(composeFile))) {
    hits.push(composeFile)
  }
  return hits
}

describe('계정 삭제 유예 기간', () => {
  const graceDays = readBackendGraceDays()

  it('백엔드 기본값이 양수 일수다', () => {
    expect(graceDays).toBeGreaterThan(0)
  })

  it('배포 설정이 기본값을 덮어쓰지 않는다 — 덮어쓰면 이 대조가 무의미해진다', () => {
    expect(
      findGraceDaysOverrides(),
      '유예 기간을 덮어쓰는 설정이 생겼습니다. /privacy 와 9개 언어 문구를 그 값으로 '
        + '함께 고치고, 이 테스트가 실제 집행값을 읽도록 갱신하세요',
    ).toEqual([])
  })

  it('개인정보처리방침의 공개 약속이 실제 집행값과 같다', () => {
    expect(readPrivacyPageGraceDays()).toBe(graceDays)
  })

  const locales = Object.keys(messages) as (keyof typeof messages)[]

  it('9개 언어를 모두 대조한다 (locale 이 추가되면 여기도 늘어난다)', () => {
    expect(locales.length).toBe(9)
  })

  it.each(locales)('%s 의 삭제 확인 문구가 같은 일수를 말한다', (locale) => {
    const text = messages[locale]['profile.deleteConfirm']
    expect(text, `${locale}: profile.deleteConfirm 이 없습니다`).toBeTruthy()

    // 부분 일치를 피한다 — 유예가 3일인데 문구에 "30"이 남아 있으면 통과해서는 안 된다.
    const standalone = new RegExp(`(?<!\\d)${graceDays}(?!\\d)`)
    expect(
      standalone.test(text),
      `${locale}: 삭제 확인 문구에 유예 기간 ${graceDays}이(가) 없습니다 — "${text}"`,
    ).toBe(true)
  })
})
