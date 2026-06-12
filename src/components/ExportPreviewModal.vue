<template>
  <!--
    ExportPreviewModal.vue
    ──────────────────────────────────────────────────────────────────────────
    导出报告预览弹窗。

    功能：
      - 全屏遮罩，展示合并后完整报告的预览效果（使用 MdtReportRenderer）
      - 提供三种导出操作：复制富文本 / PDF / Word
      - Esc 键 & 遮罩点击关闭
      - 支持模块2缺失时的空状态提示

    Props:
      visible   {boolean}  控制弹窗显隐
      html      {string}   完整报告 HTML（由父组件调用 buildFullReportHtml 生成）
      markdown  {string}   合并后的完整 Markdown（用于渲染预览）

    Emits:
      close           — 关闭弹窗
      copy            — 触发复制富文本
      export-pdf      — 触发 PDF 导出
      export-word     — 触发 Word 导出
    ──────────────────────────────────────────────────────────────────────────
  -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <div class="modal-box" role="dialog" aria-modal="true" aria-label="导出报告预览">

          <!-- ── 弹窗顶栏 ── -->
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div>
                <div class="modal-title">报告预览</div>
                <div class="modal-subtitle">MDT 治疗方案 + 循证证据支持 · 合并导出</div>
              </div>
            </div>
            <div class="modal-header-right">
              <!-- 导出操作组 -->
              <div class="export-action-group">
                <!-- 复制富文本 -->
                <button
                  class="export-action-btn"
                  :class="{ 'btn-loading': copyLoading }"
                  :disabled="copyLoading"
                  title="粘贴到 Word / 飞书时保留样式"
                  @click="handleCopy"
                >
                  <span v-if="copyLoading" class="btn-spinner"></span>
                  <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  {{ copyLoading ? '复制中…' : '复制富文本' }}
                </button>

                <!-- 导出 PDF -->
                <button
                  class="export-action-btn export-action-btn--pdf"
                  @click="handlePdf"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  导出 PDF
                </button>

                <!-- 导出 Word -->
                <button
                  class="export-action-btn export-action-btn--word"
                  @click="handleWord"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  导出 Word
                </button>
              </div>

              <!-- 关闭按钮 -->
              <button class="modal-close-btn" title="关闭（Esc）" @click="emit('close')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- ── 预览内容区 ── -->
          <div class="modal-body">
            <!-- Toast 提示（弹窗内） -->
            <Transition name="inner-toast-fade">
              <div v-if="innerToast" class="inner-toast" :class="`inner-toast-${innerToastType}`">
                {{ innerToast }}
              </div>
            </Transition>

            <!-- 纸张模拟容器 -->
            <div class="preview-paper">
              <MdtReportRenderer :markdown="markdown" />
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import MdtReportRenderer from './MdtReportRenderer.vue'
import { copyRichText, buildWordHtml, exportToPdf, exportToWord } from '../utils/reportExport.js'
import { renderMd } from '../utils/markdown.js'

// ── Props / Emits ──────────────────────────────────────────────────────────
const props = defineProps({
  /** 控制弹窗显隐 */
  visible: { type: Boolean, default: false },
  /** 完整报告 HTML（buildFullReportHtml 输出，用于实际导出） */
  html: { type: String, default: '' },
  /** 合并后 Markdown（用于预览渲染） */
  markdown: { type: String, default: '' },
})

const emit = defineEmits(['close'])

// ── 内部状态 ───────────────────────────────────────────────────────────────
const copyLoading   = ref(false)
const innerToast    = ref('')
const innerToastType = ref('success')
let toastTimer      = null

function showInnerToast(msg, type = 'success') {
  innerToast.value     = msg
  innerToastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { innerToast.value = '' }, 2800)
}

// ── 导出操作处理 ──────────────────────────────────────────────────────────
async function handleCopy() {
  if (!props.html) return
  copyLoading.value = true
  try {
    await copyRichText(props.html)
    showInnerToast('✅ 已复制富文本，可直接粘贴到 Word / 飞书')
  } catch (e) {
    console.error('[ExportPreview] copyRichText 失败:', e)
    showInnerToast('⚠️ 复制失败，请检查浏览器权限', 'error')
  } finally {
    copyLoading.value = false
  }
}

