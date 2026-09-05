import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// eslint-config-next 15 는 아직 flat config 를 내보내지 않고 eslintrc 형식만 준다
// (node_modules/eslint-config-next 에 index.js / core-web-vitals.js / typescript.js 뿐).
// 그래서 FlatCompat 으로 감싼다 — eslint-config-next 가 flat 을 내보내면 이 래핑은 지울 수 있다.
const compat = new FlatCompat({ baseDirectory: __dirname })

// 여기 들어가는 항목은 전부 "생성물이거나 남의 코드"여야 한다.
// 경고가 시끄럽다는 이유로 우리 소스를 넣지 말 것 — 그러면 게이트가 게이트를 잃는다.
const ignores = [
  '.next/**',
  'out/**',
  'node_modules/**',
  // Next 가 생성하고 레포 루트 .gitignore 가 무시하는 파일. 우리가 고칠 수 없다
  // (파일 자체에 "should not be edited" 라고 적혀 있고, 매 빌드마다 다시 쓰인다).
  'next-env.d.ts',
  // serwist 가 빌드 때 생성하는 서비스워커 (frontend/.gitignore 참조)
  'public/sw.js',
  'public/sw.js.map',
  'public/swe-worker-*.js',
  // Capacitor 플랫폼 산출물 — cap sync 가 webDir 사본을 여기에 복사해 넣는다.
  // 원본은 src/ 와 capacitor-shell/ 에서 이미 검사된다.
  'ios/**',
  'android/**',
]

const config = [
  { ignores },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // 이 레포는 "의도적으로 안 쓰는 값"에 `_` 접두를 붙이는 관례를 이미 쓰고 있다
      // (예: timerPersistence 의 rest 구조분해로 레거시 필드를 떨궈내는 자리).
      // 관례를 규칙에 알려주지 않으면 그 자리마다 disable 주석을 달아야 해서,
      // 정작 봐야 할 진짜 미사용 변수 경고가 소음에 묻힌다.
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
]

export default config
