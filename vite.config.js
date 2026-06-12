/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  // loadEnv 读取 .env 文件，注入到 process.env（vite.config.js 的 Node 端可用）
  const env = loadEnv(mode, process.cwd(), '')
  // VITE_CASE_PROXY_TARGET 是 Vite 前缀，也会被 loadEnv 加载

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 5173,
      proxy: {
        // Case Storage API — 开发时指向本地，也可通过 VITE_CASE_PROXY_TARGET 覆盖
        '/api': {
          target: env.VITE_CASE_PROXY_TARGET || 'http://localhost:8052',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.js'],
    },
  }
})
