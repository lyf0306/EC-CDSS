<template>
  <!-- 折叠态：小圆形图标 -->
  <Transition name="fade">
    <button
      v-if="!open"
      class="case-trigger"
      title="病例列表"
      @click="open = true"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </button>
  </Transition>

  <!-- 展开态：病例列表面板 -->
  <Transition name="panel">
    <aside v-if="open" class="case-panel">
      <div class="case-panel-head">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>病例列表</span>
        <button class="case-panel-more" @click="toggleBatchMode" title="批量操作">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
        <button class="case-panel-close" @click="open = false" title="收起">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- 搜索框 -->
      <div class="case-search-wrap">
        <svg class="case-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          v-model="searchQuery"
          class="case-search-input"
          placeholder="搜索病例..."
          @keyup.escape="searchQuery = ''"
        />
        <button v-if="searchQuery" class="case-search-clear" @click="searchQuery = ''">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="case-panel-body">
        <div
          v-for="c in displayedCases" :key="c.id"
          class="case-item"
          :class="{ 'case-active': c.id === store.activeCaseId, 'case-batch-checked': batchMode && checkedIds.has(c.id) }"
          @click="batchMode ? toggleCheck(c.id) : (renamingId === c.id ? null : handleSwitch(c.id))"
        >
          <div v-if="batchMode" class="case-checkbox" @click.stop="toggleCheck(c.id)">
            <svg v-if="checkedIds.has(c.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            <div v-else class="case-checkbox-empty"></div>
          </div>
          <div class="case-item-main">
            <input
              v-if="renamingId === c.id"
              ref="renameInput"
              v-model="renameText"
              class="case-rename-input-inline"
              @keyup.enter="finishRename"
              @keyup.escape="renamingId = null"
              @blur="finishRename"
              @click.stop
            />
            <div v-else class="case-item-label">
              {{ c.label }}
              <span v-if="store.hasBackgroundTask(c.id)" class="case-bg-dot" title="后台任务进行中"></span>
            </div>
            <div class="case-item-meta">
              <span v-if="c.figo_stage" class="case-stage-tag">{{ c.figo_stage }}</span>
            </div>
          </div>
          <div v-if="!batchMode" class="case-item-actions" @click.stop>
            <template v-if="deletingId === c.id">
              <span class="case-delete-confirm">确认删除？</span>
              <button class="case-action-btn case-action-yes" @click="doDelete(c.id)" title="确认删除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button class="case-action-btn" @click="deletingId = null" title="取消">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </template>
            <template v-else>
              <span class="case-date case-date-default">{{ fmtDate(c.saved_at) }}</span>
              <div class="case-hover-actions">
                <button class="case-action-btn" @click="startRename(c)" title="重命名">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                <button class="case-action-btn case-action-del" @click="deletingId = c.id" title="删除">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- 搜索状态指示 -->
        <div v-if="searching" class="case-search-status">搜索全部记录中…</div>

        <div v-if="!cases.length" class="case-empty">
          暂无病例，开始诊断后自动保存
        </div>
        <div v-else-if="searchQuery && backendSearchResults !== null && backendSearchResults.length === 0 && !searching" class="case-empty">
          未找到匹配的病例
        </div>
      </div>

      <!-- 批量操作栏 -->
      <div v-if="batchMode" class="case-batch-bar">
        <button class="batch-btn" @click="selectAll">
          全选 ({{ displayedCases.length }})
        </button>
        <button
          class="batch-btn batch-btn-del"
          :disabled="checkedIds.size === 0"
          @click="batchDelete"
        >
          {{ batchDeleteConfirm ? `确认删除 ${checkedIds.size} 个病例？` : `删除选中 (${checkedIds.size})` }}
        </button>
      </div>
      <div v-else class="case-panel-foot">
        <button class="case-new-btn" @click="doNewCase">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建病例
        </button>
      </div>
    </aside>
  </Transition>

  <!-- 点击外部关闭遮罩 -->
  <Transition name="fade">
    <div v-if="open" class="case-overlay" @click="open = false"></div>
  </Transition>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDiagnosisStore } from '../stores/diagnosis'
import { caseStorage } from '../api/caseStorage.js'

const store = useDiagnosisStore()
const router = useRouter()

