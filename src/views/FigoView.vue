<template>
  <div class="figo-page">
    <div class="page-wrap">

      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header-left">
          <span class="section-label">STEP 01</span>
          <h1 class="page-title">分期诊断</h1>
          <p class="page-sub">输入术后病理报告，AI 自动完成 FIGO 分期，再提取患者画像与 ESGO 风险分层</p>
        </div>
        <div v-if="store.profileResult" class="header-figo-badge">
          <span class="badge-label">当前分期</span>
          <span class="badge-figo">{{ store.profileResult.figo_stage }}</span>
        </div>
      </div>

      <div class="two-col">
        <!-- ═══ LEFT: Input ═══════════════════════════════ -->
        <div class="col-left">
          <div class="card input-card">
            <!-- Import Banner -->
            <Transition name="slide-up">
              <div v-if="store.isImported" class="import-banner">
                <div class="import-banner-info">
                  <div class="import-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <div class="import-filename">{{ store.importedFileName }}</div>
                    <div class="import-hint">已自动提取病理报告 · 其他临床信息已填入下一步表单</div>
                  </div>
                </div>
                <button class="btn btn-ghost btn-sm" @click="handleClearImport">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  清除
                </button>
              </div>
            </Transition>

            <!-- Input area header -->
            <div class="card-section-header">
              <div class="card-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span v-if="!store.isImported">病理报告文本</span>
                <span v-else>术后病理报告（已导入）</span>
              </div>
              <label v-if="!store.isImported" class="btn btn-secondary btn-sm import-file-btn" :class="{ loading: parsing }">
                <template v-if="!parsing">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  导入病历文件
                </template>
                <template v-else>
                  <div class="spinner" style="width:13px;height:13px;border-width:2px"></div>
                  解析中...
                </template>
                <input type="file" accept=".docx,.pdf,.txt" style="display:none" @change="handleFileImport" :disabled="parsing" />
              </label>
            </div>

            <!-- Pathology textarea -->
            <div class="textarea-wrap">
              <textarea
                v-model="pathologyText"
                class="form-textarea pathology-textarea"
                :placeholder="textareaPlaceholder"
                rows="16"
                :disabled="phase !== 'idle'"
                @input="store.setPathologyText(pathologyText)"
              ></textarea>
              <div class="char-count" :class="{ warn: pathologyText.length > 3000 }">
                {{ pathologyText.length }} 字
              </div>
            </div>

            <div v-if="!store.isImported" class="file-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              支持导入 .docx / .pdf / .txt 完整病历文件；系统将自动提取病理报告，其余信息自动填入第二步表单
            </div>
            <div v-if="apiError" class="parse-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {{ apiError }}
            </div>

            <!-- ── 一键分析按钮区域 ── -->
            <div class="btn-pipeline">

              <!-- Idle：一键触发 -->
              <button
                v-if="!figoResult && phase === 'idle'"
                class="btn btn-cta btn-full"
                :disabled="!pathologyText.trim()"
                @click="store.mode === 'independent' ? runFigoStage() : runFullPipeline()"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {{ store.mode === 'independent' ? 'AI 分期' : '一键分期诊断' }}
              </button>

              <!-- 运行中 / 已完成：进度管线 -->
              <div v-if="(phase !== 'idle' || figoResult) && store.mode !== 'independent'" class="pipeline-track">
                <div class="pipeline-step" :class="{ active: phase === 'figo', done: !!figoResult }">
                  <span class="pipeline-step-icon">
                    <svg v-if="figoResult" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <div v-else-if="phase === 'figo'" class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:var(--accent-blue);border-color:rgba(59,130,246,0.25)"></div>
                    <span v-else class="pipeline-step-num">1</span>
                  </span>
                  <span class="pipeline-step-label">
                    <template v-if="phase === 'figo'">FIGO 分期诊断中...</template>
                    <template v-else-if="figoResult">FIGO 分期：{{ figoResult.figo_stage || '待确认' }}</template>
                    <template v-else>FIGO 分期</template>
                  </span>
                </div>
                <div class="pipeline-conn" :class="{ filled: !!figoResult }"></div>
                <div class="pipeline-step" :class="{ active: phase === 'profile', done: !!store.profileResult }">
                  <span class="pipeline-step-icon">
                    <svg v-if="store.profileResult" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <div v-else-if="phase === 'profile'" class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:var(--accent-blue);border-color:rgba(59,130,246,0.25)"></div>
                    <span v-else class="pipeline-step-num">2</span>
                  </span>
                  <span class="pipeline-step-label">
                    <template v-if="phase === 'profile'">提取患者画像 / ESGO...</template>
                    <template v-else-if="store.profileResult">患者画像 / ESGO 已提取</template>
                    <template v-else>患者画像 / ESGO 风险</template>
                  </span>
                </div>
              </div>

              <!-- FIGO 完成但画像未提取：继续按钮 -->
              <button
                v-if="figoResult && !store.profileResult && store.mode !== 'independent' && phase === 'idle'"
                class="btn btn-cta btn-full"
                @click="runProfileOnly"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="12 5 19 12 12 19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                继续：提取患者画像 / ESGO 风险
              </button>

              <!-- 重置（完成后出现；独立模式下 figoResult 也算完成） -->
              <button
                v-if="store.profileResult || figoResult"
                class="btn btn-ghost btn-sm reset-btn"
                @click="handleReset"
              >
                重新分析
              </button>

            </div>
          </div>
        </div>

        <!-- ═══ RIGHT: Output ═════════════════════════════ -->
        <div class="col-right">
          <div class="card result-card">
            <div class="result-card-header">
              <div class="panel-title-row">
                <h2 class="panel-title">AI 分析结果</h2>
                <div v-if="store.profileResult" class="result-header-actions">
                  <span class="tag tag-blue">AI 输出</span>
                  <button v-if="!isEditing" class="btn btn-secondary btn-sm" @click="startEdit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    修改校对
                  </button>
                  <button v-else class="btn btn-primary btn-sm" @click="saveEdit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    保存修改
                  </button>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <Transition name="fade">
              <div v-if="!figoResult && !store.profileResult && phase === 'idle'" class="empty-state">
                <div class="empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
                  </svg>
                </div>
                <p class="empty-text">粘贴或导入病历后<br>点击「第一步：AI FIGO 分期」开始分析</p>
              </div>
            </Transition>

            <!-- Phase: FIGO loading -->
            <Transition name="fade">
              <div v-if="phase === 'figo'" class="loading-box">
                <div class="loading-row">
                  <div class="spinner spinner-lg"></div>
                  <div>
                    <div class="loading-title">正在调用 OriClinical 模型进行 FIGO 分期...</div>
                    <div class="loading-sub">连接 vLLM 服务 · 根据 FIGO 2023 指南推断分期，约需 10–60 秒</div>
                  </div>
                </div>
                <div class="skeleton-stack">
                  <div class="skeleton" style="height:14px;width:60%"></div>
                  <div class="skeleton" style="height:14px;width:45%"></div>
                </div>
              </div>
            </Transition>

            <!-- FIGO result preview（分期完成但画像尚未提取） -->
            <Transition name="slide-up">
              <div v-if="figoResult && !store.profileResult && phase === 'idle'" class="figo-preview-box">
                <div class="figo-preview-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  FIGO 分期已完成
                </div>
                <div class="figo-preview-stage">{{ figoResult.figo_stage || '无法提取，请查看原始输出' }}</div>
                <details class="figo-raw-details" :open="figoDetailsOpen" @toggle="figoDetailsOpen = $event.target.open">
                  <summary>{{ figoDetailsOpen ? '收起模型原始推理过程' : '查看模型原始推理过程' }}</summary>
                  <pre class="figo-raw-text">{{ figoResult.raw_output }}</pre>
                </details>
                <div v-if="store.mode !== 'independent'" class="figo-preview-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  分期结果已就绪，点击下方按钮继续提取患者画像
                </div>
                <div v-else class="figo-promote-row">
                  <button class="btn btn-cta btn-full" @click="promoteAndContinue">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    加入病例列表，进入完整诊断流程
                  </button>
                </div>
              </div>
            </Transition>

            <!-- Phase: profile loading -->
            <Transition name="fade">
              <div v-if="phase === 'profile'" class="loading-box">
                <div class="loading-row">
                  <div class="spinner spinner-lg"></div>
                  <div>
                    <div class="loading-title">正在提取患者画像 · 计算 ESGO 风险分层...</div>
                    <div class="loading-sub">调用 /api/v1/analyze/profile-only，约需 5–15 秒</div>
                  </div>
                </div>
                <div class="skeleton-stack">
                  <div class="skeleton" style="height:14px;width:88%"></div>
                  <div class="skeleton" style="height:14px;width:72%"></div>
                  <div class="skeleton" style="height:14px;width:80%"></div>
                  <div class="skeleton" style="height:14px;width:65%"></div>
                </div>
              </div>
            </Transition>

            <!-- Full result -->
            <Transition name="slide-up">
              <div v-if="store.profileResult && phase === 'idle' && store.mode !== 'independent'" class="result-body">

                <!-- FIGO + ESGO 双卡 -->
                <div class="staging-dual-row">
                  <div class="staging-card figo-card">
                    <div class="staging-card-top">
                      <span class="staging-sys-label">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        FIGO 分期
                      </span>
                      <span class="figo-primary-badge">主要诊断</span>
                    </div>
                    <div
                      class="figo-stage-value"
                      :contenteditable="isEditing"
                      :class="{ 'editable-field': isEditing }"
                      ref="figoEl"
                    >{{ store.profileResult.figo_stage || '—' }}</div>
                    <div class="staging-card-desc">国际妇产科联合会分期标准（2023）</div>
                  </div>

                  <div class="staging-card esgo-card" :class="esgoColorClass">
                    <div class="staging-card-top">
                      <span class="staging-sys-label">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        ESGO 风险分层
                      </span>
                    </div>
                    <div v-if="!isEditing" class="esgo-stage-value">
                      {{ store.profileResult.esgo_risk_classification }}
                    </div>
                    <select v-else v-model="esgoEdit" class="esgo-stage-value esgo-select-edit">
                      <option v-for="opt in ['低危','中危','中高危','高危','未知']" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <div class="staging-card-desc">欧洲妇科肿瘤学会风险分级</div>
                  </div>
                </div>

                <!-- FIGO 原始推理过程（最终结果中也保留） -->
                <div v-if="figoResult?.raw_output" class="figo-raw-block">
                  <details class="figo-raw-details" :open="figoDetailsOpen" @toggle="figoDetailsOpen = $event.target.open">
                    <summary>{{ figoDetailsOpen ? '收起模型原始推理过程' : '查看模型原始推理过程' }}</summary>
                    <pre class="figo-raw-text">{{ figoResult.raw_output }}</pre>
                  </details>
                </div>

                <!-- Patient Profile -->
                <div class="profile-block">
                  <div class="block-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                    全息患者画像
                  </div>
                  <div
                    class="profile-md"
                    :class="{ 'editable-field': isEditing }"
                    :contenteditable="isEditing"
                    ref="profileEl"
                  >{{ store.profileResult.patient_profile_md }}</div>
                </div>

                <!-- Keywords 折叠 -->
                <div class="keywords-block">
                  <button class="keywords-toggle" @click="keywordsOpen = !keywordsOpen">
                    <div class="block-label" style="margin-bottom:0">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      双语检索词
                    </div>
                    <div class="keywords-toggle-right">
                      <span class="keywords-toggle-hint">{{ keywordsOpen ? '收起' : '展开查看' }}</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                        :style="{ transform: keywordsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }"
                      ><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </button>
                  <Transition name="collapse">
                    <div v-if="keywordsOpen" class="keywords-content">
                      <pre class="keywords-text">{{ store.profileResult.bilingual_keywords }}</pre>
                    </div>
                  </Transition>
                </div>

                <!-- Edit reason -->
                <Transition name="slide-up">
                  <div v-if="isEditing" class="edit-reason">
                    <label class="form-label">修改原因</label>
                    <textarea v-model="editReason" class="form-textarea" rows="2" placeholder="例如：ESGO风险分层有误，应为中高危..."></textarea>
                  </div>
                </Transition>

                <!-- CTA -->
                <div class="cta-row">
                  <button class="btn btn-cta cta-btn" @click="confirmAndNext">
                    确认分析结果，进入下一步：患者档案确认
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                </div>

              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 提升确认弹窗 ─────────────────────────────── -->
    <Transition name="fade">
      <div v-if="showPromoteDialog" class="promote-overlay" @click.self="showPromoteDialog = false">
        <div class="promote-dialog">
          <div class="promote-dialog-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="promote-dialog-title">加入病例列表</div>
          <div class="promote-dialog-body">
            分期列表中还有 <strong>{{ promoteOtherCount }}</strong> 条其他记录，是否一并加入病例列表？
          </div>
          <div class="promote-dialog-actions">
            <button class="promote-dialog-btn promote-dialog-btn-secondary" @click="showPromoteDialog = false">取消</button>
            <button class="promote-dialog-btn promote-dialog-btn-outline" @click="doPromoteSingle">仅此一条</button>
            <button class="promote-dialog-btn promote-dialog-btn-primary" @click="doPromoteAll">
              全部加入 ({{ store.stagingHistory.length }})
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiagnosisStore } from '../stores/diagnosis'
import { apiFigoStage, apiProfileOnly, parseUploadedFile } from '../api/index'

