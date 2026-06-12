/**
 * useNetworkStatus composable 测试
 * ──────────────────────────────────────────────────────────────
 * 测试网络状态检测：初始值、online/offline 事件响应、生命周期清理。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { useNetworkStatus } from '@/composables/useNetworkStatus.js'

/**
 * 辅助：挂载 composable 到临时 Vue app，返回 result 和 app 用来卸载
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

describe('useNetworkStatus', () => {
  let originalOnLine

  beforeEach(() => {
    originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')
  })

  afterEach(() => {
    // 恢复 navigator.onLine
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine)
    }
  })

  // ── 初始状态 ──────────────────────────────────────────────
  it('isOnline 初始值与 navigator.onLine 一致 (online=true)', () => {
    vi.stubGlobal('navigator', { onLine: true })
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(true)
    app.unmount()
  })

  it('isOnline 初始值与 navigator.onLine 一致 (online=false)', () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(false)
    app.unmount()
  })

  // ── 事件响应 ──────────────────────────────────────────────
  it('收到 offline 事件后 isOnline 变为 false', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(true)

    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(result.isOnline.value).toBe(false)

    app.unmount()
  })

  it('收到 online 事件后 isOnline 恢复为 true', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { result, app } = mountComposable(useNetworkStatus)
    expect(result.isOnline.value).toBe(false)

    window.dispatchEvent(new Event('online'))
    await nextTick()
    expect(result.isOnline.value).toBe(true)

    app.unmount()
  })

  it('连续 online → offline → online 正确切换', async () => {
    vi.stubGlobal('navigator', { onLine: true })
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
    vi.stubGlobal('navigator', { onLine: true })
    const { result, app } = mountComposable(useNetworkStatus)

    app.unmount()

    // 卸载后触发 offline — isOnline 不应该改变（监听器已移除）
    window.dispatchEvent(new Event('offline'))
    await nextTick()
    // 注意：Vue ref 仍然可读，但值不应因卸载后事件而更新
    // 实际上由于 addEventListener 的回调已被 removeEventListener 移除，
    // isOnline 保持卸载前的值
    expect(result.isOnline.value).toBe(true)
  })
})
