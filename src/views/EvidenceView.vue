<template>
  <div class="evidence-page">
    <div class="page-wrap">

      <!-- ── Header ── -->
      <div class="pg-header">
        <div>
          <div class="pg-step">STEP 03</div>
          <h1 class="pg-title">证据合成</h1>
          <p class="pg-sub">AI 深度循证校验 MDT 方案，补充最新 PubMed 证据</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" @click="$router.push('/treatment')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            返回方案生成
          </button>
          <button
            v-if="store.ebmStatus === 'completed'"
            class="btn btn-cta btn-sm"
            :disabled="store.ebmLoading"
            @click="startEbmSearch"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.86"/></svg>
            重新生成
          </button>
        </div>
      </div>

      <!-- ── 2-column + centre layout ── -->
      <div class="main-grid">

        <!-- ═══ LEFT: Patient context ═══ -->
        <div class="left-col">

          <!-- Patient features -->
          <div class="card ctx-card">
            <div class="ctx-hdr">
              <span class="ctx-title">患者特征</span>
              <div class="ctx-chips">
                <span v-if="figoStaging" class="figo-chip">{{ figoStaging }}</span>
                <span v-if="store.clinicalInfo.esgo_risk_classification" class="esgo-chip" :class="esgoChipClass">
                  {{ store.clinicalInfo.esgo_risk_classification }}
                </span>
              </div>
            </div>
            <div v-if="store.profileResult" class="ctx-profile">{{ store.profileResult.patient_profile_md }}</div>
            <div v-else class="ctx-empty">尚无患者画像，请先完成分期诊断</div>
          </div>

          <!-- Treatment summary -->
          <div class="card ctx-card">
            <div class="ctx-hdr">
              <span class="ctx-title">治疗方案</span>
              <span v-if="!treatmentReport" class="ctx-warn-badge">未载入</span>
            </div>
            <div v-if="treatmentReport" class="ctx-profile">{{ treatmentReport }}</div>
            <div v-else class="ctx-empty">
              尚无方案数据，请先
              <button class="ctx-link-btn" @click="$router.push('/treatment')">生成 MDT 报告</button>
            </div>
          </div>

        </div>

        <!-- ═══ CENTRE: EBM Hero + Evidence (collapsible) ═══ -->
        <div class="centre-col">

          <!-- ════════════════════════════════════════════════════════════
               EBM HERO CARD — the main event
               ════════════════════════════════════════════════════════════ -->
          <div v-if="treatmentReport" class="card ebm-hero">
            <!-- Hero header -->
            <div class="ebm-hero-hdr">
              <div class="ebm-hero-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                  <path d="M9 2a12.05 12.05 0 0 0 0 20"/>
                  <path d="M15 2a12.05 12.05 0 0 1 0 20"/>
                </svg>
              </div>
              <div class="ebm-hero-title-wrap">
                <div class="ebm-hero-title">循证医学深搜（PathoEBM）</div>
                <div class="ebm-hero-sub">PubMed / ClinicalTrials.gov 深度检索 → 方案安全性校验 → 最新证据补充</div>
              </div>
              <div class="ebm-hero-badges">
                <span v-if="store.ebmStatus === 'completed'" class="ebm-hero-badge ebm-badge-done">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  已完成
                </span>
                <span v-else-if="store.ebmStatus === 'running'" class="ebm-hero-badge ebm-badge-running">检索中…</span>
                <span v-else-if="store.ebmStatus === 'failed'" class="ebm-hero-badge ebm-badge-failed">失败</span>
                <span v-else class="ebm-hero-badge ebm-badge-idle">待启动</span>
              </div>
            </div>

            <!-- ── Idle state: big submit area ── -->
            <div v-if="!store.ebmJobId || store.ebmStatus === 'failed'" class="ebm-hero-idle">
              <p class="ebm-hero-desc">
                将当前 MDT 方案提交至 PathoEBM 引擎，系统将自动检索最新文献、评估方案安全性、检测药物相互作用，并生成循证增强报告。
              </p>
              <div v-if="store.ebmStatus === 'failed'" class="ebm-hero-error">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                上次任务失败：{{ store.ebmError }}
              </div>
              <button
                class="btn ebm-hero-btn"
                :disabled="store.ebmLoading"
                @click="startEbmSearch"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
                {{ store.ebmStatus === 'failed' ? '重新启动循证深搜' : '启动循证深搜' }}
              </button>
            </div>

            <!-- ── Running: animated stage timeline ── -->
            <div v-if="store.ebmLoading" class="ebm-hero-progress">
              <TransitionGroup name="stage" tag="div" class="ebm-stage-timeline">
                <!-- Completed stages -->
                <div v-for="s in stageHistory" :key="s.stage" class="ebm-stage-item done">
                  <div class="ebm-stage-marker">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div class="ebm-stage-body">
                    <div class="ebm-stage-head">
                      <span class="ebm-stage-name">{{ s.label }}</span>
                      <span class="ebm-stage-time">{{ formatElapsed(s.elapsed) }}</span>
                    </div>
                    <div v-if="s.message" class="ebm-stage-msg">{{ s.message }}</div>
                    <div v-if="s.iteration" class="ebm-stage-meta">第 {{ s.iteration }} 轮</div>
                  </div>
                </div>
                <!-- Current active stage -->
                <div v-if="currentStageKey" :key="currentStageKey" class="ebm-stage-item active">
                  <div class="ebm-stage-marker">
                    <span class="ebm-stage-spinner"></span>
                  </div>
                  <div class="ebm-stage-body">
                    <div class="ebm-stage-head">
                      <span class="ebm-stage-name">{{ STAGE_LABELS[currentStageKey]?.label || store.ebmProgress?.stage }}</span>
                      <span class="ebm-stage-time live">{{ formatElapsed(liveElapsed) }}</span>
                    </div>
                    <div v-if="stageMessage" class="ebm-stage-msg">{{ stageMessage }}</div>
                    <div v-if="stageIteration" class="ebm-stage-meta">第 {{ stageIteration }} 轮</div>
                  </div>
                </div>
                <!-- Fallback when no stage yet (before first poll returns) -->
                <div v-if="!currentStageKey && stageHistory.length === 0" key="init" class="ebm-stage-item active">
                  <div class="ebm-stage-marker">
                    <span class="ebm-stage-spinner"></span>
                  </div>
                  <div class="ebm-stage-body">
                    <div class="ebm-stage-head">
                      <span class="ebm-stage-name">提交中</span>
                      <span class="ebm-stage-time live">…</span>
                    </div>
                    <div class="ebm-stage-msg">正在连接 PathoEBM 引擎…</div>
                  </div>
                </div>
              </TransitionGroup>
              <!-- Indeterminate progress bar -->
              <div class="ebm-progress-indeterminate">
                <div class="ebm-progress-shimmer"></div>
              </div>
              <!-- Cancel button -->
              <div class="ebm-cancel-wrap">
                <button class="btn ebm-cancel-btn" @click="cancelEbmSearch">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                  </svg>
                  中止深搜
                </button>
              </div>
            </div>

            <!-- ── Completed: report ── -->
            <div v-if="store.ebmStatus === 'completed' && store.ebmReport" class="ebm-hero-result">
              <!-- Stage timeline summary (compact) -->
              <div v-if="stageHistory.length" class="ebm-stage-summary">
                <div v-for="(s, i) in stageHistory" :key="s.stage" class="ebm-ss-item">
                  <div class="ebm-ss-marker">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span class="ebm-ss-name">{{ s.label }}</span>
                  <span class="ebm-ss-time">{{ formatElapsed(s.elapsed) }}</span>
                  <span v-if="i < stageHistory.length - 1" class="ebm-ss-arrow">→</span>
                </div>
              </div>
              <div class="ebm-result-bar">
                <span class="ebm-result-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  循证校验完成
                </span>
                <span class="ebm-result-meta">
                  <span v-if="store.ebmProgress?.iteration">共 {{ store.ebmProgress.iteration }} 轮检索</span>
                  <span v-if="store.ebmProgress?.elapsed_seconds">耗时 {{ formatElapsed(store.ebmProgress.elapsed_seconds) }}</span>
                </span>
                <div class="ebm-result-actions">
                  <button class="btn btn-ghost btn-sm" @click="toggleEbmCollapse">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      :style="{ transform: ebmCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .2s' }">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    {{ ebmCollapsed ? '展开报告' : '收起报告' }}
                  </button>
                </div>
              </div>
              <!-- Report body (collapsible) -->
              <div v-show="!ebmCollapsed" class="ebm-hero-report-body" v-html="ebmReportHtml"></div>
            </div>
          </div>

          <!-- ── No MDT yet ── -->
          <div v-else class="card ebm-hero ebm-hero-empty">
            <div class="ebm-hero-hdr">
              <div class="ebm-hero-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div class="ebm-hero-title-wrap">
                <div class="ebm-hero-title">循证医学深搜（PathoEBM）</div>
              </div>
            </div>
            <p class="ebm-hero-placeholder">
              请先在"方案生成"页面生成 MDT 报告，再启动循证深搜。
              <button class="ctx-link-btn" @click="$router.push('/treatment')">前往方案生成</button>
            </p>
          </div>

          <!-- ════════════════════════════════════════════════════════════
               EVIDENCE PANEL — secondary, collapsible
               ════════════════════════════════════════════════════════════ -->
          <div class="card evidence-panel" :class="{ 'ev-panel-collapsed': !evidenceOpen }">
            <!-- Collapsed summary bar (always visible) -->
            <div class="ev-panel-bar" @click="toggleEvidence">
              <div class="ev-panel-bar-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
                </svg>
                <span class="ev-panel-bar-title">KG 循证证据列表</span>
                <span class="ev-panel-bar-count">
                  {{ hasReportRefs ? reportRefCount + ' 条参考文献' : visibleItems.length + ' 条证据' }}
                </span>
                <span v-if="hasReportRefs" class="ev-panel-bar-uncited">（源自 MDT 方案报告）</span>
                <span v-if="highlightedCount" class="ev-panel-bar-starred">★ {{ highlightedCount }}</span>
              </div>
              <div class="ev-panel-bar-right">
                <span class="ev-panel-bar-hint">{{ evidenceOpen ? '点击收起' : '点击展开' }}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                  :style="{ transform: evidenceOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            <!-- Expandable body -->
            <div v-show="evidenceOpen" class="ev-panel-body">
              <!-- Empty state -->
              <div v-if="!hasEvidence" class="state-box">
                <div class="state-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
                </div>
                <p class="state-txt">暂无证据数据<br>请先在"方案生成"页面生成 MDT 报告</p>
                <button class="btn btn-primary btn-sm" @click="$router.push('/treatment')">前往方案生成</button>
              </div>

              <template v-else>
                <!-- Search bar -->
                <div class="ev-search-bar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input v-model="searchQuery" class="ev-search-input" placeholder="在证据列表中搜索..." />
                  <span v-if="searchQuery" class="ev-clear" @click="searchQuery=''">✕</span>
                </div>

                <!-- Cited-only toggle (hidden when refs are from report) -->
                <div v-if="!hasReportRefs && uncitedEvidenceCount > 0" class="ev-cited-toggle">
                  <button class="ev-cited-btn" :class="{ active: citedOnly }" @click="citedOnly = !citedOnly">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <span>{{ citedOnly ? '仅已引用' : '显示全部' }}</span>
                  </button>
                  <span v-if="!citedOnly" class="ev-cited-hint">{{ primaryEvidenceList.value.length - hiddenCount }} 条全部显示</span>
                </div>

                <!-- Hidden notice -->
                <div v-if="hiddenCount > 0" class="hidden-notice">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  已隐藏 {{ hiddenCount }} 条证据
                  <button class="btn btn-ghost btn-sm" @click="restoreAllHidden()">全部恢复</button>
                </div>

                <!-- Evidence items — bibliography-entry style -->
                <div class="ev-list">
                  <div v-if="visibleItems.length === 0" class="ev-empty">
                    <span>没有符合当前筛选条件的证据</span>
                  </div>

                  <div
                    v-for="item in visibleItems"
                    :key="item.id"
                    class="bib-entry"
                  >
                    <span class="bib-num">[{{ item.id + 1 }}]</span>
                    <div>
                      <div class="bib-title">{{ getItemTitle(item) }}</div>
                      <div class="bib-meta">
                        <span v-if="item.source" class="tag" :class="sourceTagClass(item.source)">{{ item.source }}</span>
                        <template v-if="getPmid(item.link)">
                          <a :href="item.link" target="_blank" rel="noopener" class="bib-pmid font-mono">PMID: {{ getPmid(item.link) }}</a>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

        </div>

        <!-- ═══ RIGHT: Export ═══ -->
        <div class="right-col">

          <!-- Export panel -->
          <div class="card export-card">
            <div class="filter-hdr">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              导出完整报告
            </div>

            <div v-if="!treatmentReport" class="export-warn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              未检测到模块 2（MDT 方案），<br>报告将仅包含循证证据部分。
            </div>

            <div class="export-opts">
              <button class="btn btn-cta btn-sm export-btn" :disabled="!hasEvidence" @click="openExportPreview">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                预览并导出报告
              </button>

              <div class="export-divider">
                <span>或直接导出</span>
              </div>

              <button class="btn btn-secondary btn-sm export-btn" :disabled="!hasEvidence || copyLoading" @click="quickExport('copy')">
                <span v-if="copyLoading" class="quick-spinner"></span>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                {{ copyLoading ? '复制中…' : '复制富文本（Word / 飞书）' }}
              </button>

              <button class="btn btn-secondary btn-sm export-btn" :disabled="!hasEvidence" @click="quickExport('pdf')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                导出 PDF（打印）
              </button>

              <button class="btn btn-secondary btn-sm export-btn" :disabled="!hasEvidence" @click="quickExport('word')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                导出 Word (.doc)
              </button>

              <button class="btn btn-ghost btn-sm export-btn" :disabled="!hasEvidence" @click="legacyExport('json')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                导出原始 JSON 数据
              </button>
            </div>
            <div class="export-note">
              导出范围：当前可见 ({{ visibleItems.length }} 条{{ hasReportRefs ? '参考文献' : '证据' }})
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ── 全局 Toast ── -->
    <transition name="toast-fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>

    <!-- ── 导出预览弹窗 ── -->
    <ExportPreviewModal
      :visible="previewVisible"
      :html="fullReportHtml"
      :markdown="fullReportMarkdown"
      @close="previewVisible = false"
    />

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDiagnosisStore } from '../stores/diagnosis.js'
import { useRouter }          from 'vue-router'