const store = useDiagnosisStore()
const router = useRouter()

const pathologyText = ref(store.pathologyText)

// 'idle' | 'figo' | 'profile'
const phase = ref('idle')

const figoResult = ref(null)     // { figo_stage, raw_output }
const apiError = ref('')
const isEditing = ref(false)
const editReason = ref('')
const parsing = ref(false)
const figoEl = ref(null)
const profileEl = ref(null)
const keywordsOpen = ref(false)
const figoDetailsOpen = ref(true)  // 推理过程默认展开
const esgoEdit = ref('')

watch(pathologyText, v => store.setPathologyText(v))

/** 从 store 同步本地 UI 状态（挂载、切换病例、自动执行结果查看等场景均会调用） */
function syncFromStore() {
  pathologyText.value = store.pathologyText || ''
  phase.value = 'idle'
  // 从 store 恢复 FIGO 推理输出（跨病例切换 / 自动执行结果查看不丢失）
  if (store.figoRawOutput) {
    // 优先从 profileResult 取 FIGO 分期；独立模式下 profileResult 可能为空，
    // 此时从当前分期历史条目中取。
    const stage = store.profileResult?.figo_stage
      || store.stagingHistory.find(e => e.id === store.activeCaseId)?.figoStage
      || store.figoStage
      || ''
    figoResult.value = { figo_stage: stage, raw_output: store.figoRawOutput }
  } else {
    figoResult.value = null
  }
  apiError.value = ''
  isEditing.value = false
  editReason.value = ''
  parsing.value = false
  keywordsOpen.value = false
  figoDetailsOpen.value = true
  esgoEdit.value = ''
}

