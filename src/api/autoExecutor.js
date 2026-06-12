/**
 * autoExecutor.js — 自动执行引擎
 *
 * 将诊断管线（FIGO → Profile → MDT SSE → EBM 轮询）包装为 Promise，
 * 供 AutoExecutionView 按序调用。每个阶段独立、可取消、可重试。
 *
 * 注意：不与 Pinia store 耦合——调用方负责状态管理和持久化。
 */

import { apiFigoStage, apiProfileOnly, apiAnalyzeStream, apiEbmSubmit, apiEbmJobStatus, apiEbmJobResult } from './index.js'
import { withCancel } from '@/utils/withCancel.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** 延迟工具 */
const delay = ms => new Promise(r => setTimeout(r, ms))

// ── Phase 1: FIGO Staging ───────────────────────────────────────────────────

/**
 * 执行 FIGO 分期
 * @param {string} patientCase - 病理报告全文
 * @param {AbortSignal} [signal]
 * @returns {Promise<{figo_stage: string, raw_output: string}>}
 */
export async function runFigoStage(patientCase, signal) {
  return withCancel(apiFigoStage(patientCase), signal)
}

// ── Phase 2: Patient Profile ────────────────────────────────────────────────

/**
 * 执行患者画像提取 + ESGO 风险分层
 * @param {string} patientCase - 病理报告全文
 * @param {AbortSignal} [signal]
 * @returns {Promise<{figo_stage: string, esgo_risk_classification: string, new_patient_dict: object, ...}>}
 */
export async function runProfileOnly(patientCase, signal) {
  return withCancel(apiProfileOnly(patientCase), signal)
}

// ── Phase 3: MDT Treatment Plan (SSE streaming) ─────────────────────────────

/**
 * MDT 方案生成 — SSE 流式 Promise 包装
 *
 * @param {string} patientCase - 患者病例全文（含画像数据）
 * @param {number} topKSimilar  - 相似患者检索数
 * @param {object} callbacks
 * @param {(token: string) => void} callbacks.onToken      - 每个 token 回调
 * @param {(stage: string, payload: object) => void} callbacks.onProgress - 阶段进度
 * @param {(result: object) => void} callbacks.onResult     - 最终结果
 * @param {AbortSignal} [callbacks.signal]                 - 取消信号
 * @returns {Promise<{analysisResult: object, mdtReport: string, stageHistory: array}>}
 */
export function runMdtStream(patientCase, topKSimilar = 3, { onToken, onProgress, onResult, signal } = {}) {
  return new Promise((resolve, reject) => {
    let lastResult = null
    const stageHistory = []

    const controller = apiAnalyzeStream(patientCase, topKSimilar, {
      onToken(token) {
        onToken?.(token)
      },
      onEvent(type, payload) {
        if (type === 'progress') {
          stageHistory.push({ ...payload, ts: Date.now() })
          onProgress?.(payload.stage || '', payload)
        } else if (type === 'result') {
          lastResult = payload
          onResult?.(payload)
        }
      },
      onDone() {
        resolve({
          analysisResult: lastResult,
          mdtReport: lastResult?.mdt_report || '',
          stageHistory,
        })
      },
      onError(err) {
        reject(err)
      },
    })

    // 外部取消 → 中断 SSE fetch
    if (signal) {
      const onAbort = () => controller.abort()
      signal.addEventListener('abort', onAbort, { once: true })
      // 清理：正常完成时移除监听
      const origResolve = resolve
      resolve = (v) => { signal.removeEventListener('abort', onAbort); origResolve(v) }
      const origReject = reject
      reject = (e) => { signal.removeEventListener('abort', onAbort); origReject(e) }
    }
  })
}

// ── Phase 4: EBM Deep Search (async job polling) ────────────────────────────

/**
 * EBM 循证深搜 — 提交 + 轮询直到完成
 *
 * @param {string} treatmentContext - 治疗方案上下文（MDT 报告）
 * @param {object} callbacks
 * @param {(progress: object) => void} callbacks.onProgress - 轮询进度
 * @param {(status: object) => void} callbacks.onStatus    - 状态变更
 * @param {AbortSignal} [callbacks.signal]                 - 取消信号
 * @returns {Promise<{jobId: string, report: object, status: object}>}
 */
