/**
 * useNetworkStatus composable 测试
 * ──────────────────────────────────────────────────────────────
 * 测试网络状态检测：初始值、online/offline 事件响应、生命周期清理。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { useNetworkStatus } from '@/composables/useNetworkStatus.js'

/**
 * 辅助：挂载 composable 到临时 Vue app
 */
function mountComposable(composable) {
  let result
  const container = document.createElement('div')
  const app = createApp({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  app.mount(container)
  return { result, app, container }
}

/** 仅修改 navigator.onLine 而不替换整个 navigator 对象 */
function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('useNetworkStatus', () => {
  let originalDescriptor

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine')
        || { configurable: true, get: () => true }
  })

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'onLine', originalDescriptor)
    }
  })

  // ── 初始状态 ──────────────────────────────────────────────
  it('isOnline 初始值与 navigator.onLine 一致 (online=true)', () => {
    setOnLine(true)
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(true)
    app.unmount()
  })

  it('isOnline 初始值与 navigator.onLine 一致 (online=false)', () => {
    setOnLine(false)
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(false)
    app.unmount()
  })

  // ── 事件响应 ──────────────────────────────────────────────
  it('收到 offline 事件后 isOnline 变为 false', async () => {
    setOnLine(true)
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(true)

    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(result.isOnline.value).toBe(false)

    app.unmount()
  })

  it('收到 online 事件后 isOnline 恢复为 true', async () => {
    setOnLine(false)
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(false)

    window.dispatchEvent(new Event('online'))
    await nextTick()
    expect(result.isOnline.value).toBe(true)

    app.unmount()
  })

  it('连续 online → offline → online 正确切换', async () => {
    setOnLine(true)
    const { result, app } = mountComposable(useNetworkStatus)

    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(result.isOnline.value).toBe(false)

    window.dispatchEvent(new Event('online'))
    await nextTick()
    expect(result.isOnline.value).toBe(true)

    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(result.isOnline.value).toBe(false)

    app.unmount()
  })

  // ── 生命周期：卸载后不再响应事件 ──────────────────────────
  it('组件卸载后事件监听器已移除，不再响应', async () => {
    setOnLine(true)
    const { result, app } = mountComposable(useNetworkStatus)

    app.unmount()

    // 卸载后再触发 — isOnline 不应变化
    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(result.isOnline.value).toBe(true)
  })
})