onMounted(() => {
  syncFromStore()
})

// ── 切换病例时重置本地 UI 状态 ──────────────────────────────
watch(() => store.activeCaseId, () => {
  syncFromStore()
})

const textareaPlaceholder = computed(() => {
  if (store.isImported) return '已从导入文件自动填充病理报告...'
  return `请粘贴完整的术后病理报告文本，或点击右上角"导入病历文件"上传 Word/PDF/txt 文件

示例：
术后病理（2024-10-22）：
子宫内膜样腺癌，G2（中分化）
肌层浸润深度：>1/2 肌层
宫颈间质：受累
脉管浸润（LVSI）：阳性
淋巴结：盆腔 LN 1/15（+），腹主动脉旁 LN 0/8（-）
腹腔冲洗液细胞学：阴性
免疫组化：p53（突变型），MLH1（+），MSH2（+），MSH6（+），PMS2（+）`
})

const esgoColorClass = computed(() => {
  const v = store.profileResult?.esgo_risk_classification || ''
  if (v.includes('高危') || v.includes('High Risk')) return 'esgo-high'
  if (v.includes('中高危') || v.includes('High-Inter')) return 'esgo-high-inter'
  if (v.includes('中危') || v.includes('Intermediate')) return 'esgo-inter'
  if (v.includes('低危') || v.includes('Low')) return 'esgo-low'
  return 'esgo-unknown'
})