const STEP_ROUTES = { 1: '/figo', 2: '/treatment', 3: '/evidence' }

const open = ref(false)
const renamingId = ref(null)
const renameText = ref('')
const renameInput = ref(null)
const searchQuery = ref('')
const deletingId = ref(null)

// ── 批量操作 ─────────────────────────────────────────────
const batchMode = ref(false)
const checkedIds = ref(new Set())
const batchDeleteConfirm = ref(false)

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) { checkedIds.value = new Set(); batchDeleteConfirm.value = false }
}

function toggleCheck(id) {
  const next = new Set(checkedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  checkedIds.value = next
  batchDeleteConfirm.value = false
}

function selectAll() {
  if (checkedIds.value.size === displayedCases.value.length) {
    checkedIds.value = new Set()
  } else {
    checkedIds.value = new Set(displayedCases.value.map(c => c.id))
  }
  batchDeleteConfirm.value = false
}

async function batchDelete() {
  if (checkedIds.value.size === 0) return
  if (!batchDeleteConfirm.value) {
    batchDeleteConfirm.value = true
    return
  }
  const ids = [...checkedIds.value]
  for (const id of ids) {
    await store.deleteCase(id).catch(() => {})
  }
  checkedIds.value = new Set()
  batchDeleteConfirm.value = false
  batchMode.value = false
}

// ── 二级搜索 ─────────────────────────────────────────────
const backendSearchResults = ref(null)  // null=未触发后端搜索, []=后端无结果
const searching = ref(false)            // 后端搜索进行中
let searchTimer = null

const SEVEN_DAYS_MS = 7 * 86400 * 1000

const cases = computed(() => store.listCases())

/** 默认列表：仅最近 7 天（按 saved_at 过滤） */
const recentCases = computed(() => {
  const cutoff = Date.now() - SEVEN_DAYS_MS
  return cases.value.filter(c => c.saved_at >= cutoff)
})

/** 当前展示的病例列表 */
const displayedCases = computed(() => {
  // 后端搜索结果 → 直接展示
  if (backendSearchResults.value !== null) return backendSearchResults.value

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return recentCases.value

  // 一级：本地过滤（全量缓存，含 7 天外数据）
  const local = cases.value.filter(c =>
    c.label.toLowerCase().includes(q) ||
    (c.figo_stage && c.figo_stage.toLowerCase().includes(q))
  )
  return local
})

// ── 搜索：本地无结果 → 自动触发后端搜索 ─────────────────
watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  const trimmed = q.trim().toLowerCase()

  if (!trimmed) {
    backendSearchResults.value = null
    searching.value = false
    return
  }

  searchTimer = setTimeout(async () => {
    // 一级：本地全量缓存中查找
    const local = cases.value.filter(c =>
      c.label.toLowerCase().includes(trimmed) ||
      (c.figo_stage && c.figo_stage.toLowerCase().includes(trimmed))
    )

    if (local.length > 0) {
      backendSearchResults.value = null  // 本地命中，不触发后端
      searching.value = false
      return
    }

    // 二级：后端全文搜索
    searching.value = true
    try {
      const results = await caseStorage.listCases({ search: trimmed })
      backendSearchResults.value = results
    } catch {
      backendSearchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
})

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function startRename(c) {
  renamingId.value = c.id
  renameText.value = c.label
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

async function finishRename() {
  if (renamingId.value && renameText.value.trim()) {
    await store.renameCase(renamingId.value, renameText.value.trim())
  }
  renamingId.value = null
  renameText.value = ''
}

	async function handleSwitch(caseId) {
	  // 自动模式下未查看病例时（在 AutoExecutionView 队列界面），
	  // 即使 caseId 与 activeCaseId 相同也不能短路——需要进入查看模式
	  if (caseId === store.activeCaseId && !(store.mode === "auto" && !store.autoViewingCase)) {
	    open.value = false
	    return
	  }
	  // 自动模式下未查看病例时（队列界面）：先切换到连续模式再加载病例，
	  // 否则 switchCase 内部会因 mode==="auto" 设置 autoViewingCase=true，导致被留在自动模式
	  if (store.mode === "auto" && !store.autoViewingCase) {
	    await store.setMode("sequential")
	  }
	  const ok = await store.switchCase(caseId)
	  if (!ok) {
	    // 病例数据加载失败（后端不可达或数据损坏），中止切换
	    console.error("[Sidebar] 切换病例失败:", caseId)
	    open.value = false
	    return
	  }
	  const target = STEP_ROUTES[store.currentStep] || "/figo"
	  if (router.currentRoute.value.path !== target) {
	    router.replace(target)
	  }
	  open.value = false
	}

async function doNewCase() {
  await store.newCase()
  if (router.currentRoute.value.path !== '/figo') {
    router.replace('/figo')
  }
  open.value = false
}

async function doDelete(id) {
  deletingId.value = null
  renamingId.value = null
  renameText.value = ''
  await store.deleteCase(id)
  const target = STEP_ROUTES[store.currentStep] || '/figo'
  if (router.currentRoute.value.path !== target) {
    router.replace(target)
  }
}

// 点击菜单外部关闭
watch(open, (val) => {
  if (!val) {
    renamingId.value = null
    deletingId.value = null
  }
})
</script>

<style scoped>
/* ── Trigger button (collapsed) ──────────────────────────── */
.case-trigger {
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 35;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--border-md, #e2e8f0);
  background: var(--bg-0, #fff);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-blue, #2563eb);
  transition: box-shadow 0.2s, transform 0.3s;
}
.case-trigger:hover {
  box-shadow: 0 4px 16px rgba(37,99,235,0.15);
  transform: translateY(-50%) scale(1.06);
}

/* ── Panel (expanded) ────────────────────────────────────── */
.case-panel {
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 40;
  width: 300px;
  max-height: 880px;
  background: var(--bg-0, #fff);
  border: 1px solid var(--border-md, #e2e8f0);
  border-radius: var(--radius-md, 10px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.case-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  flex-shrink: 0;
}
.case-panel-head svg { color: var(--accent-blue, #2563eb); flex-shrink: 0; }
.case-panel-more {
  margin-left: auto;
  width: 26px; height: 26px;
  border: none; background: none;
  cursor: pointer; color: var(--text-muted, #94a3b8);
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; transition: background 0.15s;
}
.case-panel-more:hover { background: var(--bg-2, #f1f5f9); color: var(--text-primary); }
.case-panel-close {
  width: 22px; height: 22px;
  border: none; background: none;
  cursor: pointer; color: var(--text-muted, #94a3b8);
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; transition: background 0.15s;
}
.case-panel-close:hover { background: var(--bg-2, #f1f5f9); color: var(--text-primary); }

/* ── Search ──────────────────────────────────────────────── */
.case-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  flex-shrink: 0;
}
.case-search-icon {
  color: var(--text-muted, #94a3b8);
  flex-shrink: 0;
}
.case-search-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--text-primary, #1e293b);
  outline: none;
  min-width: 0;
}
.case-search-input::placeholder {
  color: var(--text-muted, #94a3b8);
}
.case-search-clear {
  width: 18px; height: 18px;
  border: none; background: none;
  cursor: pointer; color: var(--text-muted, #94a3b8);
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; flex-shrink: 0;
  transition: background 0.15s;
}
.case-search-clear:hover { background: var(--bg-3, #e2e8f0); }

/* ── Body ────────────────────────────────────────────────── */
.case-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 6px;
}

.case-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.case-item:hover { background: var(--bg-2, #f1f5f9); }
.case-batch-checked {
  background: var(--accent-blue-light, #eff6ff);
}
.case-active {
  background: var(--accent-blue-light, #eff6ff);
  border: 1px solid var(--accent-blue-mid, rgba(37,99,235,0.15));
}

.case-item-main { flex: 1; min-width: 0; }
.case-item-label {
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center; gap: 5px;
}
.case-bg-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent-blue, #2563eb);
  flex-shrink: 0;
  animation: bg-pulse 1.2s ease-in-out infinite;
}
@keyframes bg-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.7); }
}
.case-active .case-item-label {
  font-weight: 600;
  color: var(--accent-blue, #2563eb);
}
.case-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.case-stage-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--accent-teal-light, #f0fdfa);
  color: var(--accent-teal, #0d9488);
  font-family: var(--font-mono, monospace);
}
.case-date {
  font-size: 10px;
  color: var(--text-muted, #94a3b8);
}

/* ── Actions (hover reveal) ───────────────────────────────── */
.case-item-actions {
  flex-shrink: 0;
  position: relative;
}
.case-date-default {
  font-size: 10px;
  color: var(--text-muted, #94a3b8);
  white-space: nowrap;
  transition: opacity 0.15s;
}
.case-item:hover .case-date-default { opacity: 0; }
.case-hover-actions {
  position: absolute;
  right: 0; top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.case-item:hover .case-hover-actions {
  opacity: 1;
  pointer-events: auto;
}
.case-action-btn {
  width: 24px; height: 24px;
  border: none; background: none;
  cursor: pointer; color: var(--text-muted, #94a3b8);
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; transition: background 0.12s, color 0.12s;
}
.case-action-btn:hover { background: var(--bg-3, #e2e8f0); color: var(--accent-blue, #2563eb); }
.case-action-del:hover { background: #fef2f2; color: #ef4444; }
.case-action-yes { color: #22c55e; }
.case-action-yes:hover { background: #f0fdf4; color: #16a34a; }
.case-delete-confirm {
  font-size: 10px;
  font-weight: 600;
  color: #ef4444;
  white-space: nowrap;
}

/* ── Batch checkbox ────────────────────────────────────── */
.case-checkbox {
  flex-shrink: 0;
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--accent-blue, #2563eb);
}
.case-checkbox-empty {
  width: 16px; height: 16px;
  border: 2px solid var(--border-md, #cbd5e1);
  border-radius: 3px;
  transition: border-color 0.15s;
}
.case-item:hover .case-checkbox-empty {
  border-color: var(--accent-blue, #2563eb);
}

/* ── Batch action bar ──────────────────────────────────── */
.case-batch-bar {
  display: flex;
  gap: 8px;
  padding: 8px 6px;
  border-top: 1px solid var(--border, #e2e8f0);
  flex-shrink: 0;
}
.batch-btn {
  flex: 1;
  padding: 7px 0;
  border: 1px solid var(--border-md, #cbd5e1);
  background: var(--bg-0, #fff);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.batch-btn:hover { background: var(--bg-2, #f1f5f9); }
.batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.batch-btn-del {
  color: var(--accent-rose, #e11d48);
  border-color: var(--accent-rose-mid, rgba(225,29,72,0.25));
}
.batch-btn-del:not(:disabled):hover {
  background: var(--accent-rose-light, #fff1f2);
}

/* ── Rename input (inline) ───────────────────────────────── */
.case-rename-input-inline {
  width: 33%;
  padding: 2px 5px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--accent-blue-mid, rgba(37,99,235,0.3));
  border-radius: 3px;
  outline: none;
  background: var(--bg-0, #fff);
  color: var(--text-primary, #1e293b);
  margin: -1px 0;
}
.case-rename-input-inline:focus {
  border-color: var(--accent-blue, #2563eb);
  box-shadow: 0 0 0 2px var(--accent-blue-mid, rgba(37,99,235,0.12));
}

/* ── Search status ────────────────────────────────────── */
.case-search-status {
  padding: 10px 14px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  animation: search-pulse 1.2s ease-in-out infinite;
}
@keyframes search-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ── Empty state ─────────────────────────────────────────── */
.case-empty {
  padding: 32px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  line-height: 1.6;
}

/* ── Footer ──────────────────────────────────────────────── */
.case-panel-foot {
  padding: 8px 6px;
  border-top: 1px solid var(--border, #e2e8f0);
  flex-shrink: 0;
}
.case-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 0;
  border: 1px dashed var(--border-md, #cbd5e1);
  background: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-blue, #2563eb);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.case-new-btn:hover { background: var(--accent-blue-light, #eff6ff); border-color: var(--accent-blue-mid); }

/* ── Overlay ─────────────────────────────────────────────── */
.case-overlay {
  position: fixed;
  inset: 0;
  z-index: 38;
}

/* ── Transitions ─────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.panel-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.panel-leave-active {
  transition: all 0.15s ease-in;
}
.panel-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(-8px);
}
.panel-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(-6px);
}
</style>
