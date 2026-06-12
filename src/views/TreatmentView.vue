<template>
  <div class="treatment-page">
    <div class="page-wrap">

      <!-- Header -->
      <div class="pg-header">
        <div>
          <div class="pg-step">STEP 02</div>
          <h1 class="pg-title">方案生成</h1>
          <p class="pg-sub">基于 ESGO 2025 / NCCN 指南生成个性化 MDT 治疗方案，结合知识图谱检索与相似病例</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" @click="goBack">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            返回患者档案
          </button>
        </div>
      </div>

      <!-- Main 3-col grid -->
      <div class="main-grid">

        <!-- ═══ LEFT: Patient context ═══ -->
        <div class="left-col">

          <!-- ESGO + profile summary -->
          <div v-if="store.profileResult" class="card ctx-card">
            <div class="ctx-hdr">
              <span class="ctx-title">患者信息摘要</span>
              <div class="ctx-badges">
                <span v-if="figoStageText" class="figo-chip">{{ figoStageText }}</span>
                <span class="esgo-chip" :class="esgoChipClass">{{ store.profileResult.esgo_risk_classification }}</span>
              </div>
            </div>
            <div class="ctx-profile">{{ store.profileResult.patient_profile_md }}</div>
          </div>

          <!-- Manual input if no profile -->
          <div v-else class="card manual-card">
            <div class="manual-warn">
              <svg width="13" height="13" style="color:var(--accent-amber);flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              未从分期模块携带数据，请手动填写核心信息
            </div>
            <div class="form-field">
              <label class="form-label">FIGO 分期</label>
              <select v-model="manualFigo" class="form-select">
                <option value="">请选择</option>
                <option v-for="s in figoStages" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <!-- Comorbidity chips -->
          <div v-if="comorbidityChips.length" class="card chips-card">
            <div class="chips-title">合并症</div>
            <div class="chips-row">
              <span v-for="c in comorbidityChips" :key="c.label" class="comor-chip" :class="c.cls">{{ c.label }}</span>
            </div>
          </div>

        </div>

        <!-- ═══ CENTRE: MDT Report ═══ -->
        <div class="centre-col">
          <div class="card report-card">
            <!-- Report tabs -->
            <div class="tab-row">
              <button v-for="t in tabs" :key="t.key" class="rtab" :class="{ active: activeTab === t.key }" @click="activeTab = t.key">
                {{ t.label }}
                <span v-if="t.key === 'bib' && bib.length" class="tab-badge">{{ bib.length }}</span>
                <span v-if="t.key === 'similar' && similar.length" class="tab-badge">{{ similar.length }}</span>
              </button>
            </div>

            <!-- MDT Report -->
            <div v-if="activeTab === 'mdt'" class="tab-body">
              <div v-if="!mdtText && !isRunning" class="state-box">
                <div class="state-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
                </div>
                <p class="state-txt">点击"生成 MDT 治疗方案"<br>AI 将实时流式输出完整报告</p>
              </div>
              <div v-if="isRunning && !mdtText" class="skel-wrap">
                <div class="skel-stack"><div v-for="i in 6" :key="i" class="skeleton" :style="{height:'13px',width:(55+i*6)+'%'}"></div></div>
              </div>
              <div v-if="mdtText" class="report-body">

              <!-- 流式阶段：纯文本 -->
              <div
                v-if="store.mdtStreaming"
                class="streaming-raw-wrap"
              >
                <div class="streaming-status">
                  <div class="streaming-spinner"></div>
                  MDT 正在生成中...
                </div>

                <pre class="streaming-raw">{{ mdtText }}</pre>
              </div>

              <!-- 编辑模式 -->
              <div
                v-if="isEditing"
                class="mdt-editor-wrap"
              >

                <div class="editor-toolbar">

                  <div class="editor-title">
                    MDT Report Editor
                  </div>

                  <div class="editor-actions">
                    <button
                      class="btn btn-secondary btn-sm"
                      @click="cancelEdit"
                    >
                      取消
                    </button>
                    <button
                      class="btn btn-teal btn-sm"
                      @click="saveEditedReport"
                    >
                      保存修改
                    </button>

                  </div>
                </div>

                <textarea
                  v-model="store.editableMdtReport"
                  class="mdt-editor"
                />

              </div>

              <!-- 展示模式（流式结束后才显示） -->
              <MdtReportRenderer
                v-if="!store.mdtStreaming"
                :markdown="store.editableMdtReport || mdtText"
                :streaming="store.mdtStreaming"
                :loading="isRunning && !mdtText"
              />

            </div>
              <div v-if="mdtText && !store.mdtStreaming" class="report-footer">
                <button class="btn btn-secondary btn-sm" @click="copyMdt">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  复制报告
                </button>
                <button class="btn btn-secondary btn-sm" @click="toggleEdit">
                  <svg width="12" height="12" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                  {{ isEditing ? '退出编辑' : '调整方案' }}
                </button>
              </div>
            </div>

            <!-- Bibliography -->
            <div v-if="activeTab === 'bib'" class="tab-body">
              <div v-if="!bib.length" class="state-box"><p class="state-txt">方案生成后显示引用文献</p></div>
              <div v-else class="bib-list">
                <div v-for="e in bib" :key="e.ref_index" class="bib-entry">
                  <span class="bib-num">[{{ e.ref_index }}]</span>
                  <div>
                    <div class="bib-title">{{ e.title }}</div>
                    <div class="bib-meta">
                      <span v-if="e.guidelines" class="tag tag-teal" style="font-size:11px">{{ e.guidelines }}</span>
                      <span v-if="e.pmid" class="bib-pmid font-mono">PMID: {{ e.pmid }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Similar patients -->
            <div v-if="activeTab === 'similar'" class="tab-body">
              <div v-if="!similar.length" class="state-box"><p class="state-txt">方案生成后显示相似病例</p></div>
              <div v-else class="similar-list">
                <div v-for="(p,i) in similar" :key="p.patient_id" class="sim-card">
                  <!-- Card header -->
                  <div class="sim-card-hdr">
                    <div class="sim-badge">
                      <span class="sim-index">{{ i+1 }}</span>
                    </div>
                    <div class="sim-title-block">
                      <span class="sim-title">相似病例 #{{ i+1 }}</span>
                      <span class="sim-id">ID: {{ p.patient_id }}</span>
                    </div>
                    <div class="sim-score-block">
                      <div class="sim-score-label">相似度</div>
                      <div class="sim-score-value">{{ (100 / (1 + p.distance)).toFixed(1) }}%</div>
                    </div>
                  </div>
                  <!-- Similarity progress bar -->
                  <div class="sim-bar-wrap">
                    <div class="sim-bar-bg">
                      <div class="sim-bar-fill" :style="{width: ((1-p.distance)*100).toFixed(1)+'%', background: simBarColor(1-p.distance)}"></div>
                    </div>
                  </div>
                  <!-- Description -->
                  <div class="sim-desc-block">
                    <div class="sim-sec-label">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      病例描述
                    </div>
                    <div class="sim-desc">{{ p.description }}</div>
                  </div>
                  <!-- Treatment -->
                  <div v-if="p.historical_treatment" class="sim-tx-block">
                    <div class="sim-sec-label sim-tx-label">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      历史治疗方案
                    </div>
                    <div class="sim-tx">{{ p.historical_treatment }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Comorbidity screening -->
            <div v-if="activeTab === 'comorbidity'" class="tab-body">
              <div v-if="!comorbidityData" class="state-box"><p class="state-txt">方案生成后显示合并症药学筛查</p></div>
              <div v-else class="comor-report">
                <!-- Safety Warnings -->
                <div class="comor-sec">
                  <div class="comor-sec-hdr rose-hdr">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                    安全预警
                    <span v-if="comorbidityData.safety_warnings?.length" class="comor-count rose-count">{{ comorbidityData.safety_warnings.length }}</span>
                  </div>
                  <div v-if="!comorbidityData.safety_warnings?.length" class="comor-empty">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    未发现安全预警，用药风险可控
                  </div>
                  <ul v-else class="comor-ul rose-ul"><li v-for="w in comorbidityData.safety_warnings" :key="w">{{ w }}</li></ul>
                </div>
                <!-- Deescalation Advice -->
                <div class="comor-sec">
                  <div class="comor-sec-hdr amber-hdr">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    方案降级建议
                    <span v-if="comorbidityData.deescalation_advice?.length" class="comor-count amber-count">{{ comorbidityData.deescalation_advice.length }}</span>
                  </div>
                  <div v-if="!comorbidityData.deescalation_advice?.length" class="comor-empty">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    暂无降级建议，当前方案强度适宜
                  </div>
                  <ul v-else class="comor-ul amber-ul"><li v-for="a in comorbidityData.deescalation_advice" :key="a">{{ a }}</li></ul>
                </div>
                <!-- Monitoring -->
                <div class="comor-sec">
                  <div class="comor-sec-hdr">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    监测建议
                    <span v-if="comorbidityData.monitoring_recommendations?.length" class="comor-count blue-count">{{ comorbidityData.monitoring_recommendations.length }}</span>
                  </div>
                  <div v-if="!comorbidityData.monitoring_recommendations?.length" class="comor-empty">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    无特殊监测要求，按常规随访即可
                  </div>
                  <ul v-else class="comor-ul"><li v-for="m in comorbidityData.monitoring_recommendations" :key="m">{{ m }}</li></ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ RIGHT: Progress panel ═══ -->
        <div class="right-col">
          <div class="card progress-card">
            <div class="prog-hdr">
              <div class="prog-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Pipeline 进度
              </div>
              <div v-if="isRunning" class="thinking-pill">
                <div class="spinner" style="width:12px;height:12px;border-width:2px"></div>
                Thinking...
              </div>
            </div>

            <div class="stages-list">
              <div v-for="s in stages" :key="s.key" class="stage-row" :class="`stage-${s.status}`">
                <div class="stage-ico">
                  <div v-if="s.status === 'running'" class="spinner" style="width:13px;height:13px;border-width:2px"></div>
                  <svg v-else-if="s.status === 'done'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg v-else-if="s.status === 'error'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <div v-else class="stage-pending-dot"></div>
                </div>
                <div class="stage-info">
                  <span class="stage-lbl">{{ s.label }}</span>
                  <span v-if="s.extra" class="stage-extra">{{ s.extra }}</span>
                </div>
              </div>
            </div>

            <!-- XGB Predictions debug -->
            <div v-if="xgbPreds && Object.keys(xgbPreds).length" class="xgb-debug">
              <div class="xgb-title">XGBoost 预测</div>
              <div v-for="(v,k) in xgbPreds" :key="k" class="xgb-row">
                <span class="xgb-key">{{ k }}</span>
                <span class="xgb-val" :class="v===1?'xgb-yes':'xgb-no'">{{ v===1?'推荐':'不推荐' }}</span>
              </div>
            </div>

            <!-- 操作按钮区 -->
            <div class="right-actions">
              <button v-if="!isRunning && !mdtText" class="btn btn-cta right-gen-btn" :disabled="!canGenerate" @click="startAnalysis">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                生成 MDT 治疗方案
              </button>
              <button v-if="isRunning" class="btn btn-secondary right-stop-btn" @click="stopAnalysis">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                停止生成
              </button>
              <button v-if="mdtText && !isRunning" class="btn btn-secondary btn-sm right-regen-btn" @click="reGenerate">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.86"/></svg>
                重新生成
              </button>
            </div>
          </div>

          <!-- 下一步按钮 -->
          <div v-if="mdtText" class="next-step-wrap">
            <button class="btn btn-teal next-step-btn" @click="goToEvidence">
              确认方案，进入证据合成
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toastMsg" class="toast" :class="`toast-${toastType}`">{{ toastMsg }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDiagnosisStore } from '../stores/diagnosis'
import { apiAnalyzeStream } from '../api/index'
import { renderMd } from '../utils/markdown.js'
import MdtReportRenderer from '../components/MdtReportRenderer.vue'
const store  = useDiagnosisStore()
const router = useRouter()

const manualFigo = ref('')
const topK = ref(store.topKSimilar || 3)
const isRunning  = ref(false)
const activeTab  = ref('mdt')
const toastMsg   = ref(''); const toastType = ref('info')
let streamController = null

// ── 切换病例时重置本地 UI 状态（保留后台流不中断）───────────
watch(() => store.activeCaseId, () => {
  // 不 abort 后台流 — 让它继续跑并写入对应病例的槽位
  // 但清除本地引用（切换回来后用不了 stop，但不影响完成回调）
  streamController = null
  activeTab.value = 'mdt'
  isEditing.value = false
  manualFigo.value = ''
  resetStages()
  // 如果切到的病例有后台流，恢复 running 状态
  isRunning.value = store.mdtStreaming
})

const tabs = [
  {key:'mdt',label:'MDT 报告'},
  {key:'bib',label:'参考文献'},
  {key:'similar',label:'相似病例'},
  {key:'comorbidity',label:'合并症筛查'},
]

const STAGE_MAP = {
  patient_profile:'提取患者画像', structured_features:'结构化特征提取',
  graph_query:'构建知识图谱查询', moe_weight:'计算 MoE 融合权重',
  knowledge_retrieval:'知识图谱检索', rerank:'证据重排序 (Rerank)',
  similar_patients:'相似病例检索', comorbidity_screening:'合并症药学筛查',
  mdt_report:'生成 MDT 报告',
}

const isEditing = ref(false) // 医生是否正在编辑 MDT 报告

const stages = reactive(Object.entries(STAGE_MAP).map(([key,label])=>({key,label,status:'pending',extra:''})))
const xgbPreds = computed(() =>
  store.analysisResult?.xgb_predictions || null
)
function resetStages() { stages.forEach(s=>{s.status='pending';s.extra=''}) }
function setStage(key,status,extra='') { const s=stages.find(s=>s.key===key); if(s){s.status=status;s.extra=extra} }

const figoStages = ['IA期','IB期','IIA期','IIB期','IIIA期','IIIA1期','IIIA2期','IIIB期','IIIC1期','IIIC2期','IVA期','IVB期']
const figoStageText = computed(() => store.clinicalInfo.figo_stage || store.profileResult?.figo_stage || '')
const canGenerate = computed(()=> store.confirmedPatientCase || store.profileResult || manualFigo.value)
const mdtText     = computed(()=> store.mdtStreamText)
const bib         = computed(()=> store.analysisResult?.bibliography || [])
const similar     = computed(()=> store.analysisResult?.similar_patients || [])
const comorbidityData = computed(()=> store.analysisResult?.comorbidity_screening || null)

const esgoChipClass = computed(()=>{
  const v = store.profileResult?.esgo_risk_classification||''
  if(v.includes('高危')&&!v.includes('中高')) return 'chip-rose'
  if(v.includes('中高')) return 'chip-amber'
  if(v.includes('中危')) return 'chip-blue'
  if(v.includes('低危')) return 'chip-green'
  return 'chip-slate'
})

const comorbidityChips = computed(()=>{
  const ci = store.clinicalInfo; const chips=[]
  if(ci.hepatic_viral>0) chips.push({label:'病毒性肝炎 ⚠️',cls:'chip-rose'})
  if(ci.major_cv_risk>0) chips.push({label:'严重心血管风险',cls:'chip-amber'})
  if(ci.hepatic_dysfunction>0) chips.push({label:'肝功能异常',cls:'chip-amber'})
  if(ci.anemia>=2) chips.push({label:'中重度贫血',cls:'chip-amber'})
  if(ci.hypertension>0) chips.push({label:'高血压',cls:'chip-blue'})
  if(ci.glycemic_status===2) chips.push({label:'糖尿病',cls:'chip-blue'})
  else if(ci.glycemic_status===1) chips.push({label:'糖耐量异常',cls:'chip-blue'})
  if(ci.bmi_status===2) chips.push({label:'肥胖',cls:'chip-slate'})
  else if(ci.bmi_status===1) chips.push({label:'超重',cls:'chip-slate'})
  if(ci.hyperlipidemia>0) chips.push({label:'高脂血症',cls:'chip-slate'})
  if(ci.hpv_status>0) chips.push({label:'高危 HPV',cls:'chip-purple'})
  return chips
})

function goBack()      { router.push('/profile') }
function goToEvidence(){ store.setStep(3); router.push('/evidence') }

async function startAnalysis() {
  const patientCase = store.confirmedPatientCase || store.effectivePatientCase ||
    manualFigo.value
  if (!patientCase) return

  // 打印请求参数，帮助调试
  console.log('🚀 请求参数：', {
    patient_case: patientCase,
    top_k: topK.value
    })

  // 中止上一次未完成的流
  if (streamController) { try { streamController.abort() } catch(_){} streamController = null }
  isRunning.value=true; store.resetMdtStream(); store.setMdtStreaming(true)
  store.setAnalysisResult(null); resetStages()
  // 记录此流属于哪个病例
  store.streamOwnerId = store.activeCaseId

  let resultReceived = false

  // 当前流的所属病例 ID（闭包捕获，不受后续切换影响）
  const owningCaseId = store.activeCaseId

  streamController = apiAnalyzeStream(patientCase, topK.value, {
    onEvent(type, payload) {
      console.log('[SSE]', type, payload, 'streaming=', store.mdtStreaming, 'isRunning=', isRunning.value) // 打印所有事件和当前状态，帮助调试
      if (type==='progress') {

        // 打印阶段进度事件，详细
        console.log(`[Progress] Stage "${payload.stage}" is now "${payload.status}". Additional info:`, payload)

        if(payload.status==='started') setStage(payload.stage,'running')
        else if(payload.status==='done'||payload.status==='streaming') {
          const extra = payload.weight?`权重 ${payload.weight.toFixed(3)}`:payload.count?`${payload.count}条`:payload.selected_count?`精选${payload.selected_count}条`:''
          setStage(payload.stage,'done',extra)
          if(payload.status==='streaming') setStage('mdt_report','running')
        }
      } else if (type==='result') {
        resultReceived = true
        console.log('✅ Analysis result received:', payload)
        // 如果流属于后台病例，写入其槽位；否则更新当前 reactive 状态
        if (owningCaseId !== store.activeCaseId) {
          store._commitBackgroundResult(owningCaseId, payload)
        } else {
          store.setAnalysisResult(payload)
          if (payload.mdt_report) {
            store.setMdtStreamText(payload.mdt_report)
            store.setEditableMdtReport(payload.mdt_report)
          }
          store.setMdtStreaming(false)
          isRunning.value = false
          setStage('mdt_report','done')
        }
      }
    },
    onToken(t) { store.appendMdtToken(t) },
    onDone()   {
      console.log('🔚 onDone called, streaming=', store.mdtStreaming, 'isRunning=', isRunning.value)
      console.log('🔚 Checking if result was received:', resultReceived)
      if (!resultReceived) {
        console.warn('报告流式输出已结束，但未收到完整结果，可能是网络问题或后端异常。')
        if (owningCaseId !== store.activeCaseId) {
          store._finishBackgroundStream(owningCaseId)
        } else {
          store.setMdtStreaming(false)
          isRunning.value = false
          const mdtStage = stages.find(s => s.key === 'mdt_report')
          if (mdtStage) mdtStage.status = 'error'
          showToast('报告生成不完整，请点击”重新生成”', 'error')
        }
        store.streamOwnerId = ''
        return
      }
      // 正常完成
      if (owningCaseId === store.activeCaseId) {
        store.setMdtStreaming(false)
        isRunning.value = false
      } else {
        store._finishBackgroundStream(owningCaseId)
      }
      store.streamOwnerId = ''
    },
    onError(e) {
      console.error('❌ onError', e)
      if (owningCaseId !== store.activeCaseId) {
        store._finishBackgroundStream(owningCaseId)
      } else {
        store.setMdtStreaming(false); isRunning.value=false
        stages.forEach(s=>{ if(s.status==='running') s.status='error' })
        showToast('分析失败：'+e.message,'error')
      }
      store.streamOwnerId = ''
    },
  })
}

function stopAnalysis() {
  // streamController 在切换病例时被置 null；此时不能 abort 后台流，
  // 若强行清空 streamOwnerId 会导致后台流的 token 写入当前前台病例，造成数据泄漏。
  if (!streamController) {
    showToast('请切回正在生成 MDT 的病例后再停止', 'info')
    return
  }
  streamController.abort(); store.setMdtStreaming(false); isRunning.value=false
  store.streamOwnerId = ''
  showToast('已停止生成','info')
}

function reGenerate() { store.resetMdtStream(); startAnalysis() }

function copyMdt() {
  navigator.clipboard.writeText(store.mdtStreamText).then(()=>showToast('已复制到剪贴板','success'))
}

function showToast(msg,type='info') {
  toastMsg.value=msg; toastType.value=type; setTimeout(()=>{toastMsg.value=''},3000)
}

function simBarColor(score) {
  if (score >= 0.9) return 'linear-gradient(90deg, var(--accent-green), #34d399)'
  if (score >= 0.75) return 'linear-gradient(90deg, var(--accent-blue), #60a5fa)'
  if (score >= 0.6) return 'linear-gradient(90deg, var(--accent-amber), #fbbf24)'
  return 'linear-gradient(90deg, #94a3b8, #cbd5e1)'
}

// 新增：取消编辑，恢复到原始报告
function cancelEdit() {
  // 清空编辑副本，展示区会自动回退到 mdtText（即 store.mdtStreamText）
  store.setEditableMdtReport(null)
  isEditing.value = false
}

// 修改：切换编辑状态
function toggleEdit() {
  // 如果当前正在编辑，执行取消操作
  if (isEditing.value) {
    cancelEdit()
    return
  }

  // 进入编辑模式：始终用当前最新的原始报告初始化编辑内容
  store.setEditableMdtReport(store.mdtStreamText)
  isEditing.value = true
}





// 修改：保存编辑
function saveEditedReport() {
  const content = store.editableMdtReport
  if (!content) return

  // 1. 更新流式展示文本（mdtText 计算属性会随之变化）
  store.setMdtStreamText(content)

  // 2. 同步更新完整分析结果中的报告，保证后续步骤（证据合成）使用最新版
  if (store.analysisResult) {
    store.analysisResult.mdt_report = content
  }


  // 3. 清空编辑副本，展示区回归 mdtStreamText 控制
  store.setEditableMdtReport(null)
  isEditing.value = false
  showToast('MDT 方案已更新', 'success')
}



</script>

<style scoped>
.treatment-page { min-height:100vh; padding:24px 24px 48px; }
.page-wrap { max-width:1480px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }

.pg-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.pg-step { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent-blue); margin-bottom:3px; }
.pg-title { font-size:24px; font-family:var(--font-serif); }
.pg-sub { font-size:13px; color:var(--text-secondary); margin-top:3px; }
.header-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; margin-top:4px; }
.gen-btn { font-size:14px; }
.stop-btn {}