// ─── File Import ────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

async function handleFileImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > MAX_FILE_SIZE) {
    apiError.value = `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限为 50MB`
    e.target.value = ''
    return
  }
  apiError.value = ''
  parsing.value = true
  e.target.value = ''
  try {
    const rawText = await parseUploadedFile(file)
    store.setImportedFile({ fileName: file.name, rawText, pathologySection: rawText, clinicalData: null })
    pathologyText.value = rawText
  } catch (err) {
    apiError.value = err.message
  } finally {
    parsing.value = false
  }
}

function handleClearImport() {
  store.clearImport()
  syncFromStore()
}

// ─── 一键流水线：FIGO 分期 → 患者画像 ───────────────────────────────────────
async function runFullPipeline() {
  if (!pathologyText.value.trim() || phase.value !== 'idle') return
  apiError.value = ''

  // Step A：FIGO 分期
  phase.value = 'figo'
  try {
    const patientCase = store.effectivePatientCase || pathologyText.value
    figoResult.value = await apiFigoStage(patientCase)
    store.figoRawOutput = figoResult.value?.raw_output || ''
    store.figoStage = figoResult.value?.figo_stage || ''
    store.confirmPatientCase(patientCase)
  } catch (err) {
    apiError.value = `FIGO 分期失败：${err.message}`
    figoResult.value = null
    store.figoRawOutput = ''
    phase.value = 'idle'
    return
  }

  // Step B：患者画像
  phase.value = 'profile'
  try {
    const patientCase = store.effectivePatientCase || pathologyText.value
    const profileData = await apiProfileOnly(patientCase)
    profileData.figo_stage = figoResult.value.figo_stage || extractFigoStage(profileData.patient_profile_md || '')
    await store.setProfileResult(profileData)
  } catch (err) {
    apiError.value = `画像提取失败：${err.message}`
  } finally {
    phase.value = 'idle'
  }
}