import { renderMd }           from '../utils/markdown.js'
import {
  buildEvidenceHtml,
  buildFullReportHtml,
  buildWordHtml,
  copyRichText,
  exportToPdf,
  exportToWord,
}                             from '../utils/reportExport.js'
import ExportPreviewModal     from '../components/ExportPreviewModal.vue'

import {
  apiEbmSubmit,
  apiEbmJobStatus,
  apiEbmJobResult,
  apiEbmCancel,
}                             from '../api/index.js'
import { caseStorage }        from '../api/caseStorage.js'
import {
  splitEbmReport,
  normalizeForDedup,
  trigramSimilarity,
  splitRefEntries,
  renderEbmRefs,
  parseEbmRefEntries,
  buildEbmRefsOffsetHtml,
  parseMdtReferences,
  extractRefPmidsFromReport,
  normForCite,
}                             from '../utils/evidenceParser.js'

const store  = useDiagnosisStore()
const router = useRouter()

onMounted(() => {
  // 如果当前活跃病例有正在运行的 EBM 深搜，恢复前台轮询追踪
  if (store.activeCaseId && store.ebmOwnerIds.has(store.activeCaseId) && store.ebmLoading) {
    const info = ebmPollMap.get(store.activeCaseId)
    // 如果 pollMap 中没有（比如页面刷新后状态丢失但 ebmOwnerIds 还在），
    // 从 store slot 重建 entry 并重启轮询
    if (!info && store.ebmJobId) {
      ebmPollMap.set(store.activeCaseId, { timeoutId: null, attempts: 0, jobId: store.ebmJobId, lastStage: '' })
      const entry = ebmPollMap.get(store.activeCaseId)
      entry.timeoutId = setTimeout(() => pollEbmJob(store.ebmJobId, store.activeCaseId), EBM_POLL_INTERVAL)
    }
  }
})

onUnmounted(() => {
  // 只杀组件级 liveTimer，ebmPollMap 是模块级的，跨导航存活
  stopLiveTimer()
  // 防止 toast 定时器在组件销毁后触发
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
})

// 当病例被删除时，store.deleteCase 会清理 ebmOwnerIds，此处同步清理残留的 poll 定时器
watch(() => store.ebmOwnerIds.size, () => {
  for (const [caseId, info] of ebmPollMap) {
    if (!store.ebmOwnerIds.has(caseId)) {
      if (info.timeoutId) clearTimeout(info.timeoutId)
      ebmPollMap.delete(caseId)
    }
  }
})

// ── 本地状态 ────────────────────────────────────────────────────────────────
const activeFilter    = ref('all')
const sourceFilter    = ref('')
const levelFilter     = ref('')
const searchQuery     = ref('')
const toast           = ref('')
const collapsedItems  = ref(new Set())
const previewVisible  = ref(false)
const copyLoading     = ref(false)

// ── EBM 深搜状态 ────────────────────────────────────────────────────────────
const ebmCollapsed    = ref(false)
/** Module-level EBM poll map — survives component mount/unmount cycles.
 *  This prevents orphaned timers when navigating away and back. */
const ebmPollMap = new Map()  // Map<caseId, { timeoutId, attempts, jobId, lastStage }>
const EBM_POLL_INTERVAL = 3000
const EBM_POLL_TIMEOUT  = 1200