/* 3-column layout: left=240px, centre=1fr, right=240px */
.main-grid { display:grid; grid-template-columns:240px 1fr 230px; gap:16px; align-items:stretch; }
.left-col,.right-col { display:flex; flex-direction:column; gap:14px; min-height:0; height:100%; }
.centre-col { display:flex; flex-direction:column; }

/* Left cards */
.ctx-card { flex:1; display:flex; flex-direction:column; padding:0; overflow:hidden; min-height:0; }
.ctx-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid var(--border); }
.ctx-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); }
.esgo-chip { padding:3px 10px; border-radius:100px; font-size:12px; font-weight:600; border:1px solid transparent; }
.ctx-badges { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.figo-chip { padding:3px 10px; border-radius:100px; font-size:12px; font-weight:600; background:var(--bg-2); color:var(--text-primary); border:1px solid var(--border-md); }
.chip-rose { background:var(--accent-rose-light); color:var(--accent-rose); border-color:var(--accent-rose-mid); }
.chip-amber{ background:var(--accent-amber-light); color:var(--accent-amber); border-color:var(--accent-amber-mid); }
.chip-blue { background:var(--accent-blue-light); color:var(--accent-blue); border-color:var(--accent-blue-mid); }
.chip-green{ background:var(--accent-green-light); color:var(--accent-green); border-color:var(--accent-green-mid); }
.chip-slate{ background:var(--bg-2); color:#475569; border-color:var(--border-md); }
.chip-purple{ background:var(--accent-purple-light); color:var(--accent-purple); border-color:var(--accent-purple-mid); }
.ctx-profile { padding:10px 14px 12px; font-size:12px; color:var(--text-secondary); line-height:1.65; white-space:pre-wrap; overflow-y:auto; flex:1; }
.manual-card { padding:14px; display:flex; flex-direction:column; gap:10px; }
.manual-warn { display:flex; align-items:flex-start; gap:6px; font-size:12px; color:var(--text-secondary); }
.form-field { display:flex; flex-direction:column; gap:5px; }
.chips-card { padding:12px 14px; }
.chips-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:7px; }
.chips-row { display:flex; flex-wrap:wrap; gap:5px; }
.comor-chip { padding:3px 9px; border-radius:100px; font-size:11px; font-weight:500; border:1px solid transparent; }

/* Report card */
.report-card { display:flex; flex-direction:column; padding:0; overflow:hidden; min-height:500px; }
.tab-row { display:flex; gap:0; border-bottom:1px solid var(--border); background:var(--bg-1); flex-shrink:0; }
.rtab { padding:10px 16px; border:none; border-bottom:2px solid transparent; background:transparent; cursor:pointer; font-size:13px; font-weight:500; color:var(--text-secondary); transition:all .15s; display:flex; align-items:center; gap:5px; }
.rtab:hover { color:var(--text-primary); background:var(--bg-2); }
.rtab.active { color:var(--accent-blue); border-bottom-color:var(--accent-blue); background:#fff; font-weight:600; }
.tab-badge { background:var(--accent-blue); color:#fff; border-radius:100px; font-size:10px; font-weight:700; padding:1px 5px; }
.tab-body { flex:1; overflow-y:auto; max-height:70vh; }
.state-box { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:280px; gap:12px; padding:32px; }
.state-icon { width:56px; height:56px; background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-xl); display:flex; align-items:center; justify-content:center; color:var(--text-muted); }
.state-txt { font-size:14px; color:var(--text-muted); text-align:center; line-height:1.7; }
.skel-wrap { padding:20px 18px; }
.skel-stack { display:flex; flex-direction:column; gap:10px; }
.report-body { padding:18px 22px; }
.report-footer { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:12px 18px; border-top:1px solid var(--border); background:var(--bg-1); }

/* Bib */
.bib-list { padding:16px 18px; display:flex; flex-direction:column; gap:12px; }
.bib-entry { display:flex; align-items:flex-start; gap:10px; }
.bib-num { font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--accent-blue); min-width:28px; flex-shrink:0; }
.bib-title { font-size:13px; line-height:1.5; }
.bib-meta { display:flex; align-items:center; gap:8px; margin-top:4px; }
.bib-pmid { font-size:11px; color:var(--text-muted); }

/* Similar */
.similar-list { padding:14px 16px; display:flex; flex-direction:column; gap:14px; }
.sim-card { background:var(--bg-1); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; transition:box-shadow .15s; }
.sim-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.07); }
.sim-card-hdr { display:flex; align-items:center; gap:12px; padding:12px 14px 10px; background:var(--bg-2); border-bottom:1px solid var(--border); }
.sim-badge { width:28px; height:28px; border-radius:50%; background:var(--accent-blue); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sim-index { font-size:13px; font-weight:700; color:#fff; }
.sim-title-block { display:flex; flex-direction:column; gap:1px; flex:1; }
.sim-title { font-size:13px; font-weight:700; color:var(--text-primary); }
.sim-id { font-size:10px; font-family:var(--font-mono); color:var(--text-muted); }
.sim-score-block { text-align:right; flex-shrink:0; }
.sim-score-label { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); }
.sim-score-value { font-size:18px; font-weight:700; font-family:var(--font-mono); color:var(--accent-blue); line-height:1.2; }
.sim-bar-wrap { padding:0 14px 10px; background:var(--bg-2); }
.sim-bar-bg { height:4px; background:var(--border); border-radius:100px; overflow:hidden; }
.sim-bar-fill { height:100%; border-radius:100px; transition:width .6s ease; }
.sim-desc-block { padding:10px 14px 8px; }
.sim-tx-block { padding:8px 14px 12px; border-top:1px solid var(--border); background:var(--bg-1); }
.sim-sec-label { display:flex; align-items:center; gap:5px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:5px; }
.sim-tx-label { color:var(--accent-blue); }
.sim-desc { font-size:12px; color:var(--text-secondary); line-height:1.65; }
.sim-tx { font-size:12px; color:var(--text-secondary); line-height:1.65; }

/* Comorbidity report */
.comor-report { padding:16px 18px; display:flex; flex-direction:column; gap:16px; }
.comor-sec { background:var(--bg-1); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; }
.comor-sec-hdr { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; padding:10px 14px; background:var(--bg-2); border-bottom:1px solid var(--border); }
.comor-count { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; border-radius:100px; font-size:10px; font-weight:700; padding:0 5px; margin-left:auto; }
.rose-count  { background:var(--accent-rose-light); color:var(--accent-rose); border:1px solid var(--accent-rose-mid); }
.amber-count { background:var(--accent-amber-light); color:var(--accent-amber); border:1px solid var(--accent-amber-mid); }
.blue-count  { background:var(--accent-blue-light); color:var(--accent-blue); border:1px solid var(--accent-blue-mid); }
.rose-hdr  { color:var(--accent-rose); }
.amber-hdr { color:var(--accent-amber); }
.comor-empty { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--accent-green); padding:10px 14px; }
.comor-ul  { padding:10px 14px 12px 14px; margin-left:18px; display:flex; flex-direction:column; gap:6px; }
.comor-ul li { font-size:13px; color:var(--text-secondary); line-height:1.6; }
.rose-ul li  { color:var(--accent-rose); }
.amber-ul li { color:var(--accent-amber); }