// ─── Step A：FIGO 分期（单独调用） ──────────────────────────────────────────
async function runFigoStage() {
  if (!pathologyText.value.trim() || phase.value !== 'idle') return
  apiError.value = ''
  phase.value = 'figo'
  try {
    const patientCase = store.effectivePatientCase || pathologyText.value
    figoResult.value = await apiFigoStage(patientCase)
    store.figoRawOutput = figoResult.value?.raw_output || ''
    store.figoStage = figoResult.value?.figo_stage || ''
    console.log('✅ [FIGO] 分期结果', figoResult.value)
    store.confirmPatientCase(patientCase)
    // 独立模式：自动注入到临时分期历史（sessionStorage），不进入正式病例列表
    // overwriteId 确保重试时覆盖当前条目而非新增
    if (store.mode === 'independent') {
      store.addStagingResult({
        label: store.activeCaseLabel || store.autoLabel(),
        figoStage: figoResult.value?.figo_stage || '',
        figoRawOutput: figoResult.value?.raw_output || '',
        pathologyText: pathologyText.value,
        patientCase: patientCase,
        overwriteId: store.activeCaseId,
      })
    }
  } catch (err) {
    apiError.value = `FIGO 分期失败：${err.message}`
    figoResult.value = null
    store.figoRawOutput = ''
  } finally {
    phase.value = 'idle'
  }
}

// ─── Step B：患者画像 ────────────────────────────────────────────────────────
async function runProfileOnly() {
  if (!figoResult.value || phase.value !== 'idle') return
  apiError.value = ''
  phase.value = 'profile'
  try {
    const patientCase = store.effectivePatientCase || pathologyText.value
    const profileData = await apiProfileOnly(patientCase)

    // 将 FIGO 分期（来自专用模型）合并进画像结果
    profileData.figo_stage = figoResult.value.figo_stage || extractFigoStage(profileData.patient_profile_md || '')

    console.log('✅ [Profile] 画像提取结果', profileData)
    await store.setProfileResult(profileData)
  } catch (err) {
    apiError.value = `画像提取失败：${err.message}`
  } finally {
    phase.value = 'idle'
  }
}

// ─── Reset ───────────────────────────────────────────────────────────────────
async function handleReset() {
  figoResult.value = null
  store.figoRawOutput = ''
  apiError.value = ''
  await store.setProfileResult(null)
}

// ─── Edit ────────────────────────────────────────────────────────────────────
function startEdit() {
  isEditing.value = true
  esgoEdit.value = store.profileResult?.esgo_risk_classification || ''
}
async function saveEdit() {
  if (store.profileResult) {
    const updated = { ...store.profileResult }
    updated.esgo_risk_classification = esgoEdit.value
    if (figoEl.value) updated.figo_stage = figoEl.value.textContent.trim()
    if (profileEl.value) updated.patient_profile_md = profileEl.value.textContent.trim()
    await store.setProfileResult(updated)
  }
  isEditing.value = false
}

// ─── Navigation ─────────────────────────────────────────────────────────────
async function confirmAndNext() {
  await store.persist()
  store.setStep(2)
  router.push(store.mode === 'sequential' ? '/profile' : '/treatment')
}


// ─── 独立模式：升格为正式病例并继续 ────────────────────────
const showPromoteDialog = ref(false)

// 弹窗中显示的"其他记录"数量 = 总条目数 - 当前激活条目（如果有的话）
const promoteOtherCount = computed(() => {
  const total = store.stagingHistory.length
  // 当前激活条目在列表中则 -1，否则就是全部
  const activeInList = store.stagingHistory.some(e => e.id === store.activeCaseId)
  return activeInList ? total - 1 : total
})

function promoteAndContinue() {
  if (!store.activeCaseId) return
  // 如果分期列表中还有其他条目，弹出确认框
  if (promoteOtherCount.value > 0) {
    showPromoteDialog.value = true
    return
  }
  // 只有一条记录，直接执行
  doPromoteSingle()
}

/** 仅提升当前激活的一条分期记录 */
async function doPromoteSingle() {
  showPromoteDialog.value = false
  const entry = store.stagingHistory.find(e => e.id === store.activeCaseId)
  const pathology = entry?.pathologyText || pathologyText.value
  const figoRaw = entry?.figoRawOutput || figoResult.value?.raw_output || ''
  const figoStage = entry?.figoStage || figoResult.value?.figo_stage || ''
  const ok = await store.promoteToCaseList(store.activeCaseId)
  if (ok) {
    store.setPathologyText(pathology)
    store.figoRawOutput = figoRaw
    store.figoStage = figoStage
    store.confirmPatientCase(entry?.patientCase || pathology)
    await store.setMode('sequential')
    store.setStep(1)
    router.push('/figo')
  }
}

