/**
 * Case Storage API — 服务端持久化抽象层
 *
 * 替代原有的 localStorage 读写，通过 HTTP 调用 FastAPI 后端。
 * 所有方法均为 async，返回纯数据或抛出带 detail 的 Error。
 *
 * 如需回退到 localStorage，替换导入即可：
 *   import { localStorageStorage } from './storage-local.js'
 */

const BASE = import.meta.env.VITE_CASE_API_BASE || ''

// ── 用户标识（每个浏览器唯一，存 localStorage） ──────────────────────
const USER_ID_KEY = 'oncology_workstation_id'
let _userId = null

export function getUserId() {
  if (_userId) return _userId
  _userId = localStorage.getItem(USER_ID_KEY)
  if (!_userId) {
    _userId = 'ws-' + crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, _userId)
  }
  return _userId
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT = 30_000   // 单次请求超时 ms
const MAX_RETRIES = 2           // 额外重试次数（总共 3 次尝试）

/**
 * 发起 HTTP 请求，带超时和指数退避重试。
 * 仅对网络错误/5xx 重试；4xx 不重试（参数错误重试无意义）。
 */
async function request(path, options = {}, retries = MAX_RETRIES) {
  const url = `${BASE}${path}`
  let firstError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
          ...(options.headers || {}),
        },
        signal: controller.signal,
        ...options,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        const error = new Error(err.detail || `HTTP ${res.status}`)
        error.status = res.status
        // 4xx 不重试 — 直接抛出让 catch 块识别
        if (res.status >= 400 && res.status < 500) throw error
        // 5xx 可重试
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200))
          continue
        }
        throw error
      }
      return res.json()
    } catch (err) {
      clearTimeout(timer)
      if (!firstError) firstError = err
      // HTTP 4xx 是业务拒绝，绝不重试
      if (err.status >= 400 && err.status < 500) throw firstError
      // AbortError（超时）→ 可重试
      if (err.name === 'AbortError' && attempt < retries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200))
        continue
      }
      if (attempt < retries && err.message && !err.message.startsWith('HTTP 4')) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200))
        continue
      }
      // 重试耗尽：抛出第一个有意义的错误，而非最后一次的 TypeError/AbortError
      throw firstError
    }
  }
}

// ── Debounced patch buffer (for SSE token streaming) ───────────────────────

/** @type {Map<string, object>} caseId → accumulated patch */
const patchBuffer = new Map()
let flushTimer = null
let flushPromise = null  // 防止并发 flush 重复发送
const FLUSH_INTERVAL = 500 // ms

/**
 * 后台 MDT 文本累积缓存。
 * 与 patchBuffer 不同：mdtStreamText 需要拼接（而非覆盖），
 * 所以单独维护完整文本，每次 flush 时发送完整值。
 * @type {Map<string, string>} caseId → full accumulated mdtStreamText
 */
const backgroundMdtText = new Map()

// 跟踪最近一次 flush 时发送的 MDT 文本，避免重复发送未变化的内容
const _mdtLastFlushed = new Map()