/* Right: progress card */
.progress-card { padding:0; overflow:hidden; display:flex; flex-direction:column; flex:1; min-height:0; }
.prog-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid var(--border); }
.prog-title { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); }
.thinking-pill { display:flex; align-items:center; gap:5px; padding:3px 10px; background:var(--accent-blue-light); border:1px solid var(--accent-blue-mid); border-radius:100px; font-size:11px; font-weight:600; color:var(--accent-blue); }
.stages-list { padding:10px 14px; display:flex; flex-direction:column; gap:4px; flex:1; overflow-y:auto; }
.stage-row { display:flex; align-items:center; gap:8px; padding:5px 6px; border-radius:var(--radius-sm); transition:background .15s; }
.stage-row.stage-running { background:var(--accent-blue-light); }
.stage-row.stage-done    { opacity:.7; }
.stage-row.stage-error   { background:var(--accent-rose-light); }
.stage-ico { width:16px; height:16px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.stage-pending-dot { width:6px; height:6px; border-radius:50%; background:var(--bg-3); }
.stage-info { display:flex; flex-direction:column; gap:1px; }
.stage-lbl { font-size:12px; font-weight:500; color:var(--text-secondary); line-height:1.3; }
.stage-row.stage-running .stage-lbl { color:var(--accent-blue); font-weight:600; }
.stage-row.stage-done    .stage-lbl { color:var(--text-muted); }
.stage-row.stage-error   .stage-lbl { color:var(--accent-rose); }
.stage-extra { font-size:10px; font-family:var(--font-mono); color:var(--text-muted); }

/* XGB debug */
.xgb-debug { margin:0 14px 14px; padding:10px; background:var(--bg-1); border:1px solid var(--border); border-radius:var(--radius-sm); }
.xgb-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:7px; }
.xgb-row { display:flex; justify-content:space-between; padding:2px 0; }
.xgb-key { font-size:11px; font-family:var(--font-mono); color:var(--text-secondary); }
.xgb-val { font-size:11px; font-weight:600; font-family:var(--font-mono); }
.xgb-yes { color:var(--accent-green); }
.xgb-no  { color:var(--text-muted); }