/** 将分期列表中全部条目提升为正式病例 */
async function doPromoteAll() {
  showPromoteDialog.value = false
  // 先捕获当前激活条目的数据（promote 会从 stagingHistory 中移除）
  const entry = store.stagingHistory.find(e => e.id === store.activeCaseId)
  const pathology = entry?.pathologyText || pathologyText.value
  const figoRaw = entry?.figoRawOutput || figoResult.value?.raw_output || ''
  const figoStage = entry?.figoStage || figoResult.value?.figo_stage || ''
  // 按顺序提升所有条目
  const allIds = store.stagingHistory.map(e => e.id)
  for (const id of allIds) {
    await store.promoteToCaseList(id)
  }
  // 注入数据并切换到连续模式
  store.setPathologyText(pathology)
  store.figoRawOutput = figoRaw
  store.figoStage = figoStage
  store.confirmPatientCase(entry?.patientCase || pathology)
  await store.setMode('sequential')
  store.setStep(1)
  router.push('/figo')
}

// 从 patient_profile_md 中提取 FIGO 分期（兜底用）
function extractFigoStage(md) {
  const plain = md.replace(/\*\*/g, '')
  const m = plain.match(/既定分期\s*[：:]\s*(.+)/m)
  return m ? m[1].trim() : '未提及'
}
</script>

<style scoped>
.figo-page { min-height: 100vh; padding: 24px 24px 48px; }
.page-wrap { max-width: 1380px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }

/* ── Header ─────────────────────────────────────────────── */
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
}
.page-header-left { display: flex; flex-direction: column; gap: 2px; }
.page-title { font-size: 24px; margin-top: 2px; }
.page-sub { font-size: 13px; color: var(--text-secondary); margin-top: 3px; }
.header-figo-badge {
  display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
  padding: 10px 16px; background: var(--accent-blue-light);
  border: 1px solid var(--accent-blue-mid); border-radius: var(--radius-md);
  flex-shrink: 0;
}
.badge-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.badge-figo { font-size: 17px; font-weight: 700; font-family: var(--font-serif); color: var(--accent-blue); }

/* ── Two-column layout ──────────────────────────────────── */
.two-col {
  display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: stretch;
}
.col-left, .col-right { display: flex; flex-direction: column; min-height: 0; }
.card { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.result-card { height: 100%; overflow-y: auto; }

/* ── Pipeline button area ───────────────────────────────── */
.btn-pipeline {
  display: flex; flex-direction: column; align-items: stretch; gap: 6px;
  margin: 10px 16px 16px; flex-shrink: 0;
}
.btn-full { width: 100%; justify-content: center; padding: 12px 16px; font-size: 14px; }

/* ── Progress track ─────────────────────────────────────── */
.pipeline-track {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; background: var(--bg-2);
  border: 1px solid var(--border); border-radius: var(--radius-md);
}
.pipeline-step {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: var(--text-muted);
  transition: color 0.2s;
}
.pipeline-step.active { color: var(--accent-blue); font-weight: 600; }
.pipeline-step.done { color: var(--accent-green); font-weight: 600; }
.pipeline-step-icon {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-1); border: 1.5px solid var(--border-md);
  flex-shrink: 0; color: inherit;
}
.pipeline-step.active .pipeline-step-icon {
  border-color: var(--accent-blue); background: var(--accent-blue-light);
}
.pipeline-step.done .pipeline-step-icon {
  border-color: var(--accent-green-mid); background: var(--accent-green-light);
}
.pipeline-step-num { font-size: 11px; font-weight: 700; }
.pipeline-step-label { white-space: nowrap; }
.pipeline-conn {
  flex: 1; height: 1.5px; background: var(--border-md); border-radius: 2px;
  transition: background 0.3s; min-width: 16px;
}
.pipeline-conn.filled { background: var(--accent-green-mid); }
.reset-btn { margin-top: 4px; align-self: center; font-size: 12px; }

/* ── FIGO preview box（分期完成，画像未提取时） ───────────── */
.figo-preview-box {
  margin: 16px 18px; padding: 16px;
  background: var(--accent-blue-light); border: 1px solid var(--accent-blue-mid);
  border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 10px;
  flex: 1;
}
.figo-promote-row { margin-top: auto; }
.figo-preview-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--accent-green); text-transform: uppercase; letter-spacing: 0.05em;
}
.figo-preview-stage {
  font-size: 32px; font-weight: 700; font-family: var(--font-serif);
  color: var(--accent-blue); line-height: 1.2;
}
.figo-raw-block {
  margin: 0 18px;
}
.figo-raw-details {
  font-size: 12px; color: var(--text-secondary);
}
.figo-raw-details summary {
  cursor: pointer; color: var(--text-muted); user-select: none;
  margin-bottom: 6px;
}
.figo-raw-text {
  max-height: 240px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
  font-size: 13px; line-height: 1.75; color: var(--text-secondary);
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 12px 14px; margin: 0;
}

