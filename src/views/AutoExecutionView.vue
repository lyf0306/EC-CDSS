<template>
  <div class="auto-page">
    <!-- ── Header ────────────────────────────────────────────── -->
    <div class="auto-header">
      <div class="auto-header-left">
        <h2 class="auto-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          自动执行
        </h2>
        <span class="auto-subtitle">导入报告后全自动运行 FIGO → Profile → MDT → EBM</span>
      </div>
      <div class="auto-header-right">
        <button class="btn btn-primary btn-sm" @click="triggerImport">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          导入文件
        </button>
        <div class="auto-setting">
          <span class="setting-label">并发</span>
          <select v-model.number="store.autoConcurrency" class="setting-select">
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── Empty State ───────────────────────────────────────── -->
    <div v-if="queueItems.length === 0" class="auto-empty">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      </div>
      <h3>拖拽或选择报告文件开始自动执行</h3>
      <p>支持 .docx、.pdf、.txt 格式，可一次选择多个文件</p>
      <button class="btn btn-primary btn-lg" @click="triggerImport">选择文件</button>
    </div>

    <!-- ── Queue ─────────────────────────────────────────────── -->
    <div v-else class="auto-queue">
      <!-- 进行中 + 排队中 -->
      <div v-if="activeItems.length > 0" class="queue-section">
        <h3 class="section-title">
          执行中
          <span class="section-count">{{ runningCount }}/{{ activeItems.length }}</span>
        </h3>
        <div class="queue-grid">
          <div
            v-for="item in activeItems" :key="item.id"
            class="queue-card"
            :class="{
              'card-running': item.status === 'running',
              'card-queued': item.status === 'queued',
            }"
          >
            <div class="card-top">
              <div class="card-info">
                <span class="card-label">{{ item.label }}</span>
                <span class="card-file">{{ item.fileName }}</span>
              </div>
              <div class="card-actions">
                <span v-if="item.status === 'queued'" class="tag tag-amber">排队中</span>
                <button
                  v-if="item.status === 'running' || item.status === 'queued'"
                  class="btn-icon btn-icon-rose"
                  title="取消"
                  @click="store.cancelAutoCase(item.id)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            <!-- Node chain -->
            <div class="node-chain">
              <template v-for="(p, i) in getPhaseNodes(item)" :key="p.key">
                <div v-if="i > 0" class="chain-link" :class="{ 'link-done': p.linkDone }"></div>
                <div class="chain-step">
                  <div class="chain-dot" :class="p.dotClass">
                    <svg v-if="p.icon === 'check'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <svg v-else-if="p.icon === 'x'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    <span v-else class="chain-dot-num">{{ i + 1 }}</span>
                  </div>
                  <span class="chain-name">{{ p.name }}</span>
                  <span class="chain-time">{{ p.timeText }}</span>
                </div>
              </template>
            </div>

          </div>
        </div>
      </div>

      <!-- 已完成 -->
      <div v-if="doneItems.length > 0" class="queue-section">
        <h3 class="section-title">
          已完成
          <span class="section-count">{{ doneItems.length }}</span>
          <button v-if="!doneBatchMode" class="btn-clear" @click="toggleDoneBatch">批量操作</button>
          <button v-else class="btn-clear btn-clear-exit" @click="toggleDoneBatch">退出批量</button>
        </h3>
        <div class="queue-grid">
          <div
            v-for="item in doneItems" :key="item.id"
            class="queue-card card-done"
            :class="{ 'card-checked': doneChecked.has(item.id) }"
          >
            <div class="card-top">
              <!-- Batch checkbox -->
              <div v-if="doneBatchMode" class="batch-checkbox" @click="toggleDoneCheck(item.id)">
                <svg v-if="doneChecked.has(item.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div v-else class="batch-checkbox-empty"></div>
              </div>
              <div class="card-info">
                <span class="card-label">{{ item.label }}</span>
                <span class="card-file">{{ item.fileName }}</span>
              </div>
              <div class="card-actions">
                <span class="tag tag-green">✓ 完成</span>
                <button v-if="!doneBatchMode" class="btn btn-sm btn-secondary" @click="viewCase(item.id)">查看</button>
                <button v-if="!doneBatchMode" class="btn-icon btn-icon-muted" title="移除此记录" @click="store.removeQueueItem(item.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div class="card-summary">
              <span v-if="item.result?.figo_stage" class="summary-chip">FIGO {{ item.result.figo_stage }}</span>
              <span v-if="item.result?.esgo_risk" class="summary-chip">{{ item.result.esgo_risk }}</span>
              <span v-if="item.result?.has_mdt" class="summary-chip">方案已生成</span>
              <span v-if="item.result?.has_ebm" class="summary-chip">证据已合成</span>
            </div>
          </div>
        </div>
        <!-- Batch action bar -->
        <div v-if="doneBatchMode" class="batch-bar">
          <button class="batch-btn" @click="selectAllDone">全选 ({{ doneItems.length }})</button>
          <button class="batch-btn" :disabled="doneChecked.size === 0" @click="clearDoneRecords">清除选中记录 ({{ doneChecked.size }})</button>
          <template v-if="batchDeleteConfirm !== 'done'">
            <button class="batch-btn batch-btn-del" :disabled="doneChecked.size === 0" @click.stop="batchDeleteConfirm = 'done'">删除选中病例及数据 ({{ doneChecked.size }})</button>
          </template>
          <template v-else>
            <span class="batch-confirm-text">此操作不可撤销，确认删除 {{ doneChecked.size }} 个病例？</span>
            <button class="batch-btn batch-btn-danger" @click="deleteDoneCases">确认删除</button>
            <button class="batch-btn batch-btn-cancel" @click="batchDeleteConfirm = null">取消</button>
          </template>
          <button class="batch-btn batch-btn-export" :disabled="doneChecked.size === 0 || exportLoading" @click="batchExport('word')">
            <span v-if="exportLoading && exportFormat === 'word'" class="btn-spinner"></span>
            导出 Word ({{ doneChecked.size || doneItems.length }})
          </button>
          <button class="batch-btn batch-btn-export batch-btn-export-pdf" :disabled="doneChecked.size === 0 || exportLoading" @click="batchExport('pdf')">
            <span v-if="exportLoading && exportFormat === 'pdf'" class="btn-spinner"></span>
            导出 PDF ({{ doneChecked.size || doneItems.length }})
          </button>
        </div>
      </div>

      <!-- 失败 -->
      <div v-if="failedItems.length > 0" class="queue-section">
        <h3 class="section-title">
          失败
          <span class="section-count section-count-rose">{{ failedItems.length }}</span>
          <button v-if="!failedBatchMode" class="btn-clear" @click="toggleFailedBatch">批量操作</button>
          <button v-else class="btn-clear btn-clear-exit" @click="toggleFailedBatch">退出批量</button>
        </h3>
        <div class="queue-grid">
          <div
            v-for="item in failedItems" :key="item.id"
            class="queue-card card-failed"
            :class="{ 'card-checked': failedChecked.has(item.id) }"
          >
            <div class="card-top">
              <!-- Batch checkbox -->
              <div v-if="failedBatchMode" class="batch-checkbox" @click="toggleFailedCheck(item.id)">
                <svg v-if="failedChecked.has(item.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div v-else class="batch-checkbox-empty"></div>
              </div>
              <div class="card-info">
                <span class="card-label">{{ item.label }}</span>
                <span class="card-file">{{ item.fileName }}</span>
              </div>
              <div class="card-actions">
                <span class="tag tag-rose">失败</span>
                <button v-if="!failedBatchMode" class="btn btn-sm btn-retry" title="重新执行" @click="retryCase(item.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  重试
                </button>
                <button v-if="!failedBatchMode" class="btn-icon btn-icon-muted" title="移除此记录" @click="store.removeQueueItem(item.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <p class="card-error">{{ item.error }}</p>
          </div>
        </div>
        <!-- Batch action bar -->
        <div v-if="failedBatchMode" class="batch-bar">
          <button class="batch-btn" @click="selectAllFailed">全选 ({{ failedItems.length }})</button>
          <button class="batch-btn" :disabled="failedChecked.size === 0" @click="clearFailedRecords">清除选中记录 ({{ failedChecked.size }})</button>
          <template v-if="batchDeleteConfirm !== 'failed'">
            <button class="batch-btn batch-btn-del" :disabled="failedChecked.size === 0" @click.stop="batchDeleteConfirm = 'failed'">删除选中病例及数据 ({{ failedChecked.size }})</button>
          </template>
          <template v-else>
            <span class="batch-confirm-text">此操作不可撤销，确认删除 {{ failedChecked.size }} 个病例？</span>
            <button class="batch-btn batch-btn-danger" @click="deleteFailedCases">确认删除</button>
            <button class="batch-btn batch-btn-cancel" @click="batchDeleteConfirm = null">取消</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 浮动导入按钮：队列非空时始终可见 -->
    <button
      v-if="queueItems.length > 0"
      class="fab-import"
      title="导入新文件"
      @click="triggerImport"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
    </button>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept=".docx,.pdf,.txt,.doc"
      multiple
      class="file-input-hidden"
      @change="onFilesSelected"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiagnosisStore } from '@/stores/diagnosis'