async function flushPatchBuffer() {
  // 已有正在执行的 flush → 复用其 Promise，不重复发起
  if (flushPromise) return flushPromise

  const entries = [...patchBuffer.entries()]
  patchBuffer.clear()
  flushTimer = null

  if (entries.length === 0) return

  // 将后台 MDT 文本注入到各 case 的 patch 中（完整值，非增量）
  // 仅当文本自上次 flush 后有变更时才发送，避免重复传输
  for (const [caseId, patch] of entries) {
    const fullText = backgroundMdtText.get(caseId)
    if (fullText !== undefined && fullText !== _mdtLastFlushed.get(caseId)) {
      patch.mdtStreamText = fullText
      _mdtLastFlushed.set(caseId, fullText)
    }
  }

  flushPromise = Promise.allSettled(
    entries.map(([id, data]) =>
      request(`/api/cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data }),
      })
    )
  ).finally(() => {
    flushPromise = null
  })

  return flushPromise
}

/**
 * 强制刷新 patch 缓冲区 — 在流结束/取消时调用，确保不丢数据
 */
export function forceFlushPatchBuffer() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (patchBuffer.size > 0) {
    return flushPatchBuffer()
  }
  return Promise.resolve()
}

/**
 * 追加 token 到后台病例的 MDT 文本缓存（不立即发 HTTP，等 debounce 合并）
 * @param {string} caseId
 * @param {string} token
 */
export function appendBackgroundMdtToken(caseId, token) {
  const current = backgroundMdtText.get(caseId) || ''
  backgroundMdtText.set(caseId, current + token)
}

/**
 * 获取并清除后台病例的完整 MDT 文本
 * @param {string} caseId
 * @returns {string}
 */
export function consumeBackgroundMdtText(caseId) {
  const text = backgroundMdtText.get(caseId) || ''
  backgroundMdtText.delete(caseId)
  return text
}

// ── Public API ──────────────────────────────────────────────────────────────

export const caseStorage = {
  /** 健康检查 + 数据库连通性 */
  async healthCheck() {
    return request('/api/health')
  },

  /** 获取当前用户信息 */
  async getCurrentUser() {
    return request('/api/user/me')
  },

  /**
   * 列出病例（仅索引元数据）
   * @param {{ search?: string, days?: number }} [params]
   *        search — 模糊搜索 label / figo_stage（跨全部记录）
   *        days   — 仅返回最近 N 天记录
   */
  async listCases(params = {}) {
    const sp = new URLSearchParams()
    if (params.search) sp.set('search', params.search)
    if (params.days !== undefined) sp.set('days', params.days)
    const qs = sp.toString()
    return request(`/api/cases${qs ? '?' + qs : ''}`)
  },

  /** 获取病例完整数据（含 data JSON blob） */
  async getCase(caseId) {
    return request(`/api/cases/${caseId}`)
  },

  /**
   * 创建或 upsert 病例
   * @param {string} caseId
   * @param {{ label?: string, data?: object }} payload
   */
  async saveCase(caseId, payload = {}) {
    return request('/api/cases', {
      method: 'POST',
      body: JSON.stringify({
        id: caseId,
        label: payload.label || '未命名',
        data: payload.data || {},
      }),
    })
  },

  /**
   * 局部合并 data JSONB（后台写入专用）
   * 高频调用时自动 debounce（500ms 内合并）。
   * 注意：mdtStreamText 通过 appendBackgroundMdtToken 单独累积，
   * flush 时自动注入完整文本，调用方无需在 dataPatch 中包含 mdtStreamText。
   *
   * @param {string} caseId
   * @param {object} dataPatch — 要合并的字段
   * @param {boolean} [immediate=false] — 跳过 debounce，立即发送
   */
  async patchCase(caseId, dataPatch, immediate = false) {
    // 如果 dataPatch 包含 mdtStreamText，用它覆盖后台累积缓存
    if (dataPatch.mdtStreamText !== undefined) {
      backgroundMdtText.set(caseId, dataPatch.mdtStreamText)
      delete dataPatch.mdtStreamText
    }

    if (immediate) {
      // 立即发送：注入后台累积的 MDT 文本
      const fullMdt = backgroundMdtText.get(caseId)
      if (fullMdt !== undefined) {
        dataPatch.mdtStreamText = fullMdt
        backgroundMdtText.delete(caseId)
      }
      return request(`/api/cases/${caseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: dataPatch }),
      })
    }

    // Debounced path：合并到缓冲区，flush 时统一发送
    const existing = patchBuffer.get(caseId) || {}
    Object.assign(existing, dataPatch)
    patchBuffer.set(caseId, existing)

    if (!flushTimer) {
      flushTimer = setTimeout(() => flushPatchBuffer(), FLUSH_INTERVAL)
    }
  },

  /** 删除病例 */
  async deleteCase(caseId) {
    return request(`/api/cases/${caseId}`, { method: 'DELETE' })
  },

  /** 更新病例 label */
  async renameCase(caseId, label) {
    return request(`/api/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify({ label }),
    })
  },

  /** 获取当前活跃病例 ID */
  async getActiveCaseId() {
    const res = await request('/api/cases/active')
    return res.active_case_id || ''
  },

  /** 设置当前活跃病例 ID */
  async setActiveCaseId(caseId) {
    return request('/api/cases/active', {
      method: 'PUT',
      body: JSON.stringify({ active_case_id: caseId }),
    })
  },
}