// ── Stage timeline tracking ─────────────────────────────────────────────────
const STAGE_LABELS = {
  parsing:    { label: '结构化提取', icon: '📋' },
  searching:  { label: 'PubMed 深搜', icon: '🔍' },
  generating: { label: '报告生成',   icon: '📝' },
}

const stageHistory   = ref([])       // [{stage, label, message, elapsed, iteration}]
const lastSeenStage  = ref('')
const currentStageKey = ref('')
const stageStartTs   = ref(0)       // Date.now() when current stage began
const liveElapsed    = ref(0)       // real-time seconds for current stage
const stageMessage   = ref('')
const stageIteration = ref(0)
let   liveTimer      = null

// ── 切换病例时重置本地 UI 状态 ──────────────────────────────
watch(() => store.activeCaseId, () => {
  activeFilter.value    = 'all'
  sourceFilter.value    = ''
  levelFilter.value     = ''
  searchQuery.value     = ''
  collapsedItems.value  = new Set()
  previewVisible.value  = false
  copyLoading.value     = false
  evidenceOpen.value    = true
  citedOnly.value       = true
  mdtReferences.value   = []

  // EBM：不杀后台轮询，只重置前台 UI。如果切回的是 EBM 所属病例则恢复追踪
  const isEbmOwner = store.activeCaseId && store.ebmOwnerIds.has(store.activeCaseId)
  if (isEbmOwner && store.ebmLoading) {
    // 切回正在深搜的病例：从槽位恢复 stage 时间线（不清空已完成的步骤）
    ebmCollapsed.value = false
    stageHistory.value = [...(store.ebmStageHistory || [])]
    lastSeenStage.value = ''
    currentStageKey.value = ''
    stageMessage.value = ''
    stageIteration.value = 0
    stageStartTs.value = 0
    liveElapsed.value = 0
    // 如果当前有 progress，从当前 stage 开始激活实时计时
    if (store.ebmProgress?.stage && STAGE_LABELS[store.ebmProgress.stage]) {
      currentStageKey.value = store.ebmProgress.stage
      stageMessage.value = store.ebmProgress.message || ''
      stageIteration.value = store.ebmProgress.iteration || 0
      stageStartTs.value = Date.now() - (store.ebmProgress.elapsed_seconds || 0) * 1000
      startLiveTimer()
    }
  } else if (!isEbmOwner) {
    // 切到的不是 EBM 所属病例：重置本地追踪状态
    stageHistory.value    = []
    lastSeenStage.value   = ''
    currentStageKey.value = ''
    stageStartTs.value    = 0
    liveElapsed.value     = 0
    stageMessage.value    = ''
    stageIteration.value  = 0
    stopLiveTimer()
  }
})

function startLiveTimer() {
  if (liveTimer) return
  liveTimer = setInterval(() => {
    if (stageStartTs.value) {
      liveElapsed.value = Math.floor((Date.now() - stageStartTs.value) / 1000)
    }
  }, 1000)
}

function stopLiveTimer() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null }
}

/** Commit the current stage to history and start tracking a new one */
function advanceStage(key) {
  // Push previous stage to history
  if (currentStageKey.value && STAGE_LABELS[currentStageKey.value]) {
    stageHistory.value.push({
      stage: currentStageKey.value,
      label: STAGE_LABELS[currentStageKey.value].label,
      message: stageMessage.value,
      elapsed: liveElapsed.value,
      iteration: stageIteration.value,
    })
  }
  // 同步到 store，确保切换病例后能恢复时间线
  store.ebmStageHistory = [...stageHistory.value]
  // Start new stage
  currentStageKey.value = key
  stageMessage.value = ''
  stageIteration.value = 0
  stageStartTs.value = Date.now()
  liveElapsed.value = 0
  startLiveTimer()
}

// ── 证据面板折叠 ──────────────────────────────────────────────────────────
const evidenceOpen    = ref(true)  // default expanded; user can collapse if needed

let toastTimer = null

function formatElapsed(seconds) {
  if (!seconds && seconds !== 0) return ''
  const s = Number(seconds)
  if (s < 60) return `${s.toFixed(0)}s`
  const m = Math.floor(s / 60)
  const rs = Math.floor(s % 60)
  return `${m}m ${rs}s`
}

function showToast(msg) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

function toggleEvidence() {
  evidenceOpen.value = !evidenceOpen.value
}

/** Toggle highlight on an evidence item (works with all data sources). */
function toggleHighlight(id) {
  if (hasReportRefs.value) {
    const source = structuredBib.value.length > 0 ? structuredBib.value : mdtReferences.value
    const item = source.find(e => e.id === id)
    if (item) item.highlighted = !item.highlighted
  } else {
    store.toggleHighlight(id)
  }
}

/** Toggle hide on an evidence item (works with all data sources). */
function toggleHide(id) {
  if (hasReportRefs.value) {
    const source = structuredBib.value.length > 0 ? structuredBib.value : mdtReferences.value
    const item = source.find(e => e.id === id)
    if (item) item.hidden = !item.hidden
  } else {
    store.toggleHide(id)
  }
}

/** Restore all hidden evidence items. */
function restoreAllHidden() {
  if (hasReportRefs.value) {
    if (structuredBib.value.length > 0) {
      structuredBib.value.forEach(e => { e.hidden = false })
    } else {
      mdtReferences.value.forEach(e => { e.hidden = false })
    }
  } else {
    store.restoreAllHidden()
  }
}

function toggleCollapse(id) {
  const s = new Set(collapsedItems.value)
  s.has(id) ? s.delete(id) : s.add(id)
  collapsedItems.value = s
}
function isCollapsed(id) { return collapsedItems.value.has(id) }

