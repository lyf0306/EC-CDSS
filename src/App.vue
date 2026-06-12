<template>
  <div class="app-root">
    <nav class="top-nav">
      <div class="nav-inner">
        <router-link to="/figo" class="nav-brand">
          <div class="brand-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span class="brand-title">子宫内膜癌 AI 决策</span>
        </router-link>

        <div v-if="(!isAutoPage && store.mode !== 'independent') || store.autoViewingCase" class="nav-tabs">
          <router-link
            v-for="tab in tabs" :key="tab.path" :to="tab.path"
            class="nav-tab"
            :class="{ 'tab-locked': isProfilePage }"
            @click.prevent="isProfilePage ? null : $router.push(tab.path)"
          >
            <span class="tab-step">{{ tab.step }}</span>
            <span>{{ tab.label }}</span>
          </router-link>
        </div>

        <div class="nav-right">
          <div class="mode-group" :class="{ 'controls-locked': isProfilePage }">
            <span class="mode-label">模式</span>
            <div class="mode-toggle">
              <button
                v-for="m in modes" :key="m.value"
                class="mode-btn"
                :class="{ active: store.mode === m.value }"
                :disabled="isProfilePage"
                @click="isProfilePage ? null : setModeAndNavigate(m.value)"
              >{{ m.label }}</button>
            </div>
          </div>
          <div class="status-pill" :class="statusPillClass">
            <span class="status-dot"></span>
            {{ statusPillText }}
          </div>
          <div v-if="currentUser" class="user-badge" title="当前用户">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>{{ currentUser }}</span>
          </div>
        </div>
      </div>
    </nav>

    <!-- ═══ 全局警告横幅 ═══ -->
    <div v-if="!isOnline" class="global-banner banner-offline">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      <span>网络已断开 — 部分功能不可用。请检查网络连接后刷新页面。</span>
    </div>
    <div v-if="store.backendUnreachable && isOnline" class="global-banner banner-warn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>后端服务不可达 — 病例数据无法保存，功能可能异常。请检查服务器连接。</span>
      <button class="banner-retry-btn" @click="retryBackendConnect">重试</button>
    </div>

    <!-- Vertical sticky stepper — right side (sequential only, not auto) -->
    <Transition name="fade">
      <nav v-if="store.mode === 'sequential' && !isProfilePage" class="v-stepper">
        <ol class="v-stepper-list">
          <template v-for="(step, i) in steps" :key="step.num">
            <li
              class="v-step"
              :class="{ 'v-step-active': routeStep === step.num, 'v-step-done': routeStep > step.num }"
              @click="step.num <= routeStep ? $router.push(step.path) : null"
            >
              <div class="v-step-bullet">
                <svg v-if="routeStep > step.num" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span v-else class="v-step-num">{{ step.num }}</span>
              </div>
              <span class="v-step-label">{{ step.label }}</span>
            </li>
            <li v-if="i < steps.length-1" class="v-step-rail" :class="{ filled: routeStep > step.num }" aria-hidden="true"></li>
          </template>
        </ol>
      </nav>
    </Transition>

    <!-- 多病例侧边栏（固定浮动，不占文档流） -->
    <CaseSidebar v-if="store.mode !== 'independent'" />

    <main class="main-area">
      <!-- 自动模式：默认显示队列，查看病例时显示 router-view + 返回条 -->
      <template v-if="store.mode === 'auto'">
        <AutoExecutionView v-if="!store.autoViewingCase" />
        <div v-else class="auto-case-view">
          <div class="auto-case-topbar">
            <button class="back-to-queue-btn" @click="store.autoViewingCase = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              返回自动队列
            </button>
            <span class="auto-case-running" v-if="store.autoRunning.size > 0">
              <span class="running-dot"></span>
              自动执行进行中 ({{ store.autoRunning.size }} 个)
            </span>
          </div>
          <router-view v-slot="{ Component }">
            <Transition name="fade" mode="out-in">
              <component :is="Component" />
            </Transition>
          </router-view>
        </div>
      </template>

            <!-- 独立模式：左侧临时分期历史 + 右侧 FIGO 分期页面 -->
      <div v-else-if="store.mode === 'independent'" class="independent-layout">
        <!-- 折叠态：触发按钮（对齐 CaseSidebar） -->
        <Transition name="fade">
          <button
            v-if="!stagingOpen"
            class="staging-trigger"
            title="分期列表"
            @click="stagingOpen = true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </button>
        </Transition>

        <!-- 展开态：分期面板 -->
        <Transition name="panel">
          <aside v-if="stagingOpen" class="staging-panel">
            <div class="staging-panel-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>本次分期</span>
              <button v-if="!stagingBatchMode && store.stagingHistory.length > 0" class="staging-menu-btn" @click="enterStagingBatch" title="批量操作">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
              </button>
              <button v-if="stagingBatchMode" class="staging-menu-btn" @click="stagingBatchMode = false; stagingCheckedIds.clear()" title="退出批量模式">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button class="staging-panel-close" @click="stagingOpen = false" title="收起">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="staging-search-wrap">
              <svg class="staging-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                v-model="stagingSearch"
                class="staging-search-input"
                placeholder="搜索分期记录..."
                @keyup.escape="stagingSearch = ''"
              />
              <button v-if="stagingSearch" class="staging-search-clear" @click="stagingSearch = ''">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="staging-panel-body">
              <div
                v-for="entry in filteredStaging" :key="entry.id"
                class="staging-item"
                :class="{ 'staging-active': entry.id === store.activeCaseId }"
                @click="stagingBatchMode ? toggleStagingCheck(entry.id) : (renamingId === entry.id ? null : selectStaging(entry.id))"
              >
                <div v-if="stagingBatchMode" class="staging-check-col" @click.stop>
                  <input
                    type="checkbox"
                    :checked="stagingCheckedIds.has(entry.id)"
                    @change="toggleStagingCheck(entry.id)"
                  />
                </div>
                <div class="staging-item-main">
                  <input
                    v-if="renamingId === entry.id"
                    ref="renameInput"
                    v-model="renameText"
                    class="staging-rename-input-inline"
                    @keyup.enter="finishRename"
                    @keyup.escape="renamingId = null"
                    @blur="finishRename"
                    @click.stop
                  />
                  <div v-else class="staging-item-label">{{ entry.label }}</div>
                  <div class="staging-item-meta">
                    <span class="staging-item-stage">{{ entry.figoStage }}</span>
                  </div>
                </div>
                <div class="staging-item-actions" @click.stop>
                  <template v-if="stagingDeleting === entry.id">
                    <span class="staging-delete-confirm">确认删除？</span>
                    <button class="staging-action-btn staging-action-yes" @click="doDeleteStaging(entry.id)" title="确认删除">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="staging-action-btn" @click="stagingDeleting = null" title="取消">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </template>
                  <template v-else>
                    <span class="staging-date-default">{{ fmtTime(entry.timestamp) }}</span>
                    <div class="staging-hover-actions">
                      <button class="staging-action-btn" @click="startRename(entry)" title="重命名">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button class="staging-action-btn staging-action-del" @click="stagingDeleting = entry.id" title="删除">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </template>
                </div>
              </div>
              <div v-if="filteredStaging.length === 0 && stagingSearch" class="staging-empty">
                未找到匹配的分期记录
              </div>
              <div v-else-if="store.stagingHistory.length === 0" class="staging-empty">
                <span>暂无分期记录</span>
                <span class="staging-empty-hint">粘贴病理报告后点击「AI 分期」开始</span>
              </div>
            </div>
            <!-- 批量操作栏 -->
            <div v-if="stagingBatchMode" class="staging-batch-bar">
              <button class="staging-batch-btn" @click="stagingSelectAll">
                全选 ({{ filteredStaging.length }})
              </button>
              <button
                class="staging-batch-btn staging-batch-promote"
                :disabled="stagingCheckedIds.size === 0"
                @click="batchPromoteStaging"
              >
                加入列表
              </button>
              <button
                class="staging-batch-btn staging-batch-del"
                :disabled="stagingCheckedIds.size === 0"
                @click="batchDeleteStaging"
              >
                删除
              </button>
              <button
                class="staging-batch-btn"
                :disabled="stagingCheckedIds.size === 0"
                @click="exportStaging"
              >
                导出
              </button>
              <button class="staging-batch-btn staging-batch-cancel" @click="stagingBatchMode = false; stagingCheckedIds.clear()">
                取消
              </button>
            </div>
            <div v-else class="staging-panel-foot">
              <button class="staging-new-btn" @click="startNewStaging()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                新分期
              </button>
            </div>
          </aside>
        </Transition>

        <!-- 点击外部关闭遮罩 -->
        <Transition name="fade">
          <div v-if="stagingOpen" class="staging-overlay" @click="stagingOpen = false"></div>
        </Transition>

        <div class="independent-main">
          <router-view v-slot="{ Component }">
            <Transition name="fade" mode="out-in">
              <component :is="Component" />
            </Transition>
          </router-view>
        </div>
      </div>

      <router-view v-else v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDiagnosisStore } from './stores/diagnosis'