/* 预览框中 details/pre 拉伸填满剩余空间 */
.figo-preview-box > .figo-raw-details {
  flex: 1; display: flex; flex-direction: column; min-height: 0;
}
.figo-preview-box > .figo-raw-details .figo-raw-text {
  flex: 1; max-height: 240px; min-height: 120px;
}
.figo-preview-hint {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-secondary);
}

/* ── Staging dual row ───────────────────────────────────── */
.staging-dual-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  padding: 14px 18px 0;
}
.staging-card {
  border: 1px solid var(--border-md); border-radius: var(--radius-md);
  padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
}
.figo-card { background: var(--accent-blue-light); border-color: var(--accent-blue-mid); }
.staging-card-top { display: flex; align-items: center; justify-content: space-between; }
.staging-sys-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted);
}
.figo-primary-badge {
  font-size: 10px; font-weight: 600; padding: 2px 6px;
  background: var(--accent-blue); color: #fff; border-radius: 99px;
}
.figo-stage-value {
  font-size: 34px; font-weight: 700; font-family: var(--font-serif);
  color: var(--accent-blue); line-height: 1.2;
}
.staging-card-desc { font-size: 11px; color: var(--text-muted); }

/* ── ESGO card colors ───────────────────────────────────── */
.esgo-stage-value {
  font-size: 26px; font-weight: 700; font-family: var(--font-serif); line-height: 1.3;
}
.esgo-high       { background: var(--accent-rose-light);  border-color: var(--accent-rose-mid);  color: var(--accent-rose); }
.esgo-high-inter { background: var(--accent-amber-light); border-color: var(--accent-amber-mid); color: var(--accent-amber); }
.esgo-inter      { background: var(--accent-blue-light);  border-color: var(--accent-blue-mid);  color: var(--accent-blue); }
.esgo-low        { background: var(--accent-green-light); border-color: var(--accent-green-mid); color: var(--accent-green); }
.esgo-unknown    { background: var(--bg-2); border-color: var(--border-md); color: var(--text-secondary); }
.esgo-select-edit {
  font-size: 26px; font-weight: 700; font-family: var(--font-serif); line-height: 1.3;
  border: 1px dashed var(--accent-blue); border-radius: var(--radius-sm);
  padding: 4px 8px; background: transparent; color: inherit; width: 100%; box-sizing: border-box; cursor: pointer;
}
.esgo-select-edit:focus { outline: 2px solid var(--accent-blue); border-style: solid; }

/* ── Import Banner ──────────────────────────────────────── */
.import-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 16px; background: var(--accent-green-light); border-bottom: 1px solid var(--accent-green-mid);
}
.import-banner-info { display: flex; align-items: center; gap: 10px; }
.import-icon {
  width: 28px; height: 28px; background: var(--accent-green); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
}
.import-filename { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.import-hint { font-size: 12px; color: var(--text-secondary); margin-top: 1px; }

/* ── Card header / section ──────────────────────────────── */
.card-section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.card-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--text-secondary);
}
.import-file-btn { cursor: pointer; }
.import-file-btn.loading { pointer-events: none; }
.char-count {
  position: absolute; bottom: 8px; right: 20px;
  font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);
}
.char-count.warn { color: var(--accent-amber); }
.file-hint {
  display: flex; align-items: flex-start; gap: 5px;
  margin: 0 16px 10px; padding: 8px 10px;
  background: var(--bg-2); border-radius: var(--radius-sm);
  font-size: 12px; color: var(--text-secondary); line-height: 1.5; flex-shrink: 0;
}
.parse-error {
  display: flex; align-items: center; gap: 6px;
  margin: 0 16px 10px; padding: 8px 10px;
  background: var(--accent-rose-light); border: 1px solid var(--accent-rose-mid);
  border-radius: var(--radius-sm); font-size: 12px; color: var(--accent-rose); flex-shrink: 0;
}

/* ── Result card header ─────────────────────────────────── */
.result-card-header {
  padding: 14px 18px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.result-header-actions { display: flex; align-items: center; gap: 8px; }
.panel-title-row { display: flex; align-items: center; justify-content: space-between; }
.panel-title { font-size: 15px; font-weight: 700; }

/* ── Empty / Loading ────────────────────────────────────── */
.empty-state {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 14px; min-height: 320px; padding: 40px;
}
.empty-icon {
  width: 60px; height: 60px; background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-xl); display: flex; align-items: center; justify-content: center; color: var(--text-muted);
}
.empty-text { font-size: 14px; color: var(--text-muted); text-align: center; line-height: 1.7; }
.loading-box { padding: 24px 18px; display: flex; flex-direction: column; gap: 20px; }
.loading-row { display: flex; align-items: center; gap: 14px; }
.loading-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.loading-sub { font-size: 12px; color: var(--text-secondary); margin-top: 3px; }
.skeleton-stack { display: flex; flex-direction: column; gap: 10px; }

