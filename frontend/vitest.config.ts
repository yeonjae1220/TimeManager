import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    // zustand persist가 localStorage에 접근하므로 jsdom 환경 필요
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      // tsconfig paths "@/*" → ./src/* 매핑과 일치
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
