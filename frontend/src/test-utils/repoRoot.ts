import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * 모노repo 루트를 찾는다. cwd 가 `frontend/` 든 레포 루트든 동작해야 하므로 위로 훑는다.
 *
 * `import.meta.url` 기반 경로 계산은 쓰지 않는다 — Vite 가 `new URL(..., import.meta.url)` 을
 * 에셋 참조로 정적 변환해 런타임에 엉뚱한 경로가 된다.
 */
export function findRepoRoot(): string {
  let dir = process.cwd()
  for (;;) {
    if (existsSync(join(dir, 'backend')) && existsSync(join(dir, 'frontend'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`모노repo 루트를 찾지 못했습니다 (cwd=${process.cwd()})`)
    dir = parent
  }
}

/**
 * 레포 루트 기준 상대경로로 파일을 읽는다.
 * 못 읽으면 조용히 통과시키지 않는다 — 경로가 바뀌었으면 그것부터 고쳐야 한다.
 */
export function readRepoFile(relativeToRepoRoot: string): string {
  const path = resolve(findRepoRoot(), relativeToRepoRoot)
  try {
    return readFileSync(path, 'utf8')
  } catch (cause) {
    throw new Error(`대조에 필요한 파일을 읽지 못했습니다: ${path}`, { cause })
  }
}