function handlePdf() {
  if (!props.html) return
  exportToPdf(props.html)
  showInnerToast('📄 已打开打印窗口，请选择"另存为 PDF"')
}

function handleWord() {
  if (!props.markdown) return
  const wordHtml = buildWordHtml(props.markdown, { renderMd })
  exportToWord(wordHtml)
  showInnerToast('📝 Word 文件已开始下载')
}
</script>

<style scoped>
/* ── 遮罩 ──────────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 24px;
  overflow-y: auto;
}

/* ── 弹窗容器 ──────────────────────────────────────────────────────────────── */
.modal-box {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22), 0 4px 20px rgba(0, 0, 0, 0.10);
  width: 100%;
  max-width: 860px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 确保在小屏下可滚动 */
  max-height: calc(100vh - 64px);
}

/* ── 顶栏 ────────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  background: var(--bg-1, #f8fafc);
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 10px;
}
.modal-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.modal-icon {
  width: 36px;
  height: 36px;
  background: var(--accent-blue-light, rgba(59, 130, 246, 0.1));
  border: 1px solid var(--accent-blue-mid, rgba(59, 130, 246, 0.25));
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-blue, #3b82f6);
  flex-shrink: 0;
}
.modal-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}
.modal-subtitle {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  margin-top: 1px;
}
.modal-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── 导出操作按钮组 ──────────────────────────────────────────────────────── */
.export-action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.export-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--border-md, #cbd5e1);
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #475569);
  cursor: pointer;
  transition: all 0.12s;
  font-family: var(--font-body, sans-serif);
}
.export-action-btn:hover:not(:disabled) {
  background: var(--bg-2, #f1f5f9);
  border-color: var(--border-strong, #94a3b8);
  color: var(--text-primary, #0f172a);
}
.export-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.export-action-btn--pdf {
  border-color: rgba(239, 68, 68, 0.3);
  color: #dc2626;
  background: rgba(239, 68, 68, 0.05);
}
.export-action-btn--pdf:hover {
  background: rgba(239, 68, 68, 0.10) !important;
  border-color: #dc2626 !important;
}
.export-action-btn--word {
  border-color: rgba(59, 130, 246, 0.3);
  color: var(--accent-blue, #3b82f6);
  background: var(--accent-blue-light, rgba(59, 130, 246, 0.05));
}
.export-action-btn--word:hover {
  background: rgba(59, 130, 246, 0.12) !important;
  border-color: var(--accent-blue, #3b82f6) !important;
}

/* Loading 状态 */
.btn-spinner {
  display: inline-block;
  width: 11px;
  height: 11px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: var(--accent-blue, #3b82f6);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── 关闭按钮 ────────────────────────────────────────────────────────────── */
.modal-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--border, #e2e8f0);
  background: transparent;
  color: var(--text-muted, #94a3b8);
  cursor: pointer;
  transition: all 0.12s;
  flex-shrink: 0;
}
.modal-close-btn:hover {
  background: var(--accent-rose-light, rgba(244, 63, 94, 0.08));
  border-color: rgba(244, 63, 94, 0.3);
  color: var(--accent-rose, #f43f5e);
}

/* ── 预览内容区 ──────────────────────────────────────────────────────────── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-2, #f1f5f9);
  padding: 28px 32px;
  position: relative;
}

/* 纸张容器 */
.preview-paper {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.08);
  padding: 40px 48px;
  max-width: 760px;
  margin: 0 auto;
  min-height: 400px;
}

/* ── 弹窗内 Toast ────────────────────────────────────────────────────────── */
.inner-toast {
  position: sticky;
  top: 0;
  z-index: 10;
  margin-bottom: 16px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  background: var(--text-primary, #0f172a);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  text-align: center;
}
.inner-toast-error { background: #dc2626; }

/* ── 过渡动画 ────────────────────────────────────────────────────────────── */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-active .modal-box,
.modal-fade-leave-active .modal-box {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .modal-box { transform: translateY(-16px) scale(0.97); }
.modal-fade-leave-to .modal-box   { transform: translateY(8px)  scale(0.98); opacity: 0; }

.inner-toast-fade-enter-active,
.inner-toast-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.inner-toast-fade-enter-from,
.inner-toast-fade-leave-to     { opacity: 0; transform: translateY(-6px); }
</style>