export async function runEbmSearch(treatmentContext, { onProgress, onStatus, signal } = {}) {
  // 1. Submit job
  const submitRes = await withCancel(apiEbmSubmit(treatmentContext), signal)
  const jobId = submitRes.job_id

  onStatus?.({ jobId, status: 'pending' })

  // 2. Poll until completed / failed / cancelled
  return new Promise((resolve, reject) => {
    const POLL_INTERVAL = 3000

    const poll = async () => {
      try {
        if (signal?.aborted) {
          reject(new DOMException('Cancelled', 'AbortError'))
          return
        }

        const status = await apiEbmJobStatus(jobId)
        onStatus?.(status)
        onProgress?.(status)

        if (status.status === 'completed') {
          const result = await apiEbmJobResult(jobId)
          resolve({ jobId, report: result, status })
        } else if (status.status === 'failed') {
          reject(new Error(status.error || status.message || 'EBM 深搜失败'))
        } else if (status.status === 'cancelled') {
          reject(new DOMException('EBM job cancelled by server', 'AbortError'))
        } else {
          // still running / pending
          await delay(POLL_INTERVAL)
          poll()
        }
      } catch (e) {
        reject(e)
      }
    }

    poll()
  })
}

// ── Phase 4b: Resume EBM polling (for page-refresh recovery) ────────────────

/**
 * 恢复 EBM 轮询（不重新提交任务）
 *
 * @param {string} jobId - 已提交的 EBM 任务 ID
 * @param {object} callbacks
 * @param {(progress: object) => void} callbacks.onProgress
 * @param {(status: object) => void} callbacks.onStatus
 * @param {AbortSignal} [callbacks.signal]
 * @returns {Promise<{jobId: string, report: object, status: object}>}
 */
export async function resumeEbmPolling(jobId, { onProgress, onStatus, signal } = {}) {
  return new Promise((resolve, reject) => {
    const POLL_INTERVAL = 3000

    const poll = async () => {
      try {
        if (signal?.aborted) {
          reject(new DOMException('Cancelled', 'AbortError'))
          return
        }

        const status = await apiEbmJobStatus(jobId)
        onStatus?.(status)
        onProgress?.(status)

        if (status.status === 'completed') {
          const result = await apiEbmJobResult(jobId)
          resolve({ jobId, report: result, status })
        } else if (status.status === 'failed') {
          reject(new Error(status.error || status.message || 'EBM 深搜失败'))
        } else if (status.status === 'cancelled') {
          reject(new DOMException('EBM job cancelled by server', 'AbortError'))
        } else {
          await delay(POLL_INTERVAL)
          poll()
        }
      } catch (e) {
        reject(e)
      }
    }

    poll()
  })
}

// ── Full Pipeline ───────────────────────────────────────────────────────────

/**
 * 完整自动管线：FIGO → Profile → MDT → EBM
 *
 * 各阶段通过 callbacks 报告进度，调用方负责 UI 更新和持久化。
 *
 * @param {string} patientCase - 病理报告全文
 * @param {object} callbacks
 * @param {(phase: string, data?: object) => void} callbacks.onPhaseChange
 * @param {(token: string) => void} callbacks.onMdtToken
 * @param {(progress: object) => void} callbacks.onMdtProgress
 * @param {(progress: object) => void} callbacks.onEbmProgress
 * @param {AbortSignal} [callbacks.signal]
 * @returns {Promise<{figo: object, profile: object, mdt: object, ebm: object}>}
 */
export async function runFullAutoPipeline(patientCase, callbacks = {}) {
  const { onPhaseChange, onMdtToken, onMdtProgress, onEbmProgress, signal } = callbacks

  // ── Phase A: FIGO Staging ──
  onPhaseChange?.('figo')
  const figo = await runFigoStage(patientCase, signal)

  // ── Phase B: Patient Profile ──
  onPhaseChange?.('profile')
  const profile = await runProfileOnly(patientCase, signal)

  // ── Build full patient_case for MDT ──
  const fullCase = [
    `【病理报告】${patientCase}`,
    `【FIGO 分期】${figo.figo_stage || ''}`,
    `【ESGO 风险分层】${profile.esgo_risk_classification || ''}`,
    `【患者画像】${JSON.stringify(profile.new_patient_dict || {}, null, 2)}`,
  ].join('\n\n')

  // ── Phase C: MDT Treatment Plan (SSE) ──
  onPhaseChange?.('mdt')
  const mdt = await runMdtStream(fullCase, 3, {
    onToken: onMdtToken,
    onProgress: (stage, payload) => onMdtProgress?.({ stage, ...payload }),
    signal,
  })

  // ── Build treatment context for EBM ──
  const mdtReport = mdt.mdtReport || ''
  const treatmentContext = [
    fullCase,
    `【MDT 治疗方案】${mdtReport}`,
  ].join('\n\n')

  // ── Phase D: EBM Deep Search ──
  onPhaseChange?.('ebm')
  const ebm = await runEbmSearch(treatmentContext, {
    onProgress: onEbmProgress,
    signal,
  })

  onPhaseChange?.('done')

  return { figo, profile, mdt, ebm }
}