/* ── Result body ────────────────────────────────────────── */
.result-body { display: flex; flex-direction: column; gap: 14px; padding-bottom: 18px; }
.block-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 7px;
}
.profile-block {
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 12px 14px; margin: 0 18px;
}
.profile-md {
  font-size: 13px; line-height: 1.75; color: var(--text-secondary);
  white-space: pre-wrap; max-height: 240px; overflow-y: auto;
}

/* ── Keywords ───────────────────────────────────────────── */
.keywords-block {
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: var(--radius-md); overflow: hidden; margin: 0 18px;
}
.keywords-toggle {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px; background: transparent; border: none; cursor: pointer; color: inherit;
}
.keywords-toggle:hover { background: var(--bg-2); }
.keywords-toggle-right { display: flex; align-items: center; gap: 5px; }
.keywords-toggle-hint { font-size: 11px; color: var(--text-muted); }
.keywords-content { border-top: 1px solid var(--border); padding: 10px 14px 12px; }
.keywords-text {
  font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);
  line-height: 1.7; white-space: pre-wrap; word-break: break-word; margin: 0;
}

/* ── Edit / CTA ─────────────────────────────────────────── */
.editable-field {
  border: 1px dashed var(--accent-blue); border-radius: var(--radius-sm); padding: 4px 8px;
  cursor: text; outline: none; min-height: 20px;
}
.edit-reason { display: flex; flex-direction: column; gap: 5px; margin: 0 18px; }
.cta-row { margin-top: auto; padding: 0 18px; }
.cta-btn { width: 100%; justify-content: center; }

/* ── Textarea ───────────────────────────────────────────── */
.textarea-wrap { position: relative; flex: 1; padding: 12px 16px 10px; display: flex; flex-direction: column; }
.pathology-textarea { width: 100%; flex: 1; resize: none; box-sizing: border-box; }

/* ── Collapse ───────────────────────────────────────────── */
.collapse-enter-active, .collapse-leave-active {
  transition: opacity 0.2s ease, max-height 0.25s ease; overflow: hidden; max-height: 400px;
}
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; }

/* ── Transitions ────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active { transition: opacity 0.25s, transform 0.25s; }
.slide-up-enter-from { opacity: 0; transform: translateY(8px); }

/* ── Promote confirmation dialog ─────────────────────── */
.promote-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
}
.promote-dialog {
  width: 380px; max-width: 90vw;
  background: var(--bg-0, #fff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
  padding: 28px 28px 22px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  text-align: center;
}
.promote-dialog-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--accent-amber-light, #fffbeb);
  color: var(--accent-amber, #d97706);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.promote-dialog-title {
  font-size: 16px; font-weight: 700;
  color: var(--text-primary, #1e293b);
}
.promote-dialog-body {
  font-size: 13px; line-height: 1.65;
  color: var(--text-secondary, #475569);
  padding: 0 8px;
}
.promote-dialog-body strong {
  color: var(--text-primary, #1e293b);
  font-weight: 700;
}
.promote-dialog-actions {
  display: flex; gap: 8px; width: 100%;
  margin-top: 4px;
}
.promote-dialog-btn {
  flex: 1; padding: 8px 12px;
  border-radius: var(--radius-sm, 6px);
  font-size: 13px; font-weight: 600;
  cursor: pointer; border: 1px solid transparent;
  transition: all 0.15s;
}
.promote-dialog-btn-primary {
  background: var(--accent-blue, #2563eb);
  color: #fff; border-color: var(--accent-blue, #2563eb);
}
.promote-dialog-btn-primary:hover {
  background: var(--accent-blue-dark, #1d4ed8);
}
.promote-dialog-btn-outline {
  background: transparent;
  color: var(--accent-blue, #2563eb);
  border-color: var(--accent-blue-mid, #93c5fd);
}
.promote-dialog-btn-outline:hover {
  background: var(--accent-blue-light, #eff6ff);
}
.promote-dialog-btn-secondary {
  background: var(--bg-2, #f1f5f9);
  color: var(--text-muted, #94a3b8);
  border-color: var(--border-md, #e2e8f0);
}
.promote-dialog-btn-secondary:hover {
  background: var(--bg-3, #e2e8f0);
  color: var(--text-secondary, #475569);
}
</style>