@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
/* ═══════════════════════════════════ */
/* Streaming Raw Mode */
/* ═══════════════════════════════════ */

.streaming-raw-wrap {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border, #e2e8f0);
  box-shadow: 0 1px 8px rgba(0,0,0,.04);
}

.streaming-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-2, #f1f5f9);
  border-bottom: 1px solid var(--border, #e2e8f0);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #475569);
  letter-spacing: .03em;
}

.streaming-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-md, #cbd5e1);
  border-top-color: var(--accent-blue, #3b82f6);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

.streaming-raw {
  margin: 0;
  padding: 18px 20px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: normal;
  font-size: 13px;
  line-height: 1.8;
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
  color: var(--text-primary, #0f172a);
}

/* ── Right panel action buttons ── */
.right-actions {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.right-gen-btn {
  width: 100%;
  justify-content: center;
  font-size: 14px;
  padding: 10px 16px;
}
.right-stop-btn {
  width: 100%;
  justify-content: center;
}
.right-regen-btn {
  width: 100%;
  justify-content: center;
}

/* 右列下一步按钮 */
.next-step-wrap {
  flex-shrink: 0;
}
.next-step-btn {
  width: 100%;
  justify-content: center;
  font-size: 12px;
  padding: 8px 14px;
  gap: 6px;
}

@keyframes spin {
  to {
    transform:rotate(360deg);
  }
}

/* ═══════════════════════════════ */
/* MDT Editor */
/* ═══════════════════════════════ */

.mdt-editor-wrap {

  border:1px solid var(--border);

  border-radius:14px;

  overflow:hidden;

  background:#fff;
}

.editor-toolbar {

  height:52px;

  padding:0 16px;

  display:flex;

  align-items:center;

  justify-content:space-between;

  border-bottom:1px solid var(--border);

  background:var(--bg-1);
}

.editor-title {

  font-size:13px;

  font-weight:700;

  color:var(--text-secondary);

  letter-spacing:.04em;
}

.editor-actions {

  display:flex;

  align-items:center;

  gap:8px;
}

.mdt-editor {
  width:100%;
  min-height:70vh;
  padding:20px 22px;
  border:none;
  resize:vertical;
  outline:none;
  background:#fcfcfd;
  color:var(--text-primary);
  font-size:14px;
  line-height:1.9;
  font-family:
    "JetBrains Mono",
    "Fira Code",
    Consolas,
    monospace;
}
</style>