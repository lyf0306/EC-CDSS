/**
 * caseStorage API 层测试
 * ──────────────────────────────────────────────────────────────
 * 覆盖：HTTP 请求、重试逻辑、patch buffer、MDT 文本累积、错误处理。
 * 全局 fetch 被 mock，不发起真实网络请求。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  caseStorage,
  getUserId,
  forceFlushPatchBuffer,
  appendBackgroundMdtToken,
  consumeBackgroundMdtText,
} from '@/api/caseStorage.js'

// jsdom 可能不提供 crypto.randomUUID，polyfill 之
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = globalThis.crypto || {}
  globalThis.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ── Helpers ───────────────────────────────────────────────────
function mockFetch(impl) {
  return vi.spyOn(global, 'fetch').mockImplementation(impl)
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    statusText: status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : 'OK',
  }
}

describe('caseStorage', () => {
  beforeEach(() => {
    // 清理 localStorage（getUserId 依赖）
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── getUserId ─────────────────────────────────────────────
  describe('getUserId', () => {
    it('生成 UUID 前缀的工作站 ID', () => {
      const id = getUserId()
      expect(id).toMatch(/^ws-/)
      expect(id.length).toBeGreaterThan(10) // ws- + UUID
    })

    it('相同浏览器返回相同 ID（缓存）', () => {
      const id1 = getUserId()
      const id2 = getUserId()
      expect(id1).toBe(id2)
    })

    it('ID 格式正确且两次调用返回相同值（内存缓存）', () => {
      const id1 = getUserId()
      expect(id1).toMatch(/^ws-/)
      const id2 = getUserId()
      expect(id1).toBe(id2) // 第二次应返回缓存值
    })
  })

  // ── healthCheck ───────────────────────────────────────────
  describe('healthCheck', () => {
    it('成功返回 JSON', async () => {
      mockFetch(() => Promise.resolve(jsonResponse({ status: 'ok', db: 'connected' })))
      const res = await caseStorage.healthCheck()
      expect(res).toEqual({ status: 'ok', db: 'connected' })
    })

    it('失败抛出 Error', async () => {
      mockFetch(() => Promise.resolve(jsonResponse({ detail: 'DB down' }, 500)))
      await expect(caseStorage.healthCheck()).rejects.toThrow('DB down')
    })
  })

  // ── listCases ─────────────────────────────────────────────
  describe('listCases', () => {
    it('返回病例列表', async () => {
      const cases = [{ id: 'c1', label: 'Case 1' }]
      mockFetch(() => Promise.resolve(jsonResponse(cases)))
      const res = await caseStorage.listCases()
      expect(res).toEqual(cases)
    })

    it('传递 search 和 days 参数', async () => {
      const spy = mockFetch(() => Promise.resolve(jsonResponse([])))
      await caseStorage.listCases({ search: 'endo', days: 7 })
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('search=endo'),
        expect.anything()
      )
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('days=7'),
        expect.anything()
      )
    })
  })

  // ── getCase / saveCase / deleteCase ───────────────────────
  describe('CRUD', () => {
    it('getCase 返回完整病例数据', async () => {
      const full = { id: 'c1', label: 'Test', data: { figoStage: 'IIIc1' } }
      mockFetch(() => Promise.resolve(jsonResponse(full)))
      const res = await caseStorage.getCase('c1')
      expect(res.data.figoStage).toBe('IIIc1')
    })

    it('saveCase 发送 POST 并携带 X-User-Id', async () => {
      const spy = mockFetch(() => Promise.resolve(jsonResponse({ id: 'c1' })))
      await caseStorage.saveCase('c1', { label: 'Test', data: { step: 1 } })
      const [url, opts] = spy.mock.calls[0]
      expect(url).toContain('/api/cases')
      expect(opts.method).toBe('POST')
      expect(opts.headers['X-User-Id']).toMatch(/^ws-/)
      const body = JSON.parse(opts.body)
      expect(body.id).toBe('c1')
      expect(body.label).toBe('Test')
    })

    it('deleteCase 发送 DELETE', async () => {
      const spy = mockFetch(() => Promise.resolve(jsonResponse({ ok: true })))
      await caseStorage.deleteCase('c1')
      expect(spy.mock.calls[0][1].method).toBe('DELETE')
    })

    it('renameCase 发送 PUT 并携带 label', async () => {
      const spy = mockFetch(() => Promise.resolve(jsonResponse({ ok: true })))
      await caseStorage.renameCase('c1', 'New Name')
      const body = JSON.parse(spy.mock.calls[0][1].body)
      expect(body.label).toBe('New Name')
    })
  })

  // ── 重试逻辑 ──────────────────────────────────────────────
  describe('retry', () => {
    it('网络错误重试最多 3 次后抛出', async () => {
      const spy = mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))
      await expect(caseStorage.healthCheck()).rejects.toThrow('Failed to fetch')
      // 初始请求 + 2 次重试 = 3 次
      expect(spy).toHaveBeenCalledTimes(3)
    })

    it('5xx 错误重试', async () => {
      const spy = mockFetch(() => Promise.resolve(jsonResponse({ detail: 'Server Error' }, 500)))
      await expect(caseStorage.healthCheck()).rejects.toThrow('Server Error')
      expect(spy).toHaveBeenCalledTimes(3)
    })

    it('4xx 错误不重试', async () => {
      const spy = mockFetch(() => Promise.resolve(jsonResponse({ detail: 'Not Found' }, 404)))
      await expect(caseStorage.getCase('missing')).rejects.toThrow('Not Found')
      expect(spy).toHaveBeenCalledTimes(1) // 4xx 不重试
    })

    it('第 2 次尝试成功则不再重试', async () => {
      let count = 0
      mockFetch(() => {
        count++
        if (count < 2) return Promise.reject(new TypeError('Failed'))
        return Promise.resolve(jsonResponse({ ok: true }))
      })
      const res = await caseStorage.healthCheck()
      expect(res).toEqual({ ok: true })
      expect(count).toBe(2)
    })
  })

  // ── MDT 文本累积 ──────────────────────────────────────────
  describe('MDT 文本管理', () => {
    it('appendBackgroundMdtToken 累积 token', () => {
      appendBackgroundMdtToken('c1', 'Hello')
      appendBackgroundMdtToken('c1', ' World')
      expect(consumeBackgroundMdtText('c1')).toBe('Hello World')
    })

    it('consumeBackgroundMdtText 取出后清空', () => {
      appendBackgroundMdtToken('c1', 'Data')
      consumeBackgroundMdtText('c1')
      expect(consumeBackgroundMdtText('c1')).toBe('')
    })

    it('不同 caseId 独立隔离', () => {
      appendBackgroundMdtToken('c1', 'A')
      appendBackgroundMdtToken('c2', 'B')
      expect(consumeBackgroundMdtText('c1')).toBe('A')
      expect(consumeBackgroundMdtText('c2')).toBe('B')
    })
  })

  // ── Patch buffer ──────────────────────────────────────────
  describe('patchCase (debounced)', () => {
    it('forceFlushPatchBuffer 空缓冲区不报错', async () => {
      const res = await forceFlushPatchBuffer()
      expect(res).toBeUndefined() // Promise.resolve() → undefined
    })

    it('多次 patch 合并为一个 PATCH 请求', async () => {
      const spy = mockFetch(() => Promise.resolve(jsonResponse({ ok: true })))

      // 快速连续两次 patch（不 immediate）
      await caseStorage.patchCase('c1', { step: 1 })
      await caseStorage.patchCase('c1', { figoStage: 'IIIc' })

      // 强制 flush
      await forceFlushPatchBuffer()

      // 两次 patch 合并为一次 HTTP
      expect(spy).toHaveBeenCalledTimes(1)
      const body = JSON.parse(spy.mock.calls[0][1].body)
      expect(body.data.step).toBe(1)
      expect(body.data.figoStage).toBe('IIIc')
    })
  })
})