import { caseStorage } from '@/api/caseStorage'
import { buildFullReportHtml, buildEvidenceHtml, escapeHtml } from '@/utils/reportExport'

const store = useDiagnosisStore()
const router = useRouter()
const fileInput = ref(null)

// ── 批量操作状态 ─────────────────────────────────────────
const doneBatchMode = ref(false)
const doneChecked = ref(new Set())
const failedBatchMode = ref(false)
const failedChecked = ref(new Set())
const batchDeleteConfirm = ref(null)  // 'done' | 'failed' | null

function toggleDoneBatch() {
  doneBatchMode.value = !doneBatchMode.value
  if (!doneBatchMode.value) { doneChecked.value = new Set(); batchDeleteConfirm.value = null }
}
function toggleFailedBatch() {
  failedBatchMode.value = !failedBatchMode.value
  if (!failedBatchMode.value) { failedChecked.value = new Set(); batchDeleteConfirm.value = null }
}

function toggleDoneCheck(id) {
  const next = new Set(doneChecked.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  doneChecked.value = next
}
function toggleFailedCheck(id) {
  const next = new Set(failedChecked.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  failedChecked.value = next
}

function selectAllDone() { doneChecked.value = new Set(doneItems.value.map(i => i.id)) }
function selectAllFailed() { failedChecked.value = new Set(failedItems.value.map(i => i.id)) }

async function clearDoneRecords() {
  const ids = doneChecked.value
  if (ids.size === 0) return
  for (const id of ids) { await store.removeQueueItem(id) }
  doneChecked.value = new Set()
}
async function clearFailedRecords() {
  const ids = failedChecked.value
  if (ids.size === 0) return
  for (const id of ids) { await store.removeQueueItem(id) }
  failedChecked.value = new Set()
}

async function deleteDoneCases() {
  const ids = doneChecked.value
  if (ids.size === 0) return
  for (const id of ids) { await store.removeQueueItem(id, true) }
  doneChecked.value = new Set()
  batchDeleteConfirm.value = null
}
async function deleteFailedCases() {
  const ids = failedChecked.value
  if (ids.size === 0) return
  for (const id of ids) { await store.removeQueueItem(id, true) }
  failedChecked.value = new Set()
  batchDeleteConfirm.value = null
}

function retryCase(caseId) {
  console.log('[AutoView] retryCase 被点击:', caseId)
  store.retryAutoCase(caseId)
}

// ── 批量导出（Word / PDF） ──────────────────────────────
const exportLoading = ref(false)
const exportFormat = ref('')

async function batchExport(format) {
  const targets = doneChecked.value.size > 0
    ? doneItems.value.filter(i => doneChecked.value.has(i.id))
    : doneItems.value
  if (targets.length === 0) return

  exportLoading.value = true
  exportFormat.value = format

  try {
    // 逐个获取完整病例数据并构建报告 HTML
    const reports = []
    const failed = []
    for (const item of targets) {
      try {
        const stored = await caseStorage.getCase(item.id)
        const d = stored?.data || {}
        const profile = d.profileResult || {}
        const analysis = d.analysisResult || {}
        const evidenceList = d.evidenceList || []
        const bib = analysis.bibliography || []
        const ebmBodyHtml = d.ebmReport || ''

        const html = buildFullReportHtml({
          mdtHtml: d.mdtStreamText || d.editableMdtReport || '',
          ebmBodyHtml,
          evidenceHtml: buildEvidenceHtml(evidenceList, bib),
          esgo: profile.esgo_risk_classification || item.result?.esgo_risk || '',
          figo: profile.figo_stage || item.result?.figo_stage || '',
          patientInfo: profile.patient_profile_md || '',
          requestId: analysis.request_id || '',
        })
        reports.push({ item, html })
      } catch (e) {
        console.error(`[BatchExport] 获取病例 ${item.label} 数据失败:`, e)
        failed.push(item.label || item.id)
      }
    }

    if (reports.length === 0) {
      alert('未能获取任何病例数据，请检查网络连接')
      return
    }

    if (failed.length > 0) {
      console.warn(`[BatchExport] ${failed.length} 个病例获取失败:`, failed)
      // 仍然继续导出成功的部分，但在控制台留下完整列表
    }

    if (format === 'word') {
      // 逐个下载 .doc 文件
      for (const { item, html } of reports) {
        const wordHtml = buildWordHtmlFromReport(html)
        const fn = `${item.label || '报告'}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.doc`
        downloadBlob(wordHtml, fn, 'application/msword;charset=utf-8')
        // 小延迟避免浏览器拦截连续下载
        await new Promise(r => setTimeout(r, 200))
      }
    } else if (format === 'pdf') {
      // 合并所有报告为一个 HTML，分页打印
      const combined = buildCombinedPrintHtml(reports)
      const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
      if (!win) { alert('弹出窗口被阻止，请允许本页弹出新窗口后重试。'); return }
      win.document.open()
      win.document.write(combined)
      win.document.close()
      win.addEventListener('load', () => setTimeout(() => win.print(), 400))
    }
  } catch (e) {
    console.error('[BatchExport] 导出失败:', e)
    alert(`导出失败：${e.message}`)
  } finally {
    exportLoading.value = false
    exportFormat.value = ''
  }
}

/** 从已生成的 report HTML 构建 Word .doc */
function buildWordHtmlFromReport(fullHtml) {
  const styleMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const styles = styleMatch?.[0] || ''
  const body = bodyMatch?.[1] || fullHtml
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">${styles}</head>
<body>${body}</body></html>`
}

/** 多个报告合并为一个 HTML，用 page-break-after 分页 */
function buildCombinedPrintHtml(reports) {
  const styleMatch = reports[0]?.html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  const styles = styleMatch?.[0] || ''
  const bodies = reports.map((r, i) => {
    const bodyMatch = r.html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    const body = bodyMatch?.[1] || ''
    // 除了最后一页，每页末尾加分页符
    const pageBreak = i < reports.length - 1 ? '<div style="page-break-after:always;"></div>' : ''
    return `<div class="report-page"><div class="report-page-label">${escapeHtml(r.item.label)} · ${escapeHtml(r.item.fileName || '')}</div>${body}${pageBreak}</div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>自动执行报告合集</title>
${styles}
<style>
  .report-page { max-width: 900px; margin: 0 auto; padding: 20px 0; }
  .report-page-label { font-size: 14px; font-weight: 700; color: var(--accent-blue); padding: 8px 16px; background: var(--accent-blue-light); border-left: 3px solid var(--accent-blue); margin-bottom: 16px; border-radius: 0 6px 6px 0; }
  @media print { .report-page { padding: 0; } .report-page-label { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>${bodies}</body></html>`
}

function downloadBlob(html, filename, mimeType) {
  const blob = new Blob(['﻿', html], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// 点击页面其他区域关闭确认
function onDocumentClick() {
  if (batchDeleteConfirm.value) batchDeleteConfirm.value = null
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

const PHASE_DEFS = [
  { key: 'figo',    name: '分期诊断' },
  { key: 'profile', name: '患者档案' },
  { key: 'mdt',     name: '方案生成' },
  { key: 'ebm',     name: '证据合成' },
]
const PHASE_ORDER = ['pending', 'figo', 'profile', 'mdt', 'ebm', 'done']

function formatDuration(ms) {
  if (ms == null || ms <= 0 || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return `${mins}m${secs}s`
}

function getPhaseNodes(item) {
  const currIdx = PHASE_ORDER.indexOf(item.phase)
  const timings = item.phaseTimings || {}

  return PHASE_DEFS.map((p, i) => {
    const phaseIdx = i + 1  // 1=figo, 2=profile, 3=mdt, 4=ebm
    let status, icon, dotClass, timeText

    if (phaseIdx < currIdx) {
      status = 'done'
      icon = 'check'
      dotClass = 'dot-done'
      timeText = timings[p.key] != null ? formatDuration(timings[p.key]) : '—'
    } else if (phaseIdx === currIdx) {
      if (item.status === 'failed') {
        status = 'failed'
        icon = 'x'
        dotClass = 'dot-failed'
        timeText = timings[p.key] != null ? formatDuration(timings[p.key]) : '—'
      } else {
        status = 'active'
        icon = 'num'
        dotClass = 'dot-active'
        const raw = item._phaseStart ? (store.autoNow - item._phaseStart) : 0
        const elapsed = Number.isFinite(raw) ? raw : 0
        timeText = formatDuration(elapsed)
      }
    } else {
      status = 'pending'
      icon = 'num'
      dotClass = 'dot-pending'
      timeText = '—'
    }

    const linkDone = phaseIdx <= currIdx

    return { ...p, status, icon, dotClass, timeText, linkDone }
  })
}

const queueItems = computed(() => store.autoQueue)

const activeItems = computed(() =>
  queueItems.value.filter(q => q.status === 'running' || q.status === 'queued')
)

const runningCount = computed(() =>
  queueItems.value.filter(q => q.status === 'running').length
)

const doneItems = computed(() =>
  queueItems.value.filter(q => q.status === 'completed')
)

const failedItems = computed(() =>
  queueItems.value.filter(q => q.status === 'failed')
)

function triggerImport() {
  fileInput.value?.click()
}

async function onFilesSelected(e) {
  const files = [...e.target.files]
  if (files.length === 0) return

  await store.autoExecuteBatch(files)

  // Reset input so same file can be re-selected
  e.target.value = ''
}

function viewCase(caseId) {
  // 保持在自动模式，标记正在查看病例，后台流程继续运行
  store.autoViewingCase = true
  store.switchCase(caseId).then((ok) => {
    if (ok) {
      router.push('/figo')
    } else {
      // 病例数据加载失败，回退查看状态
      store.autoViewingCase = false
    }
  })
}
</script>

<style scoped>
.auto-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}

/* ── Header ────────────────────────────────────────────── */
.auto-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}
.auto-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.auto-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.auto-title svg { color: var(--accent-amber); flex-shrink: 0; }
.auto-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: 28px;
}
.auto-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.auto-setting {
  display: flex;
  align-items: center;
  gap: 6px;
}
.setting-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}
.setting-select {
  padding: 4px 8px;
  border: 1px solid var(--border-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: var(--font-mono);
  color: var(--text-primary);
  background: var(--bg-0);
  cursor: pointer;
}

/* ── Empty State ───────────────────────────────────────── */
.auto-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  border: 2px dashed var(--border-md);
  border-radius: var(--radius-md);
  background: var(--bg-1);
}
.empty-icon { color: var(--text-muted); margin-bottom: 16px; opacity: 0.5; }
.auto-empty h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}
.auto-empty p {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 20px;
}
.btn-lg { padding: 10px 24px; font-size: 14px; }

/* ── Queue Sections ────────────────────────────────────── */
.queue-section {
  margin-bottom: 28px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}
.section-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-2);
  padding: 1px 8px;
  border-radius: 100px;
}
.section-count-rose { color: var(--accent-rose); background: var(--accent-rose-light); }
.btn-clear {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}
.btn-clear:hover { color: var(--accent-rose); background: var(--accent-rose-light); }

.queue-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Queue Card ────────────────────────────────────────── */
.queue-card {
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-md);
  background: var(--bg-0);
  transition: box-shadow 0.15s;
}
.queue-card:hover { box-shadow: var(--shadow-sm); }
.card-running { border-left: 3px solid var(--accent-blue); }
.card-queued  { border-left: 3px solid var(--border-md); opacity: 0.75; }
.card-done    { border-left: 3px solid var(--accent-green); }
.card-failed  { border-left: 3px solid var(--accent-rose); }

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.card-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-file {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Node Chain */
.node-chain {
  display: flex;
  align-items: flex-start;
  margin-bottom: 4px;
  padding: 2px 0;
}
.chain-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 0 0 64px;
}
.chain-link {
  flex: 1;
  height: 2px;
  border-radius: 1px;
  background: var(--border-md);
  margin-top: 12px;
  min-width: 12px;
  transition: background 0.4s ease;
}
.chain-link.link-done {
  background: var(--accent-teal);
}
.chain-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border-md);
  background: var(--bg-0);
  transition: all 0.35s ease;
  flex-shrink: 0;
}
.chain-dot-num {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-muted);
}
.chain-dot.dot-done {
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: #fff;
}
.chain-dot.dot-done svg { color: #fff; }
.chain-dot.dot-active {
  border-color: var(--accent-blue);
  background: var(--accent-blue-light);
  box-shadow: 0 0 0 3px var(--accent-blue-mid);
  animation: node-pulse 1.5s ease-in-out infinite;
}
.chain-dot.dot-active .chain-dot-num {
  color: var(--accent-blue);
}
.chain-dot.dot-failed {
  border-color: var(--accent-rose);
  background: var(--accent-rose-light);
  color: var(--accent-rose);
}
.chain-dot.dot-failed svg { color: var(--accent-rose); }
.chain-dot.dot-pending {
  border-color: var(--border-md);
  background: var(--bg-0);
}
@keyframes node-pulse {
  0%, 100% { box-shadow: 0 0 0 3px var(--accent-blue-mid); }
  50% { box-shadow: 0 0 0 7px rgba(37,99,235,0.06); }
}
.chain-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
  line-height: 1;
}
.chain-time {
  font-size: 10px;
  font-weight: 500;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  text-align: center;
  line-height: 1;
}
/* Done Summary */
.card-summary {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.summary-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 100px;
  background: var(--bg-2);
  color: var(--text-secondary);
  border: 1px solid var(--border-md);
}

/* ── Failed ────────────────────────────────────────────── */
.card-error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--accent-rose);
  line-height: 1.5;
}

/* ── Buttons ───────────────────────────────────────────── */
.btn-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-2);
  color: var(--text-muted);
}
.btn-icon:hover { background: var(--bg-3); color: var(--text-primary); }
.btn-icon-rose:hover { background: var(--accent-rose-light); color: var(--accent-rose); }
.btn-icon-muted:hover { background: var(--bg-3); color: var(--text-primary); }

.btn-sm { padding: 4px 12px; font-size: 12px; }

.btn-retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--accent-amber);
  background: var(--accent-amber-light, #fefce8);
  color: var(--accent-amber);
  font-weight: 600;
  transition: all 0.2s;
}
.btn-retry:hover {
  background: var(--accent-amber);
  color: #fff;
}

.file-input-hidden { display: none; }

/* ── 批量操作按钮 ──────────────────────────────────── */
.btn-clear {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: 1px solid var(--border-md);
  cursor: pointer;
  padding: 3px 10px;
  border-radius: 4px;
  transition: all 0.15s;
}
.btn-clear:hover { color: var(--accent-blue); border-color: var(--accent-blue); background: var(--accent-blue-light); }
.btn-clear-exit { color: var(--text-primary); border-color: var(--border-md); font-weight: 500; }

/* ── Batch checkbox ────────────────────────────────── */
.batch-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid var(--border-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  color: var(--accent-blue);
}
.batch-checkbox:hover { border-color: var(--accent-blue); }
.batch-checkbox-empty {
  width: 10px; height: 10px;
}
.card-checked {
  background: var(--accent-blue-light) !important;
  border-left-color: var(--accent-blue) !important;
}

/* ── Batch action bar ──────────────────────────────── */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 0 4px;
}
.batch-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border: 1px solid var(--border-md);
  border-radius: 4px;
  cursor: pointer;
  background: var(--bg-0);
  color: var(--text-primary);
  transition: all 0.15s;
}
.batch-btn:hover:not(:disabled) { border-color: var(--accent-blue); color: var(--accent-blue); background: var(--accent-blue-light); }
.batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.batch-btn-del:hover:not(:disabled) { border-color: var(--accent-rose); color: var(--accent-rose); background: var(--accent-rose-light); }
.batch-btn-export { color: var(--accent-blue); border-color: rgba(59,130,246,.35); display: inline-flex; align-items: center; gap: 5px; }
.batch-btn-export:hover:not(:disabled) { border-color: var(--accent-blue); color: var(--accent-blue); background: var(--accent-blue-light); }
.batch-btn-export-pdf { color: #dc2626; border-color: rgba(220,38,38,.35); }
.batch-btn-export-pdf:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; background: rgba(239,68,68,.06); }
.btn-spinner {
  display: inline-block; width: 11px; height: 11px;
  border: 2px solid rgba(0,0,0,.15); border-top-color: var(--accent-blue);
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.batch-btn-danger {
  color: #fff !important;
  background: var(--accent-rose) !important;
  border-color: var(--accent-rose) !important;
  font-weight: 600;
}
.batch-btn-danger:hover { background: #e11d48 !important; }
.batch-btn-cancel {
  color: var(--text-muted) !important;
}
.batch-btn-cancel:hover { background: var(--bg-2) !important; }
.batch-confirm-text {
  font-size: 11px;
  color: var(--accent-rose);
  font-weight: 500;
  padding: 0 4px;
}

/* ── Floating import button ──────────────────────────── */
.fab-import {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--accent-amber);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  transition: all 0.2s;
  z-index: 30;
}
.fab-import:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(0,0,0,0.25);
}
.fab-import:active {
  transform: scale(0.96);
}
</style>
