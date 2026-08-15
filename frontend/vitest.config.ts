import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    // zustand persist가 localStorage에 접근하므로 jsdom 환경 필요
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  // tsconfig 의 jsx:"preserve" 는 Next 빌드용이라 esbuild 가 JSX 를 변환하지 않는다.
  // 컴포넌트를 렌더하는 테스트를 위해 테스트 실행에서만 React 변환을 붙인다.
  plugins: [react()],
  resolve: {
    alias: {
      // tsconfig paths "@/*" → ./src/* 매핑과 일치
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