function getPmid(link) {
  if (!link) return ''
  const m = link.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)
  return m ? m[1] : ''
}
function getItemTitle(item) {
  let title = (item.title || '').trim()
  if (!title || title === '（无标题）') {
    if (item.content) {
      const text = item.content.replace(/\\n/g, '\n')
      const firstLine = text.split('\n')
        .map(l => l.replace(/^[>#\s*-]+/, '').trim())
        .find(l => l.length > 4)
      if (firstLine) title = firstLine.slice(0, 120) + (firstLine.length > 120 ? '…' : '')
    }
    if (!title) title = `证据 ${item.id + 1}`
  }
  return title
}

// ── 基础数据 ───────────────────────────────────────────────────────────────
const hasEvidence     = computed(() => primaryEvidenceList.value.length > 0)
const bib             = computed(() => store.analysisResult?.bibliography ?? [])

// ── MDT 报告清洗与展示 ──────────────────────────────────────────────────────

/** Strip structured header prefix from evidence content, return the raw payload. */
function _evidencePayload(content) {
  if (!content) return ''
  return content.replace(/^【权威循证溯源：[^】]+】\s*/g, '').trim()
}

/**
 * 局部引用匹配归一化 — 去除所有标点，产生连续字符串用于子串匹配。
 * 与 evidenceParser 的 normForCite（空格分隔）用途不同，不共用。
 */
function _normForCiteLocal(s) {
  return s.replace(/\s+/g, ' ').replace(/[，,。.、;；:：""''""（）\(\)\[\]【】]/g, '').trim().toLowerCase()
}

/**
 * 检查证据条目是否在 MDT 报告中已引用。
 * 用 40 字符滑窗（步长 20）在归一化文本中探测出现。
 */
function _isItemCited(item, normReport) {
  const payload = _evidencePayload(item.content || item.title || '')
  if (!payload || payload.length < 15) return false
  const normPayload = _normForCiteLocal(payload)
  if (normReport.includes(normPayload.substring(0, Math.min(normPayload.length, 60)))) return true
  const winLen = 40
  if (normPayload.length <= winLen) return normReport.includes(normPayload)
  for (let i = 0; i <= normPayload.length - winLen; i += 20) {
    if (normReport.includes(normPayload.substring(i, i + winLen))) return true
  }
  return false
}

/**
 * 清洗 MDT 报告文本以用于前端展示：
 * 1. 移除 DeepSeek <think>…</think> 推理链
 * 2. 移除 LLM 对话式前言（"好的，作为…专家…"）
 * 3. 移除残留的 "---" 分隔线
 */
function cleanMdtReport(text) {
  if (!text) return ''
  let cleaned = text
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const sepRe = /^([\s\S]*?)^---[ \t]*$/m
  const sepMatch = sepRe.exec(cleaned)
  if (sepMatch && sepMatch[1].length < 600 && cleaned.length - sepMatch[0].length > 60) {
    cleaned = cleaned.slice(sepMatch.index + sepMatch[0].length)
  } else {
    const headerRe = /^[\s\S]*?^(?=#{1,3}\s+[一二三四五六七八九十\d]+[、.．])/m
    const headerMatch = headerRe.exec(cleaned)
    if (headerMatch && headerMatch[0].length < 600 && cleaned.length - headerMatch[0].length > 60) {
      cleaned = cleaned.slice(headerMatch.index + headerMatch[0].length)
    }
  }
  cleaned = cleaned.replace(/^\s*---[ \t]*\n+/, '')
  cleaned = cleaned.replace(/^\s+/, '')
  return cleaned
}

const treatmentReport    = computed(() => cleanMdtReport(store.mdtStreamText || ''))
const treatmentReportRaw = computed(() => store.mdtStreamText || '')

// ── 已引用证据筛选 ──────────────────────────────────────────────────────────
const citedOnly = ref(true)

const citedEvidenceIds = computed(() => {
  const report = store.mdtStreamText || ''
  if (!report) return new Set()
  const normReport = _normForCiteLocal(report)
  const ids = new Set()
  for (const item of store.evidenceList) {
    if (_isItemCited(item, normReport)) ids.add(item.id)
  }
  return ids
})

const citedEvidenceCount   = computed(() => citedEvidenceIds.value.size)
const uncitedEvidenceCount = computed(() => store.evidenceList.length - citedEvidenceCount.value)

// ── 参考文献解析（MDT 方案报告） ──────────────────────────────────────────────

/** 结构化文献目录——来自 analysisResult.bibliography，优先级最高 */
const structuredBib = computed(() => {
  const bib = store.analysisResult?.bibliography
  if (!bib || !bib.length) return []
  return bib.map((e, i) => ({
    id: i,
    title: e.title || '',
    content: e.title || '',
    source: e.guidelines || '参考文献',
    link: e.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${e.pmid}/` : '',
    highlighted: false,
    hidden: false,
    _fromReport: true,
  }))
})

/** 从 MDT 报告直接解析的参考文献（structuredBib 为空时回退） */
const mdtReferences = ref([])

watch(
  () => store.mdtStreamText || store.ebmReport || '',
  (reportText) => {
    if (structuredBib.value.length > 0) {
      mdtReferences.value = []
      return
    }
    mdtReferences.value = parseMdtReferences(reportText)
  },
  { immediate: true }
)

/** 从 MDT 报告参考文献区段提取的所有 PMID */
const mdtRefPmids = computed(() => {
  const report = store.mdtStreamText || store.ebmReport || ''
  return extractRefPmidsFromReport(report)
})

// ── 导出报告共享：KG 参考文献条数（统一编号偏移基准） ──────────────────────

/** 导出的 KG 参考文献数量（非隐藏条目；当无结构化文献时应用 citedOnly） */
const ebmKgRefCount = computed(() => {
  let items = primaryEvidenceList.value.filter(e => !e.hidden)
  if (citedOnly.value && !hasReportRefs.value) items = items.filter(e => citedEvidenceIds.value.has(e.id))
  return items.length
})

/**
 * 将 EBM 正文中的引用编号 [N] 统一偏移为 [kgCount+N]。
 * 从高到低替换，避免 [1]→[7] 后被后续替换再次命中。
 */
function renumberEbmCitations(bodyText, ebmRefCount, kgCount) {
  if (!bodyText || !ebmRefCount || !kgCount) return bodyText
  let result = bodyText
  for (let i = ebmRefCount; i >= 1; i--) {
    result = result.replace(new RegExp(`\\[${i}\\]`, 'g'), `[${kgCount + i}]`)
  }
  return result
}

// ── EBM 报告内联渲染（hero card） ────────────────────────────────────────────

/** 在 hero card 中渲染 EBM 深搜报告：正文引用编号偏移 + 参考文献连续编号 */
const ebmReportHtml = computed(() => {
  if (!store.ebmReport) return ''
  const { body, refsText } = splitEbmReport(store.ebmReport)
  const ebmRefEntries = parseEbmRefEntries(refsText)
  const ebmRefCount = ebmRefEntries.length
  const kgCount = ebmKgRefCount.value

  let html = ''
  // 正文：引用编号偏移
  if (body) {
    const renumberedBody = (kgCount > 0 && ebmRefCount > 0)
      ? renumberEbmCitations(body, ebmRefCount, kgCount)
      : body
    html += renderMd(renumberedBody)
  }
  // 参考文献：偏移编号
  if (ebmRefEntries.length > 0) {
    html += buildEbmRefsOffsetHtml(ebmRefEntries, kgCount)
  } else if (refsText) {
    html += renderEbmRefs(refsText)
  }
  return html
})

/** Submit EBM deep-search job */
async function startEbmSearch() {
  const mdtText = treatmentReportRaw.value  // use unfiltered raw text
  if (!mdtText || mdtText.length < 50) {
    showToast('MDT 报告内容不足，无法启动深搜')
    return
  }

  store.resetEbm()
  store.ebmStageHistory = []
  ebmCollapsed.value = false
  // Reset stage timeline
  stageHistory.value = []
  lastSeenStage.value = ''
  currentStageKey.value = ''
  stageMessage.value = ''
  stageIteration.value = 0
  stageStartTs.value = 0
  liveElapsed.value = 0
  stopLiveTimer()

  // 设定 EBM 归属，以便切换病例后后台写入正确槽位
  const owningCaseId = store.activeCaseId
  store.ebmOwnerIds.add(owningCaseId)
  // 创建该病例的独立轮询追踪项
  ebmPollMap.set(owningCaseId, { timeoutId: null, attempts: 0, jobId: '', lastStage: '' })

  try {
    const res = await apiEbmSubmit(mdtText, 'auto', 2)
    store.setEbmJob({ jobId: res.job_id, status: res.status || 'pending' })
    // 更新 jobId
    const info = ebmPollMap.get(owningCaseId)
    if (info) info.jobId = res.job_id
    showToast('✅ 深搜任务已提交，正在检索中…')

    const timeoutId = setTimeout(() => pollEbmJob(res.job_id, owningCaseId), EBM_POLL_INTERVAL)
    const updated = ebmPollMap.get(owningCaseId)
    if (updated) updated.timeoutId = timeoutId
  } catch (e) {
    store.ebmOwnerIds.delete(owningCaseId)
    ebmPollMap.delete(owningCaseId)
    store.setEbmError(e.message || '提交任务失败')
    showToast('❌ 深搜任务提交失败：' + e.message)
  }
}

/** Cancel a running EBM deep-search job */
async function cancelEbmSearch() {
  const caseId = store.activeCaseId
  const jobId = store.ebmJobId
  if (!jobId) return

  // Stop polling for this specific case
  const info = ebmPollMap.get(caseId)
  if (info?.timeoutId) {
    clearTimeout(info.timeoutId)
  }
  ebmPollMap.delete(caseId)
  store.ebmOwnerIds.delete(caseId)
  stopLiveTimer()

  try {
    await apiEbmCancel(jobId)
    showToast('⏹️ 深搜任务已中止')
  } catch (e) {
    // Even if the backend cancel fails (e.g., job already completed),
    // stop the local polling state
    console.warn('[EBM] 取消请求失败（可能任务已结束）:', e.message)
  }

  store.setEbmError('任务已由用户中止')
}

/** Poll job status */
async function pollEbmJob(jobId, owningCaseId) {
  // 从 per-case Map 读取轮询状态
  const info = ebmPollMap.get(owningCaseId)
  if (!info) return  // 任务已被取消（不属于任何活跃轮询）

  const inBackground = owningCaseId !== store.activeCaseId

  // ── 独立超时检查（per-case，不受其他病例干扰） ──
  if (info.attempts * EBM_POLL_INTERVAL >= EBM_POLL_TIMEOUT * 1000) {
    if (inBackground) {
      await store._saveEbmToSlot(owningCaseId, { ebmLoading: false, ebmStatus: 'failed', ebmError: '任务超时（超过 20 分钟）' })
    } else {
      store.setEbmError('任务超时（超过 20 分钟）')
    }
    ebmPollMap.delete(owningCaseId)
    store.ebmOwnerIds.delete(owningCaseId)
    showToast('⚠️ 深搜任务超时，请重试')
    return
  }

  info.attempts++

  try {
    const status = await apiEbmJobStatus(jobId)
    const progress = {
      stage: status.progress?.stage || '检索中',
      iteration: status.progress?.iteration || 0,
      message: status.progress?.message || '',
      elapsed_seconds: status.progress?.elapsed_seconds || 0,
      status: status.status,
    }

    if (inBackground) {
      // 后台模式：写入槽位，不动当前前台 reactive 状态
      // 检测后台 stage 变更，追加到槽位的 stageHistory
      let bgHistory = null
      const stage = status.progress?.stage
      if (stage && STAGE_LABELS[stage] && stage !== info.lastStage) {
        if (info.lastStage && STAGE_LABELS[info.lastStage]) {
          try {
            const full = await caseStorage.getCase(owningCaseId)
            if (full?.data?.ebmStageHistory) {
              bgHistory = [...full.data.ebmStageHistory]
              bgHistory.push({
                stage: info.lastStage,
                label: STAGE_LABELS[info.lastStage].label,
                message: '',
                elapsed: 0,
                iteration: 0,
              })
            }
          } catch {}
        }
        info.lastStage = stage
      }
      await store._saveEbmToSlot(owningCaseId, {
        ebmProgress: progress,
        ebmLoading: true,
        ebmStatus: status.status,
        ...(bgHistory ? { ebmStageHistory: bgHistory } : {}),
      })
    } else {
      // 前台模式：正常写 store
      store.setEbmProgress(progress)
      // ── Stage timeline tracking ──
      const stage = status.progress?.stage
      if (stage && STAGE_LABELS[stage]) {
        if (stage !== currentStageKey.value) {
          advanceStage(stage)
        }
        stageMessage.value = status.progress?.message || ''
        stageIteration.value = status.progress?.iteration || 0
      }
    }

    if (status.status === 'completed') {
      const result = await apiEbmJobResult(jobId)
      if (inBackground) {
        // 补上最后一步 (generating) 到时间线
        let finalHistory = null
        try {
          const full = await caseStorage.getCase(owningCaseId)
          if (full?.data?.ebmStageHistory) {
            finalHistory = [...full.data.ebmStageHistory]
            if (info.lastStage && STAGE_LABELS[info.lastStage]) {
              finalHistory.push({
                stage: info.lastStage,
                label: STAGE_LABELS[info.lastStage].label,
                message: '',
                elapsed: 0,
                iteration: 0,
              })
            }
            finalHistory.push({
              stage: 'generating',
              label: STAGE_LABELS.generating.label,
              message: '',
              elapsed: 0,
              iteration: 0,
            })
          }
        } catch {}
        await store._saveEbmToSlot(owningCaseId, {
          ebmReport: result.final_report || '',
          ebmLoading: false,
          ebmStatus: 'completed',
          ...(finalHistory ? { ebmStageHistory: finalHistory } : {}),
        })
        await store._finishBackgroundStream(owningCaseId)
      } else {
        advanceStage('generating')
        stopLiveTimer()
        store.setEbmReport(result.final_report || '')
        await store.persist()
      }
      ebmPollMap.delete(owningCaseId)
      store.ebmOwnerIds.delete(owningCaseId)
      showToast('✅ 循证深搜完成！')
      return
    }

    if (status.status === 'failed') {
      if (inBackground) {
        await store._saveEbmToSlot(owningCaseId, { ebmLoading: false, ebmStatus: 'failed', ebmError: status.error || '未知错误' })
      } else {
        store.setEbmError(status.error || '未知错误')
      }
      ebmPollMap.delete(owningCaseId)
      store.ebmOwnerIds.delete(owningCaseId)
      showToast('❌ 深搜任务失败')
      return
    }

    if (status.status === 'cancelled') {
      if (inBackground) {
        await store._saveEbmToSlot(owningCaseId, { ebmLoading: false, ebmStatus: 'cancelled', ebmError: '任务已取消' })
      } else {
        store.setEbmError('任务已取消')
      }
      ebmPollMap.delete(owningCaseId)
      store.ebmOwnerIds.delete(owningCaseId)
      return
    }

    // 继续轮询
    info.timeoutId = setTimeout(() => pollEbmJob(jobId, owningCaseId), EBM_POLL_INTERVAL)
  } catch (e) {
    if (inBackground) {
      await store._saveEbmToSlot(owningCaseId, { ebmLoading: false, ebmStatus: 'failed', ebmError: e.message || '轮询失败' })
    } else {
      store.setEbmError(e.message || '轮询失败')
    }
    ebmPollMap.delete(owningCaseId)
    store.ebmOwnerIds.delete(owningCaseId)
    showToast('⚠️ 轮询状态失败：' + e.message)
  }
}

function toggleEbmCollapse() {
  ebmCollapsed.value = !ebmCollapsed.value
}

// ── FIGO 分期 ──────────────────────────────────────────────────────────────
const figoStaging = computed(() => {
  const ci = store.clinicalInfo || {}
  const pr = store.profileResult || {}

  const fromClinical =
    ci.figo_staging || ci.figo_stage || ci.figo ||
    ci.staging || ci.figo_classification || ci.stage || ''

  const fromProfile =
    pr.figo_staging || pr.figo_stage || pr.figo || pr.staging || ''

  if (fromClinical) return String(fromClinical).trim()
  if (fromProfile)  return String(fromProfile).trim()

  const mdt = store.mdtStreamText || ''
  const m = mdt.match(/FIGO\s*(?:分期|期|[：:])?\s*((?:IV|III|II|I)[ABC]?)/i)
  return m ? `${m[1].trim()}` : ''
})

// ── ESGO chip ──────────────────────────────────────────────────────────────
const esgoChipClass = computed(() => {
  const v = store.clinicalInfo.esgo_risk_classification || ''
  if (v.includes('高危') || v.includes('High'))   return 'chip-rose'
  if (v.includes('中高危'))                        return 'chip-amber'
  if (v.includes('中危') || v.includes('Inter'))   return 'chip-amber'
  if (v.includes('低危') || v.includes('Low'))     return 'chip-green'
  return 'chip-slate'
})

/**
 * Primary evidence list — tiered data source priority:
 *   1. Structured bibliography (analysisResult.bibliography) — authoritative
 *   2. Text-parsed MDT references (regex fallback)
 *   3. PMID-filtered API evidence list
 *   4. Full API evidence list
 */
const primaryEvidenceList = computed(() => {
  // Tier 1: structured bibliography from analysis result (6 refs)
  if (structuredBib.value.length > 0) return structuredBib.value
  // Tier 2: regex-parsed from report text
  if (mdtReferences.value.length > 0) return mdtReferences.value
  // Tier 3: filter API evidence list to only those whose PMID appears in report
  if (mdtRefPmids.value.size > 0) {
    return store.evidenceList.filter(e => {
      const link = e.link || ''
      const pmidMatch = link.match(/pubmed.*?(\d{7,9})/)
      return pmidMatch && mdtRefPmids.value.has(pmidMatch[1])
    })
  }
  // Tier 4: full API evidence list
  return store.evidenceList
})

// ── 筛选 ───────────────────────────────────────────────────────────────────
const visibleBase = computed(() => {
  let list = primaryEvidenceList.value.filter(e => !e.hidden)
  if (citedOnly.value && !hasReportRefs.value) {
    list = list.filter(e => citedEvidenceIds.value.has(e.id))
  }
  return list
})

const filterOptions = computed(() => [
  { key: 'all',     label: '全部',   count: visibleBase.value.length },
  { key: 'starred', label: '★ 标星', count: primaryEvidenceList.value.filter(e => e.highlighted).length },
  { key: 'rct',     label: 'RCT',    count: primaryEvidenceList.value.filter(e => isRCT(e)).length },
])

const sourceOptions = computed(() => {
  const s = new Set(primaryEvidenceList.value.map(e => e.source).filter(Boolean))
  return [...s]
})
const levelOptions = computed(() => {
  const s = new Set(primaryEvidenceList.value.map(e => e.evidence_level).filter(Boolean))
  return [...s]
})

const visibleItems = computed(() => {
  let list = primaryEvidenceList.value.filter(e => !e.hidden)
  if (activeFilter.value === 'starred') list = list.filter(e => e.highlighted)
  if (activeFilter.value === 'rct')     list = list.filter(e => isRCT(e))
  if (sourceFilter.value)               list = list.filter(e => e.source === sourceFilter.value)
  if (levelFilter.value)                list = list.filter(e => e.evidence_level === levelFilter.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.content || '').toLowerCase().includes(q) ||
      (e.source || '').toLowerCase().includes(q)
    )
  }
  return list
})

const highlightedCount = computed(() => primaryEvidenceList.value.filter(e => e.highlighted).length)
const hiddenCount      = computed(() => primaryEvidenceList.value.filter(e => e.hidden).length)

/** Whether we're showing report-derived references (not raw API evidence list). */
const hasReportRefs = computed(() => structuredBib.value.length > 0 || mdtReferences.value.length > 0)
const reportRefCount = computed(() => structuredBib.value.length || mdtReferences.value.length)

// ── 合并报告构建（导出用） ──────────────────────────────────────────────────
const fullReportMarkdown = computed(() => {
  const lines = []
  const ts   = new Date().toLocaleString('zh-CN')
  const esgo = store.clinicalInfo.esgo_risk_classification || ''
  const figo = figoStaging.value
  const metaParts = [`生成时间：${ts}`]
  if (esgo) metaParts.push(`ESGO 风险分级：**${esgo}**`)
  if (figo) metaParts.push(`FIGO 分期：**${figo}**`)
  lines.push(`> ${metaParts.join('\u3000·\u3000')}\n`)

  // ── 循证医学深搜校验结果（仅正文，参考文献延后统一编号） ──
  let ebmRefEntries = []
  if (store.ebmReport) {
    const { body, refsText } = splitEbmReport(store.ebmReport)
    ebmRefEntries = parseEbmRefEntries(refsText)
    const kgCount = ebmKgRefCount.value
    const ebmRefCount = ebmRefEntries.length
    const ebmBodyRenumbered = (kgCount > 0 && ebmRefCount > 0)
      ? renumberEbmCitations(body, ebmRefCount, kgCount)
      : body
    lines.push(ebmBodyRenumbered)
    lines.push('\n---\n')
  }

  // ── 循证证据与参考文献（统一连续编号） ──
  let evItems = primaryEvidenceList.value.filter(e => !e.hidden)
  if (citedOnly.value && !hasReportRefs.value) evItems = evItems.filter(e => citedEvidenceIds.value.has(e.id))
  const kgCount = evItems.length

  // KG 证据条目 [1]..[kgCount]
  if (kgCount > 0) {
    lines.push(`**KG 循证证据**（${kgCount} 条）：\n`)
    evItems.forEach((item, idx) => {
      let title = (item.title || '').trim()
      if (!title || title === '（无标题）') {
        if (item.content) {
          const firstLine = item.content
            .replace(/\\n/g, '\n').split('\n')
            .map(l => l.replace(/^[>#\s*-]+/, '').trim())
            .find(l => l.length > 4)
          if (firstLine) title = firstLine.slice(0, 120) + (firstLine.length > 120 ? '…' : '')
        }
        if (!title) title = `证据 ${idx + 1}`
      }

      const metaParts = [item.source, item.evidence_level, item.year].filter(Boolean)
      const meta = metaParts.length ? metaParts.join(' | ') : ''

      let idLine = ''
      if (item.link) {
        const pmidMatch = item.link.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)
        if (pmidMatch) {
          idLine = `PMID: ${pmidMatch[1]}`
        } else {
          idLine = item.link
        }
      }

      lines.push(`[${idx + 1}] ${title}`)
      if (meta) lines.push(`    ${meta}`)
      if (idLine) lines.push(`    ${idLine}`)
      if (item.highlighted) lines.push('    ★ 已标星')
      lines.push('')
    })
  }

  // 深搜新增参考文献 [kgCount+1]..[kgCount + ebmRefEntries.length]
  if (ebmRefEntries.length > 0) {
    lines.push(`**深搜新增参考文献**（${ebmRefEntries.length} 条）：\n`)
    ebmRefEntries.forEach((ref, i) => {
      const newIdx = kgCount + i + 1
      lines.push(`[${newIdx}] ${ref.content}`)
      lines.push('')
    })
  }

  if (kgCount === 0 && ebmRefEntries.length === 0) {
    lines.push('> 暂无证据数据\n')
  }

  lines.push('\n---\n')
  lines.push('> **免责声明**：本报告由 AI 辅助生成，仅供临床参考，不构成最终诊疗决策依据。所有治疗方案须由具有资质的临床医师结合患者实际情况综合判断后执行。')

  return lines.join('\n')
})

const fullReportHtml = computed(() => {
  // ── 一、循证医学深搜校验结果（仅正文） ──
  let ebmBodyHtml = ''
  let ebmRefEntriesHtml = []
  if (store.ebmReport) {
    const { body, refsText } = splitEbmReport(store.ebmReport)
    ebmRefEntriesHtml = parseEbmRefEntries(refsText)
    if (body) {
      const kgCount = ebmKgRefCount.value
      const ebmRefCount = ebmRefEntriesHtml.length
      const renumberedBody = (kgCount > 0 && ebmRefCount > 0)
        ? renumberEbmCitations(body, ebmRefCount, kgCount)
        : body
      ebmBodyHtml = renderMd(renumberedBody)
    }
  }

  // ── 二、循证证据与参考文献（统一连续编号） ──
  let evListForExport = primaryEvidenceList.value.filter(e => !e.hidden)
  if (citedOnly.value && !hasReportRefs.value) evListForExport = evListForExport.filter(e => citedEvidenceIds.value.has(e.id))
  const kgCount = evListForExport.length

  // KG 证据 HTML（[1]..[kgCount]）
  let evidenceHtml = buildEvidenceHtml(evListForExport, bib.value)

  // EBM 深搜新增参考文献 HTML（[kgCount+1]..[kgCount+M]）
  if (ebmRefEntriesHtml.length > 0) {
    evidenceHtml += buildEbmRefsOffsetHtml(ebmRefEntriesHtml, kgCount)
  }

  return buildFullReportHtml({
    mdtHtml:      '',          // 不再展示 MDT 方案
    ebmBodyHtml,               // 新增：循证深搜正文
    evidenceHtml,
    esgo:         store.clinicalInfo.esgo_risk_classification || '',
    figo:         figoStaging.value,
    patientInfo:  store.profileResult?.patient_profile_md     || '',
    requestId:    store.analysisResult?.request_id            || '',
  })
})

// ── 导出操作 ──────────────────────────────────────────────────────────────
function openExportPreview() {
  if (!hasEvidence.value) { showToast('没有可导出的证据数据'); return }
  previewVisible.value = true
}

async function quickExport(type) {
  if (!hasEvidence.value) { showToast('没有可导出的证据数据'); return }
  const html = fullReportHtml.value

  if (type === 'copy') {
    copyLoading.value = true
    try {
      await copyRichText(html)
      showToast('✅ 已复制富文本，粘贴到 Word / 飞书即可保留样式')
    } catch (e) {
      console.error('[EvidenceView] copyRichText 失败:', e)
      showToast('⚠️ 复制失败，请检查浏览器权限')
    } finally {
      copyLoading.value = false
    }
  } else if (type === 'pdf') {
    exportToPdf(html)
    showToast('📄 已打开打印窗口，请选择"另存为 PDF"')
  } else if (type === 'word') {
    const wordHtml = buildWordHtml(fullReportMarkdown.value, { renderMd })
    exportToWord(wordHtml)
    showToast('📝 Word 文件已开始下载')
  }
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────
function isRCT(item) {
  const text = ((item.evidence_level || '') + ' ' + (item.content || '')).toUpperCase()
  return text.includes('RCT') || text.includes('RANDOMIZED') || text.includes('随机')
}

function sourceBadgeClass(source) {
  const s = (source || '').toUpperCase()
  if (s.includes('ESGO')) return 'badge-blue'
  if (s.includes('NCCN')) return 'badge-teal'
  if (s.includes('FIGO')) return 'badge-purple'
  return 'badge-slate'
}

/** Map source text to tag colour class (bib-entry style). */
function sourceTagClass(_source) {
  return 'tag-teal'
}

function levelBadgeClass(level) {
  const l = (level || '').toUpperCase()
  if (l.includes('A') || l === '1') return 'badge-green'
  if (l.includes('B') || l === '2') return 'badge-blue'
  if (l.includes('C') || l === '3') return 'badge-amber'
  return 'badge-slate'
}

const parsedContentCache = computed(() => {
  const map = {}
  for (const item of primaryEvidenceList.value) {
    map[item.id] = { header: parsedHeader(item.content), paths: parsedPaths(item.content) }
  }
  return map
})

function getItemPaths(item)  { return parsedContentCache.value[item.id]?.paths  ?? [] }
function getItemHeader(item) { return parsedContentCache.value[item.id]?.header ?? '' }

function parsedHeader(content) {
  if (!content) return ''
  const m = content.match(/【权威循证溯源：[^】]+】\s*[（(]([^）)]+)[）)]/)
  if (!m) return ''
  const extra = m[1]
  const parts = []
  const tierMatch = extra.match(/逻辑层级[：:]\s*([^,，）)]+)/)
  const recMatch  = extra.match(/推荐度[：:]\s*([\d.]+)/)
  if (tierMatch) parts.push(`逻辑层级 ${tierMatch[1].trim()}`)
  if (recMatch)  parts.push(`推荐度 ${recMatch[1]}`)
  return parts.length ? parts.join(' · ') : extra.trim()
}

function parsedPaths(content) {
  if (!content) return []
  const paths = []
  const pathRegex = />\s*候选路径\s*(\d+)\s*\[([^\]]+)\]\s*[（(]神经推演推荐度[：:]\s*([\d.]+%)[）)]([\s\S]*?)(?=>\s*候选路径|$)/g
  let m
  while ((m = pathRegex.exec(content)) !== null) {
    const block = m[4]
    const contentMatch = block.match(/方案内容[：:]\s*["""「]([^"""」\n]+)["""」]/)
    const triggerMatch = block.match(/触发该方案的局部特征[：:]\s*【([^】]+)】/)
    paths.push({
      rank: m[1], type: m[2], pct: m[3],
      content: contentMatch ? contentMatch[1].trim() : block.replace(/[├└─]/g, '').replace(/\s+/g,' ').trim(),
      trigger: triggerMatch ? triggerMatch[1].trim() : '',
    })
  }
  return paths
}

function formatSourceId(sid) {
  if (!sid) return sid
  const m = sid.match(/^([^:]+)::(.+)$/)
  if (m) return `${m[1]} · ${m[2]}`
  return sid
}

function highlightText(text) {
  if (!searchQuery.value.trim() || !text) return escapeHtml(text || '')
  const q = searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return escapeHtml(text).replace(
    new RegExp(q, 'gi'),
    m => `<mark style="background:var(--accent-amber-mid);border-radius:2px;padding:0 2px">${m}</mark>`
  )
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function resetFilters() {
  activeFilter.value = 'all'
  sourceFilter.value = ''
  levelFilter.value  = ''
  searchQuery.value  = ''
}

function legacyExport(format) {
  const items = visibleItems.value
  if (!items.length) { showToast('没有可导出的证据'); return }
  const ts = new Date().toLocaleDateString('zh-CN')
  if (format === 'json') {
    const content = JSON.stringify({
      generated_at: ts,
      patient_esgo: store.profileResult?.esgo_risk_classification,
      request_id:   store.analysisResult?.request_id,
      evidence_count: items.length,
      evidence: items.map(({ id: _id, highlighted, hidden, ...rest }) => ({ ...rest, starred: highlighted })),
    }, null, 2)
    download(content, `evidence_data_${Date.now()}.json`, 'application/json')
  }
  showToast(`已导出 ${items.length} 条证据`)
}

function download(content, filename, mime) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function getPercentColor(pctStr) {
  if (!pctStr) return 'inherit'
  const num = parseFloat(pctStr)
  if (isNaN(num)) return 'inherit'
  const hue = (Math.min(100, Math.max(0, num)) / 100) * 120
  return `hsl(${hue}, 80%, 45%)`
}

function formatFinalScore(score) {
  if (score == null) return ''
  return (score * 100).toFixed(4)
}
</script>

<style scoped>
/* ── 页面布局 ── */
.evidence-page { min-height: 100vh; padding: 24px 24px 48px; }
.page-wrap { max-width: 1480px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }

/* Header */
.pg-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.pg-step { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--accent-teal); margin-bottom: 3px; }
.pg-title { font-size: 24px; font-family: var(--font-serif); }
.pg-sub { font-size: 13px; color: var(--text-secondary); margin-top: 3px; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-top: 4px; }

/* 3-column grid */
.main-grid { display: grid; grid-template-columns: 280px 1fr 280px; gap: 16px; align-items: stretch; }
.left-col, .right-col { display: flex; flex-direction: column; gap: 14px; }
.centre-col { display: flex; flex-direction: column; gap: 14px; }

/* Left cards */
.ctx-card { padding: 0; overflow: hidden; }
.ctx-hdr { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 10px; border-bottom: 1px solid var(--border); }
.ctx-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
.ctx-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.figo-chip { padding: 3px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; background: var(--bg-2); color: var(--text-primary); border: 1px solid var(--border-md); }
.esgo-chip { padding: 3px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; border: 1px solid transparent; }
.chip-rose   { background: var(--accent-rose-light);   color: var(--accent-rose);   border-color: var(--accent-rose-mid); }
.chip-amber  { background: var(--accent-amber-light);  color: var(--accent-amber);  border-color: var(--accent-amber-mid); }
.chip-green  { background: var(--accent-green-light);  color: var(--accent-green);  border-color: var(--accent-green-mid); }
.chip-slate  { background: var(--bg-2); color: #475569; border-color: var(--border-md); }
.ctx-profile { padding: 10px 14px 12px; font-size: 12px; color: var(--text-secondary); line-height: 1.65; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
.ctx-empty { padding: 14px; font-size: 12px; color: var(--text-muted); text-align: center; }
.ctx-warn-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: var(--accent-amber-light); color: var(--accent-amber); border: 1px solid var(--accent-amber-mid); }
.ctx-link-btn { background: none; border: none; color: var(--accent-blue); cursor: pointer; font-size: 12px; text-decoration: underline; padding: 0; }

/* ═══════════════════════════════════════════════════════════════════════════
   EBM HERO CARD
   ═══════════════════════════════════════════════════════════════════════════ */
.ebm-hero {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent-teal);
  background: linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%);
}
.ebm-hero-empty {
  border-left-color: var(--border-md);
  background: var(--bg-1);
}

/* Hero header */
.ebm-hero-hdr {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}
.ebm-hero-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--accent-teal);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ebm-hero-title-wrap { flex: 1; min-width: 0; }
.ebm-hero-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.ebm-hero-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.ebm-hero-badges { flex-shrink: 0; }
.ebm-hero-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 100px;
  font-size: 11px; font-weight: 600;
}
.ebm-badge-done { background: var(--accent-green-light); color: var(--accent-green); border: 1px solid var(--accent-green-mid); }
.ebm-badge-running { background: var(--accent-blue-light); color: var(--accent-blue); border: 1px solid var(--accent-blue-mid); animation: ebmPulse 1.5s ease-in-out infinite; }
.ebm-badge-failed { background: var(--accent-rose-light); color: var(--accent-rose); border: 1px solid var(--accent-rose-mid); }
.ebm-badge-idle { background: var(--bg-2); color: var(--text-muted); border: 1px solid var(--border-md); }
@keyframes ebmPulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

/* Idle state */
.ebm-hero-idle {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}
.ebm-hero-desc {
  max-width: 520px;
  font-size: 13px; line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
}
.ebm-hero-error {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--accent-rose);
  background: var(--accent-rose-light);
  padding: 6px 12px; border-radius: 6px;
  border: 1px solid var(--accent-rose-mid);
}
.ebm-hero-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 28px;
  font-size: 15px; font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--accent-teal), #0d9488);
  border: none; border-radius: 10px;
  cursor: pointer;
  transition: all .2s;
  box-shadow: 0 2px 8px rgba(20,184,166,.25);
}
.ebm-hero-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(20,184,166,.35);
}
.ebm-hero-btn:disabled { opacity: .5; cursor: not-allowed; }

/* Progress */
.ebm-hero-progress {
  padding: 20px 20px 16px;
}

/* ── Stage timeline ──────────────────────────────────────────── */
.ebm-stage-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 14px;
}

/* Individual stage row */
.ebm-stage-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
}
.ebm-stage-item + .ebm-stage-item {
  border-top: 1px dashed var(--border);
}

/* Marker (bullet / check / spinner) */
.ebm-stage-marker {
  width: 26px; height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.ebm-stage-item.active .ebm-stage-marker {
  background: var(--accent-teal-light, #ccfbf1);
  color: var(--accent-teal);
}
.ebm-stage-item.done .ebm-stage-marker {
  background: var(--accent-green);
  color: #fff;
}

/* Spinner for active stage */
.ebm-stage-spinner {
  width: 12px; height: 12px;
  border-radius: 50%;
  border: 2px solid var(--accent-teal-mid, #99f6e4);
  border-top-color: var(--accent-teal);
  animation: stageSpin .8s linear infinite;
}
@keyframes stageSpin { to { transform: rotate(360deg); } }

/* Body */
.ebm-stage-body {
  flex: 1;
  min-width: 0;
}
.ebm-stage-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ebm-stage-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.ebm-stage-item.done .ebm-stage-name {
  color: var(--text-secondary);
}
.ebm-stage-time {
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
}
.ebm-stage-time.live {
  color: var(--accent-teal);
}
.ebm-stage-msg {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 1.5;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ebm-stage-meta {
  margin-top: 3px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent-blue);
  background: var(--accent-blue-light);
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
}

/* ── Completed stage summary ─────────────────────────────────── */
.ebm-stage-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.ebm-ss-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
}
.ebm-ss-marker {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--accent-green);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ebm-ss-name {
  font-weight: 500;
  color: var(--text-primary);
}
.ebm-ss-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}
.ebm-ss-arrow {
  color: var(--border-md);
  margin: 0 2px;
}

/* ── Transition: stages expanding in ─────────────────────────── */
.stage-enter-active {
  transition: all .4s ease;
}
.stage-leave-active {
  transition: all .25s ease;
}
.stage-enter-from {
  opacity: 0;
  transform: translateY(-12px);
  max-height: 0;
}
.stage-enter-to {
  opacity: 1;
  transform: translateY(0);
  max-height: 80px;
}
.stage-leave-from {
  opacity: 1;
  max-height: 80px;
}
.stage-leave-to {
  opacity: 0;
  max-height: 0;
}
.stage-move {
  transition: transform .3s ease;
}

/* Indeterminate progress bar */
.ebm-progress-indeterminate {
  width: 100%; height: 4px;
  background: var(--bg-3);
  border-radius: 2px;
  overflow: hidden;
}
.ebm-progress-shimmer {
  width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, var(--accent-teal), transparent);
  border-radius: 2px;
  animation: shimmer 1.8s ease-in-out infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* Cancel button */
.ebm-cancel-wrap {
  display: flex; justify-content: center; padding: 12px 0 4px;
}
.ebm-cancel-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px;
  font-size: 13px; font-weight: 600;
  color: var(--accent-rose, #f43f5e);
  background: #fff;
  border: 1.5px solid rgba(244,63,94,.35);
  border-radius: 8px;
  cursor: pointer;
  transition: all .15s;
}
.ebm-cancel-btn:hover {
  background: var(--accent-rose-light, rgba(244,63,94,.08));
  border-color: var(--accent-rose, #f43f5e);
}

/* Completed result */
.ebm-hero-result {
  border-top: 1px solid var(--border);
}
.ebm-result-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: var(--accent-green-light);
  border-bottom: 1px solid var(--accent-green-mid);
  flex-wrap: wrap;
}
.ebm-result-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 13px; font-weight: 600;
  color: var(--accent-green);
}
.ebm-result-meta {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; font-family: var(--font-mono);
  color: var(--text-muted);
}
.ebm-result-actions {
  margin-left: auto;
  display: flex; align-items: center; gap: 6px;
}
.ebm-hero-report-body {
  padding: 20px;
  font-size: 13px; line-height: 1.85;
  color: var(--text-primary);
  max-height: 700px;
  overflow-y: auto;
}
.ebm-hero-report-body :deep(h2) { font-size: 16px; margin: 18px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.ebm-hero-report-body :deep(h3) { font-size: 14px; margin: 14px 0 6px; }
.ebm-hero-report-body :deep(h4) { font-size: 14px; margin: 12px 0 6px; }
.ebm-hero-report-body :deep(h5) { font-size: 13px; margin: 10px 0 4px; }
.ebm-hero-report-body :deep(h6) { font-size: 13px; margin: 10px 0 4px; }
.ebm-hero-report-body :deep(p) { margin: 8px 0; }
.ebm-hero-report-body :deep(ul), .ebm-hero-report-body :deep(ol) { padding-left: 20px; margin: 6px 0; }
.ebm-hero-report-body :deep(li) { margin: 4px 0; }
.ebm-hero-report-body :deep(blockquote) { border-left: 3px solid var(--accent-teal); padding-left: 14px; margin: 10px 0; color: var(--text-secondary); }
.ebm-hero-report-body :deep(code) { background: var(--bg-2); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
.ebm-hero-report-body :deep(pre) { background: var(--bg-2); padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 11px; }

/* ── EBM reference block (custom HTML, not markdown) ───────────── */
.ebm-hero-report-body :deep(.ebm-refs) {
  margin-top: 24px;
  border-top: 2px solid var(--border-md);
  padding-top: 16px;
}
.ebm-hero-report-body :deep(.ebm-refs-hdr) {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: .05em;
  margin-bottom: 12px;
  text-align: center;
}
.ebm-hero-report-body :deep(.ebm-ref-entry) {
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-secondary);
  padding: 8px 0;
}
.ebm-hero-report-body :deep(.ebm-ref-entry + .ebm-ref-entry) {
  border-top: 1px dashed var(--border);
}
.ebm-hero-report-body :deep(.ebm-ref-idx) {
  font-weight: 700;
  color: var(--text-primary);
}
.ebm-hero-report-body :deep(.ebm-ref-detail) {
  padding-left: 24px;
  color: var(--text-secondary);
}
.ebm-hero-report-body :deep(.ebm-ref-sep) {
  /* visual gap between entries — border handles it */
}
.ebm-hero-report-body :deep(.ebm-ref-dedup-note) {
  margin-top: 10px;
  padding: 6px 14px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-2);
  border-radius: var(--radius-sm);
  text-align: center;
}

.ebm-hero-placeholder {
  padding: 28px 20px; text-align: center;
  font-size: 13px; color: var(--text-muted);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVIDENCE PANEL — collapsible secondary section
   ═══════════════════════════════════════════════════════════════════════════ */
.evidence-panel {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  transition: border-color .2s;
}
.ev-panel-collapsed {
  border-color: var(--border);
}

/* Summary bar */
.ev-panel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  transition: background .12s;
}
.evidence-panel:not(.ev-panel-collapsed) .ev-panel-bar {
  border-bottom: 1px solid var(--border);
}
.ev-panel-bar:hover { background: var(--bg-2); }
.ev-panel-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}
.ev-panel-bar-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.ev-panel-bar-count { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
.ev-panel-bar-starred { font-size: 11px; font-family: var(--font-mono); color: var(--accent-amber); font-weight: 600; }
.ev-panel-bar-uncited { font-size: 10px; color: var(--text-muted); }
.ev-panel-bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
}
.ev-panel-bar-hint { font-size: 11px; }

.ev-panel-body { /* no extra padding — inner cards handle it */ }

/* Empty state */
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 32px; }
.state-icon { width: 56px; height: 56px; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-xl); display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
.state-txt { font-size: 14px; color: var(--text-muted); text-align: center; line-height: 1.7; }

/* Search bar */
.ev-search-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--bg-1); }
.ev-search-input { flex: 1; border: none; background: transparent; font-size: 13px; font-family: var(--font-body); color: var(--text-primary); outline: none; }
.ev-search-input::placeholder { color: var(--text-muted); }
.ev-clear { font-size: 12px; color: var(--text-muted); cursor: pointer; padding: 2px 6px; border-radius: var(--radius-xs); }
.ev-clear:hover { background: var(--bg-3); color: var(--text-primary); }

/* Cited-only toggle */
.ev-cited-toggle { display: flex; align-items: center; gap: 10px; padding: 7px 14px; border-bottom: 1px solid var(--border); }
.ev-cited-btn { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 100px; border: 1px solid var(--border-md); background: var(--bg-0); font-size: 12px; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.ev-cited-btn:hover { border-color: var(--accent-blue-mid); color: var(--text-primary); }
.ev-cited-btn.active { background: var(--accent-blue-light); border-color: var(--accent-blue-mid); color: var(--accent-blue); font-weight: 600; }
.ev-cited-hint { font-size: 11px; color: var(--text-muted); }

/* Hidden notice */
.hidden-notice { display: flex; align-items: center; gap: 7px; padding: 7px 14px; background: var(--accent-amber-light); border-bottom: 1px solid var(--accent-amber-mid); font-size: 12px; color: var(--accent-amber); }

/* Evidence list */
.ev-list { max-height: 55vh; overflow-y: auto; padding: 0; }
.ev-empty { padding: 48px 24px; text-align: center; font-size: 13px; color: var(--text-muted); }

/* ── Bibliography-entry style (matches MDT report reference format) ── */
.bib-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  transition: background .12s;
}
.bib-entry:last-child { border-bottom: none; }
.bib-entry:hover { background: var(--bg-1); }
.bib-num {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-blue);
  min-width: 28px;
  flex-shrink: 0;
  padding-top: 1px;
}
.bib-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.5;
}
.bib-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
}
.bib-pmid {
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color .12s;
}
a.bib-pmid:hover { color: var(--accent-blue); text-decoration: underline; }

/* Tags */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}
.tag-teal   { background: rgba(20,184,166,.12);  color: #0d9488; }
.tag-blue   { background: rgba(59,130,246,.12);  color: #2563eb; }
.tag-purple { background: rgba(147,51,234,.12);  color: #7c3aed; }
.tag-amber  { background: rgba(245,158,11,.12);  color: #d97706; }
.tag-slate  { background: var(--bg-2);           color: #475569; }

.font-mono { font-family: var(--font-mono); }

/* Right: Filter card */
.filter-card, .export-card { padding: 0; overflow: hidden; }
.filter-hdr { display: flex; align-items: center; gap: 6px; padding: 12px 14px 10px; border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
.filter-sec { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
.filter-sec:last-of-type { border-bottom: none; }
.filter-sec-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); }
.filter-opts { display: flex; flex-wrap: wrap; gap: 4px; }
.filter-btn { padding: 4px 9px; border: 1px solid var(--border-md); border-radius: 100px; background: var(--bg-1); font-size: 11px; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: all .12s; display: inline-flex; align-items: center; gap: 4px; }
.filter-btn:hover { background: var(--bg-3); border-color: var(--border-strong); }
.filter-btn.active { background: var(--accent-blue-light); border-color: var(--accent-blue-mid); color: var(--accent-blue); font-weight: 600; }
.filter-count { font-size: 10px; font-family: var(--font-mono); opacity: .7; }
.filter-reset { padding: 10px 14px 12px; }

/* Export */
.export-warn {
  margin: 10px 14px 0;
  padding: 8px 10px;
  background: var(--accent-amber-light);
  border: 1px solid var(--accent-amber-mid);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--accent-amber);
  line-height: 1.6;
  display: flex;
  gap: 6px;
  align-items: flex-start;
}
.export-opts { padding: 10px 14px 8px; display: flex; flex-direction: column; gap: 6px; }
.export-btn { width: 100%; justify-content: flex-start; }
.export-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
}
.export-divider::before,
.export-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.export-divider span { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.export-note { padding: 0 14px 12px; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

.quick-spinner {
  display: inline-block;
  width: 11px; height: 11px;
  border: 2px solid rgba(0,0,0,.12);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Toast */
.toast {
  position: fixed; bottom: 28px; right: 28px; z-index: 999;
  background: var(--text-primary); color: #fff;
  padding: 10px 18px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500;
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,.12));
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .25s, transform .25s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateY(6px); }
</style>