import { caseStorage, getUserId } from './api/caseStorage.js'
import { useNetworkStatus } from './composables/useNetworkStatus.js'
import CaseSidebar from './components/CaseSidebar.vue'
import AutoExecutionView from './views/AutoExecutionView.vue'

const store = useDiagnosisStore()
const route = useRoute()
const router = useRouter()
const { isOnline } = useNetworkStatus()
const currentUser = ref('')
const stagingSearch = ref('')
const stagingDeleting = ref(null)  // 正在确认删除的分期 ID
const stagingOpen = ref(false)
const stagingBatchMode = ref(false)
const stagingCheckedIds = ref(new Set())
const renamingId = ref(null)
const renameText = ref('')
const renameInput = ref(null)
const filteredStaging = computed(() => {
  const q = stagingSearch.value.trim().toLowerCase()
  if (!q) return store.stagingHistory
  return store.stagingHistory.filter(e =>
    e.label.toLowerCase().includes(q) ||
    e.figoStage.toLowerCase().includes(q)
  )
})

function fmtTime(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function selectStaging(id) {
  store.loadStagingResult(id)
  stagingOpen.value = false
  if (route.path !== '/figo') router.replace('/figo')
}

function startNewStaging() {
  store.newCase()
  if (route.path !== '/figo') router.replace('/figo')
}

function doDeleteStaging(id) {
  stagingDeleting.value = null
  store.removeStagingResult(id)
}

// ── 批量操作 ──────────────────────────────────────────────
function enterStagingBatch() {
  stagingBatchMode.value = true
  stagingCheckedIds.value = new Set()
}
function toggleStagingCheck(id) {
  const next = new Set(stagingCheckedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  stagingCheckedIds.value = next
}
function stagingSelectAll() {
  if (stagingCheckedIds.value.size === filteredStaging.value.length) {
    stagingCheckedIds.value = new Set()
  } else {
    stagingCheckedIds.value = new Set(filteredStaging.value.map(e => e.id))
  }
}
async function batchPromoteStaging() {
  if (stagingCheckedIds.value.size === 0) return
  for (const id of stagingCheckedIds.value) {
    await store.promoteToCaseList(id)
  }
  stagingCheckedIds.value = new Set()
  stagingBatchMode.value = false
}
function batchDeleteStaging() {
  if (stagingCheckedIds.value.size === 0) return
  for (const id of stagingCheckedIds.value) {
    store.removeStagingResult(id)
  }
  stagingCheckedIds.value = new Set()
  stagingBatchMode.value = false
}
function exportStaging() {
  const ids = stagingCheckedIds.value
  const entries = store.stagingHistory.filter(e => ids.has(e.id))
  const data = entries.map(e => ({
    label: e.label,
    figo_stage: e.figoStage,
    raw_output: e.figoRawOutput,
    pathology: e.pathologyText,
    patient_case: e.patientCase,
    timestamp: new Date(e.timestamp).toISOString(),
  }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `figo-staging-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  stagingCheckedIds.value = new Set()
  stagingBatchMode.value = false
}

function startRename(entry) {
  renamingId.value = entry.id
  renameText.value = entry.label
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function finishRename() {
  if (renamingId.value && renameText.value.trim()) {
    store.renameStagingResult(renamingId.value, renameText.value.trim())
  }
  renamingId.value = null
  renameText.value = ''
}

async function retryBackendConnect() {
  try {
    await caseStorage.healthCheck()
    store.setBackendUnreachable(false)
    // 后端恢复后尝试重新加载
    await store.restore()
  } catch {
    // 仍然不可达，保持警告
  }
}

onMounted(async () => {
  try {
    await caseStorage.healthCheck()
    // 获取用户信息并展示
    const user = await caseStorage.getCurrentUser().catch(() => ({}))
    currentUser.value = user.display_name || user.user_id || getUserId().slice(0, 12)
    await store.restore()
    // 防御性恢复：自动模式下，如果 restore 成功恢复了病例数据但 autoViewingCase 为 false，
    // 且当前路由为 /evidence 或 /treatment（队列始终在 /figo，不会在其他路由），
    // 则补设为 true，防止刷新后错误跳回自动队列。
    if (store.mode === 'auto' && store.activeCaseId && !store.autoViewingCase) {
      const path = route.path
      if (path === '/treatment' || path === '/evidence') {
        store.autoViewingCase = true
      }
    }
  } catch {
    store.setBackendUnreachable(true)
  }
})

const tabs   = [{ path:'/figo',step:1,label:'分期诊断'},{ path:'/treatment',step:2,label:'方案生成'},{ path:'/evidence',step:3,label:'证据合成'}]
const modes  = [{ value:'independent',label:'独立'},{ value:'sequential',label:'连续'},{ value:'auto',label:'自动'}]
const steps  = [{ num:1,path:'/figo',label:'分期诊断'},{ num:2,path:'/treatment',label:'方案生成'},{ num:3,path:'/evidence',label:'证据合成'}]

const routeStep    = computed(() => route.meta?.step || 1)
const isProfilePage= computed(() => route.meta?.isProfile === true)
const isAutoPage   = computed(() => store.mode === 'auto')

const statusPillClass = computed(() => {
  if (store.mode === 'auto') return 'pill-amber'
  return store.mode === 'sequential' ? 'pill-teal' : 'pill-blue'
})
const statusPillText = computed(() => {
  if (isProfilePage.value) return '患者档案录入'
  if (store.mode === 'auto') return '自动执行'
  return store.mode === 'sequential' ? '连续诊断' : '独立模式'
})

async function setModeAndNavigate(m) {
  if (m !== 'auto') store.autoViewingCase = false
  await store.setMode(m)
  if (m === 'auto') {
    // 自动模式不需要路由导航，AutoExecutionView 接管主区域
    // 但为了路由一致性，仍 push 到 /figo
    if (route.path !== '/figo') router.push('/figo')
  }
  if (m === 'independent') {
    // 独立模式始终显示 FIGO 分期页面
    if (route.path !== '/figo') router.push('/figo')
  }
}
</script>

<style scoped>
.app-root { min-height:100vh; }

/* ── 全局警告横幅 ── */
.global-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
}
.banner-offline {
  background: #fef2f2;
  color: #991b1b;
  border-bottom: 1px solid #fecaca;
}
.banner-warn {
  background: #fffbeb;
  color: #92400e;
  border-bottom: 1px solid #fde68a;
}
.banner-retry-btn {
  margin-left: auto;
  flex-shrink: 0;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #d97706;
  border-radius: 4px;
  background: #fff;
  color: #92400e;
  cursor: pointer;
}
.banner-retry-btn:hover {
  background: #fef3c7;
}
.top-nav {
  position:fixed; top:0; left:0; right:0; height:var(--nav-height); z-index:50;
  background:#fff; border-bottom:1px solid var(--border); box-shadow:0 1px 4px rgba(0,0,0,0.06);
}
.nav-inner { max-width:1440px; margin:0 auto; height:100%; padding:0 20px; display:flex; align-items:center; gap:4px; }
.nav-brand { display:flex; align-items:center; gap:9px; text-decoration:none; flex-shrink:0; margin-right:20px; }
.brand-icon { width:32px; height:32px; background:var(--accent-blue); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; color:#fff; }
.brand-title { font-family:var(--font-serif); font-size:15px; font-weight:700; color:var(--text-primary); white-space:nowrap; }
.nav-tabs { display:flex; gap:2px; flex:1; }
.nav-tab { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:var(--radius-sm); text-decoration:none; color:var(--text-secondary); font-size:13px; font-weight:500; transition:all 0.15s; border:1px solid transparent; }
.nav-tab:hover:not(.tab-locked) { color:var(--text-primary); background:var(--bg-2); }
.nav-tab.router-link-active:not(.tab-locked) { color:var(--accent-blue); background:var(--accent-blue-light); border-color:var(--accent-blue-mid); font-weight:600; }
.nav-tab.tab-locked { cursor:not-allowed; opacity:0.45; pointer-events:none; }
.tab-step { width:20px; height:20px; border-radius:50%; background:var(--bg-3); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; font-family:var(--font-mono); color:var(--text-muted); flex-shrink:0; }
.nav-tab.router-link-active:not(.tab-locked) .tab-step { background:var(--accent-blue); color:#fff; }
.nav-right { display:flex; align-items:center; gap:12px; margin-left:auto; flex-shrink:0; }
.mode-group { display:flex; align-items:center; gap:7px; }
.controls-locked { opacity:0.4; pointer-events:none; }
.mode-label { font-size:12px; color:var(--text-muted); font-weight:500; }
.mode-toggle { display:flex; background:var(--bg-2); border:1px solid var(--border-md); border-radius:var(--radius-sm); padding:2px; gap:1px; }
.mode-btn { padding:3px 11px; border-radius:4px; border:none; background:transparent; color:var(--text-secondary); font-size:12px; font-weight:500; cursor:pointer; transition:all 0.15s; }
.mode-btn.active { background:#fff; color:var(--text-primary); box-shadow:var(--shadow-xs); }
.mode-btn:disabled { cursor:not-allowed; }
.status-pill { display:flex; align-items:center; gap:6px; padding:4px 11px; border-radius:100px; font-size:12px; font-weight:600; border:1px solid transparent; }
.status-dot { width:6px; height:6px; border-radius:50%; }
.pill-blue { background:var(--accent-blue-light); color:var(--accent-blue); border-color:var(--accent-blue-mid); }
.pill-blue .status-dot { background:var(--accent-blue); }
.pill-teal { background:var(--accent-teal-light); color:var(--accent-teal); border-color:var(--accent-teal-mid); }
.pill-teal .status-dot { background:var(--accent-teal); }
.pill-amber { background:var(--accent-amber-light); color:var(--accent-amber); border-color:var(--accent-amber-mid); }
.pill-amber .status-dot { background:var(--accent-amber); }
.user-badge { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:100px; font-size:12px; font-weight:500; color:var(--text-secondary); background:var(--bg-2); border:1px solid var(--border-md); cursor:default; }
.user-badge svg { color:var(--text-muted); flex-shrink:0; }
/* ── Vertical sticky stepper ────────────────────────────────── */
.v-stepper {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 35;
  padding: 16px 10px;
  background: var(--bg-0, #fff);
  border: 1px solid var(--border-md, #e2e8f0);
  border-radius: var(--radius-md, 10px);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.v-stepper-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}
.v-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 6px);
  transition: background 0.15s;
}
.v-step:hover {
  background: var(--bg-2, #f1f5f9);
}
.v-step-bullet {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--border-md, #cbd5e1);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-0, #fff);
  transition: all 0.25s;
  flex-shrink: 0;
}
.v-step-num {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  color: var(--text-muted, #94a3b8);
}
.v-step-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted, #94a3b8);
  transition: color 0.2s;
  white-space: nowrap;
}
.v-step-active .v-step-bullet {
  border-color: var(--accent-blue, #2563eb);
  box-shadow: 0 0 0 3px var(--accent-blue-mid, rgba(37,99,235,0.2));
}
.v-step-active .v-step-num {
  color: var(--accent-blue, #2563eb);
}
.v-step-active .v-step-label {
  color: var(--text-primary, #1e293b);
  font-weight: 600;
}
.v-step-done .v-step-bullet {
  background: var(--accent-teal, #0d9488);
  border-color: var(--accent-teal, #0d9488);
}
.v-step-done .v-step-label {
  color: var(--accent-teal, #0d9488);
}
.v-step-rail {
  width: 2px;
  height: 18px;
  background: var(--border-md, #e2e8f0);
  border-radius: 1px;
  transition: background 0.4s;
}
.v-step-rail.filled {
  background: var(--accent-teal, #0d9488);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.main-area { position:relative; z-index:1; padding-top:var(--nav-height); min-height:100vh; }

/* ── Auto case view (在自动模式下查看已完成病例) ─────────── */
.auto-case-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: var(--nav-height);
  z-index: 10;
}
.back-to-queue-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--border-md);
  border-radius: var(--radius-sm);
  background: var(--bg-0);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.back-to-queue-btn:hover {
  background: var(--bg-2);
  border-color: var(--accent-amber);
  color: var(--accent-amber);
}
.auto-case-running {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-amber);
}
.running-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-amber);
  animation: pulse-dot 1.2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}


/* ── Independent mode layout ──────────────────────────── */
.independent-layout {
  display: flex;
  height: calc(100vh - var(--nav-height));
}

/* ── Staging panel (floating, centered, compact) ── */
.staging-panel {
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 38;
  width: 240px;
  max-height: 64vh;
  background: var(--bg-0, #fff);
  border: 1px solid var(--border-md, #e2e8f0);
  border-radius: var(--radius-md, 10px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.staging-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  flex-shrink: 0;
}
.staging-panel-head svg { color: var(--accent-teal, #0d9488); flex-shrink: 0; }
/* ── Search ──────────────────────────────────────────── */
.staging-search-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  flex-shrink: 0;
}
.staging-search-icon {
  color: var(--text-muted, #94a3b8);
  flex-shrink: 0;
  width: 12px; height: 12px;
}
.staging-search-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 11px;
  color: var(--text-primary, #1e293b);
  outline: none;
  min-width: 0;
}
.staging-search-input::placeholder { color: var(--text-muted, #94a3b8); }
.staging-search-clear {
  width: 16px; height: 16px;
  border: none; background: none;
  cursor: pointer; color: var(--text-muted, #94a3b8);
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; flex-shrink: 0;
  transition: background 0.15s;
}
.staging-search-clear:hover { background: var(--bg-3, #e2e8f0); }

/* ── Body ────────────────────────────────────────────── */
.staging-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 5px;
}
.staging-item {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 6px 6px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.15s;
}
.staging-item:hover { background: var(--bg-2, #f1f5f9); }
.staging-active {
  background: var(--accent-blue-light, #eff6ff);
  border: 1px solid var(--accent-blue-mid, rgba(37,99,235,0.15));
}
.staging-item-main { flex: 1; min-width: 0; }
.staging-item-label {
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.staging-active .staging-item-label {
  font-weight: 600;
  color: var(--accent-blue, #2563eb);
}
.staging-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
}
.staging-item-stage {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--accent-teal-light, #f0fdfa);
  color: var(--accent-teal, #0d9488);
  font-family: var(--font-mono, monospace);
}

/* ── Actions (hover reveal, match CaseSidebar) ───────── */
.staging-item-actions {
  flex-shrink: 0;
  position: relative;
}
.staging-date-default {
  font-size: 10px;
  color: var(--text-muted, #94a3b8);
  white-space: nowrap;
  transition: opacity 0.15s;
}
.staging-item:hover .staging-date-default { opacity: 0; }
.staging-hover-actions {
  position: absolute;
  right: 0; top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.staging-item:hover .staging-hover-actions { opacity: 1; pointer-events: auto; }
.staging-action-btn {
  width: 24px; height: 24px;
  border: none; background: none;
  cursor: pointer; color: var(--text-muted, #94a3b8);
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}
.staging-action-btn:hover { background: var(--bg-2, #f1f5f9); }
.staging-action-del:hover { color: #ef4444; background: #fef2f2; }
.staging-action-yes { color: #22c55e; }
.staging-action-yes:hover { background: #f0fdf4; color: #16a34a; }
.staging-delete-confirm {
  font-size: 10px;
  color: #ef4444;
  white-space: nowrap;
  font-weight: 500;
}

.staging-empty {
  padding: 20px 10px;
  text-align: center;
  color: var(--text-muted, #94a3b8);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.staging-empty-hint { font-size: 10px; opacity: 0.7; }

/* ── Foot ────────────────────────────────────────────── */
.staging-panel-foot {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border, #e2e8f0);
  flex-shrink: 0;
}
.staging-new-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: var(--radius-sm, 5px);
  background: var(--accent-blue, #2563eb);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.staging-new-btn:hover { background: var(--accent-blue-dark, #1d4ed8); }

.staging-menu-btn {
  width: 24px; height: 24px; margin-left: auto;
  border: none; background: none;
  border-radius: var(--radius-sm, 5px);
  cursor: pointer; color: var(--text-muted, #94a3b8);
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.staging-menu-btn:hover { background: var(--bg-2, #f1f5f9); color: var(--text-primary, #1e293b); }

/* ── Batch bar ─────────────────────────────────────────── */
.staging-batch-bar {
  display: flex; gap: 4px;
  padding: 8px 10px;
  border-top: 1px solid var(--border, #e2e8f0);
  flex-shrink: 0;
}
.staging-batch-btn {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--border-md, #e2e8f0);
  border-radius: var(--radius-sm, 5px);
  background: var(--bg-0, #fff);
  font-size: 10px; font-weight: 600;
  color: var(--text-secondary, #475569);
  cursor: pointer;
  transition: background 0.15s;
}
.staging-batch-btn:hover { background: var(--bg-2, #f1f5f9); }
.staging-batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.staging-batch-promote { color: var(--accent-blue, #2563eb); border-color: var(--accent-blue-mid, #93c5fd); }
.staging-batch-promote:hover:not(:disabled) { background: var(--accent-blue-light, #eff6ff); }
.staging-batch-del { color: var(--accent-rose, #e11d48); border-color: var(--accent-rose-mid, #fda4af); }
.staging-batch-del:hover:not(:disabled) { background: var(--accent-rose-light, #fff1f2); }
.staging-batch-cancel { color: var(--text-muted, #94a3b8); }

/* ── Batch checkbox ────────────────────────────────────── */
.staging-check-col {
  display: flex; align-items: center;
  padding-right: 4px; flex-shrink: 0;
}
.staging-check-col input[type="checkbox"] {
  width: 14px; height: 14px; cursor: pointer;
  accent-color: var(--accent-blue, #2563eb);
}

.independent-main {
  flex: 1;
  overflow-y: auto;
}

/* ── Staging trigger (collapsed, match CaseSidebar) ──── */
.staging-trigger {
  position:fixed; left:20px; top:50%; transform:translateY(-50%); z-index:35;
  width:42px; height:42px; border-radius:50%;
  border:1px solid var(--border-md,#e2e8f0); background:var(--bg-0,#fff);
  box-shadow:0 2px 12px rgba(0,0,0,0.06); cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  color:var(--accent-teal,#0d9488); transition:box-shadow 0.2s,transform 0.3s;
}
.staging-trigger:hover{box-shadow:0 4px 16px rgba(13,148,136,0.15);transform:translateY(-50%) scale(1.06)}
.staging-panel-close{width:22px;height:22px;border:none;background:none;cursor:pointer;color:var(--text-muted,#94a3b8);display:flex;align-items:center;justify-content:center;border-radius:4px;transition:background 0.15s}
.staging-panel-close:hover{background:var(--bg-2,#f1f5f9);color:var(--text-primary)}
.staging-overlay{position:fixed;inset:0;z-index:36}
.staging-rename-input-inline{width:33%;padding:2px 5px;font-size:11px;font-weight:500;border:1px solid var(--accent-blue-mid,rgba(37,99,235,0.3));border-radius:3px;outline:none;background:var(--bg-0,#fff);color:var(--text-primary,#1e293b);margin:-1px 0}
.staging-rename-input-inline:focus{border-color:var(--accent-blue,#2563eb);box-shadow:0 0 0 2px var(--accent-blue-mid,rgba(37,99,235,0.12))}
.panel-enter-active{transition:all 0.2s cubic-bezier(0.16,1,0.3,1)}
.panel-leave-active{transition:all 0.15s ease-in}
.panel-enter-from{opacity:0;transform:translateY(-50%) translateX(-8px)}
.panel-leave-to{opacity:0;transform:translateY(-50%) translateX(-6px)}
</style>