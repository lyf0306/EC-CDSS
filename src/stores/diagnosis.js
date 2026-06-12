import { defineStore } from 'pinia'
import { ref, computed, reactive, watch } from 'vue'
import { caseStorage, forceFlushPatchBuffer, appendBackgroundMdtToken, consumeBackgroundMdtText } from '@/api/caseStorage.js'
import { runFigoStage, runProfileOnly, runMdtStream, resumeEbmPolling } from '@/api/autoExecutor.js'
import { apiEbmSubmit } from '@/api/index.js'
import { withCancel } from '@/utils/withCancel.js'

export const useDiagnosisStore = defineStore('diagnosis', () => {
  // ── Mode ──────────────────────────────────────────────────
  const MODE_KEY = 'oncology_aid_mode'
  const mode = ref(
    ['independent', 'sequential', 'auto'].includes(localStorage.getItem(MODE_KEY))
      ? localStorage.getItem(MODE_KEY)
      : 'sequential'
  )
  const currentStep = ref(1)
  // ── Independent mode staging scratchpad ────────────────────
  const STAGING_HISTORY_KEY = 'oncology_staging_history'
  const MAX_STAGING_HISTORY = 50
  const stagingHistory = ref(_restoreStagingHistory())

  // ── Auto-execution queue ──────────────────────────────────
  const AUTO_QUEUE_KEY = 'oncology_auto_queue'

  /** @type {import('vue').Ref<Array<{id:string, label:string, fileName:string, status:'queued'|'running'|'completed'|'failed', phase:'pending'|'figo'|'profile'|'mdt'|'ebm'|'done', progress:number, phaseProgress:string, error:string|null, result:object|null, createdAt:number, controller:AbortController|null}>>} */
  const autoQueue = ref(_restoreAutoQueue())
  const autoConcurrency = ref(parseInt(localStorage.getItem('oncology_auto_cc') || '2'))
  const autoRunning = ref(new Set())  // 正在执行的 caseId 集合
  const autoViewingCase = ref(_restoreAutoViewing())  // 自动模式下正在查看某个已完成病例（sessionStorage 持久化，标签页内刷新不丢）
  let _autoQueueBusy = false  // 队列调度锁，防重入

  // ── 自动队列实时时钟（store 级，导航不中断） ──────────────
  const autoNow = ref(Date.now())
  // 使用全局注册表避免 HMR 产生孤立定时器（模块重载时清理旧引用）
  const TIMER_KEY = '__onco_auto_timer'
  let _autoNowTimer = null

  function _startAutoTimer() {
    if (window[TIMER_KEY]) return  // 已有全局定时器在运行
    window[TIMER_KEY] = setInterval(() => { autoNow.value = Date.now() }, 1000)
    _autoNowTimer = window[TIMER_KEY]
  }
  function _stopAutoTimer() {
    if (window[TIMER_KEY]) { clearInterval(window[TIMER_KEY]); window[TIMER_KEY] = null }
    _autoNowTimer = null
  }

  // 有运行中任务时启动时钟，全部结束后停止
  watch(
    () => autoQueue.value.filter(q => q.status === 'running').length,
    (n) => { if (n > 0) _startAutoTimer(); else _stopAutoTimer() },
    { immediate: true }
  )

  function _restoreAutoQueue() {
    try {
      const raw = localStorage.getItem(AUTO_QUEUE_KEY)
      if (!raw) return []
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) return []
      // 刷新后：queued 和 running 项都恢复排队，自动重新调度执行
      // 保留中间结果，_executeSingleCase 会跳过已完成的阶段
      const restored = arr.map(e => {
        if (e.status === 'running' || e.status === 'queued') {
          return { ...e,
            status: 'queued', phase: 'pending', progress: 0,
            phaseProgress: '', error: null, controller: null,
            _text: e._text || '',
            _phaseStart: 0,
            phaseTimings: {},  // 已完成的阶段由 _xxxResult 字段标识，timings 重新记录
            // 保留中间结果用于断点续跑
            _figoResult: e._figoResult || null,
            _profileResult: e._profileResult || null,
            _mdtResult: e._mdtResult || null,
            _ebmJobId: e._ebmJobId || null,
            _ebmResult: e._ebmResult || null,
          }
        }
        return { ...e, controller: null, _text: e._text || '' }
      })
      // 诊断：检查是否有条目丢失了 _text（序列化异常/旧版本兼容）
      for (const e of restored) {
        if ((!e._text || e._text.length < 10) && e.status !== 'completed') {
          console.warn('[Auto] 恢复的条目缺少 _text:', { id: e.id, label: e.label, status: e.status, textLen: e._text?.length || 0 })
        }
      }
      return restored
    } catch { return [] }
  }

  // 恢复 autoViewingCase：仅 sessionStorage（标签页级行为，不需要 localStorage 备份）
  function _restoreAutoViewing() {
    return sessionStorage.getItem('oncology_auto_viewing') === 'true'
  }

  
  function _restoreStagingHistory() {
    try {
      const raw = sessionStorage.getItem(STAGING_HISTORY_KEY)
      if (!raw) return []
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) return []
      return arr
    } catch { return [] }
  }
  function _saveStagingHistory() {
    const arr = stagingHistory.value.slice(0, MAX_STAGING_HISTORY)
    sessionStorage.setItem(STAGING_HISTORY_KEY, JSON.stringify(arr))
  }
  let _persistAutoQueueTimer = null
  function _persistAutoQueue() {
    clearTimeout(_persistAutoQueueTimer)
    _persistAutoQueueTimer = setTimeout(() => {
      const slim = autoQueue.value.map(e => ({
        id: e.id, label: e.label, fileName: e.fileName,
        status: e.status, phase: e.phase, progress: e.progress,
        phaseProgress: e.phaseProgress, error: e.error, result: e.result,
        createdAt: e.createdAt, _text: e._text || '',
        _phaseStart: e._phaseStart, phaseTimings: e.phaseTimings,
        // 中间结果 — 用于页面刷新后断点续跑
        _figoResult: e._figoResult || null,
        _profileResult: e._profileResult || null,
        _mdtResult: e._mdtResult || null,
        _ebmJobId: e._ebmJobId || null,
        _ebmResult: e._ebmResult || null,
      }))
      localStorage.setItem(AUTO_QUEUE_KEY, JSON.stringify(slim))
      localStorage.setItem('oncology_auto_cc', autoConcurrency.value)
    }, 300)
  }

  /** 立即持久化队列到 localStorage（用于阶段切换后保存恢复点） */
  function _flushQueueNow() {
    if (_persistAutoQueueTimer) { clearTimeout(_persistAutoQueueTimer); _persistAutoQueueTimer = null }
    const slim = autoQueue.value.map(e => ({
      id: e.id, label: e.label, fileName: e.fileName,
      status: e.status, phase: e.phase, progress: e.progress,
      phaseProgress: e.phaseProgress, error: e.error, result: e.result,
      createdAt: e.createdAt, _text: e._text || '',
      _phaseStart: e._phaseStart, phaseTimings: e.phaseTimings,
      _figoResult: e._figoResult || null,
      _profileResult: e._profileResult || null,
      _mdtResult: e._mdtResult || null,
      _ebmJobId: e._ebmJobId || null,
      _ebmResult: e._ebmResult || null,
    }))
    localStorage.setItem(AUTO_QUEUE_KEY, JSON.stringify(slim))
  }

  // withCancel: 见 src/utils/withCancel.js，autoExecutor.js 和此处共用

  // ── Step 1: Input ─────────────────────────────────────────
  const pathologyText = ref('')
  const fullPatientCase = ref('')
  const importedFileName = ref('')
  const importedRawText = ref('')
  const hiddenClinicalData = ref(null)

  // ── Step 1: API result (profile-only) ────────────────────
  const profileResult = ref(null)
  const confirmedPatientCase = ref('')

  // ── Step 2: Clinical supplement form ──────────────────────
  const clinicalInfo = ref({
    age: '', weight: '', height: '', ecog: '',
    hypertension: false, diabetes: false, cardiac: false, renal: false,
    molecular_type: '', ca125: '', mri_findings: '', notes: '',
    fertility_desire: false, figo_stage: '', esgo_risk_classification: '',
  })

  // ── Step 3: Full analysis result ─────────────────────────
  const analysisResult = ref(null)
  const mdtStreamText = ref('')
  const mdtStreaming = ref(false)
  const editableMdtReport = ref('')

  // Evidence list with UI state
  const evidenceList = ref([])
  const extraKeywords = ref('')

  // ── FIGO 分期结果（跨病例切换保留） ────────────────────────
  const figoRawOutput = ref('')
  const figoStage = ref('')

  // ── EBM 深搜状态 ──────────────────────────────────────────
  const ebmJobId = ref('')
  const ebmStatus = ref('')
  const ebmProgress = ref(null)
  const ebmReport = ref('')
  const ebmLoading = ref(false)
  const ebmError = ref('')
  const ebmStageHistory = ref([])  // [{stage, label, message, elapsed, iteration}] — 步骤时间线

  // ── Backend reachable flag ────────────────────────────────
  const backendUnreachable = ref(false)

  // ── Computed ──────────────────────────────────────────────
  const isImported = computed(() => !!importedFileName.value)
  const effectivePatientCase = computed(() =>
    fullPatientCase.value || pathologyText.value
  )
  const hasProfileResult = computed(() => !!profileResult.value)
  const hasAnalysisResult = computed(() => !!analysisResult.value)

  // ── 多病例槽位 ────────────────────────────────────────────
  const activeCaseId = ref('')
  const activeCaseLabel = ref('')
  const caseListVersion = ref(0)  // 每次增删改 +1，驱动侧边栏 computed 刷新

  /** 本地缓存的病例索引列表（从服务端同步），供 listCases() 同步返回 */
  const _caseIndexCache = ref([])

  // ── 后台任务所有权（切换病例时不中断） ─────────────────
  const streamOwnerId = ref('')  // 当前 MDT 流属于哪个病例，空串=无流
  const ebmOwnerIds   = reactive(new Set())  // 所有活跃 EBM 深搜的病例 ID 集合（支持并发）

  function _caseId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

  
  // ── Independent mode: staging scratchpad ops ───────────────
  function addStagingResult({ label, figoStage, figoRawOutput: raw, pathologyText: pt, patientCase, overwriteId }) {
    // 重试场景：直接覆盖当前条目，不新增
    if (overwriteId) {
      const entry = stagingHistory.value.find(e => e.id === overwriteId)
      if (entry) {
        entry.label = label || entry.label
        entry.figoStage = figoStage || '待确认'
        entry.figoRawOutput = raw || ''
        entry.pathologyText = pt || ''
        entry.patientCase = patientCase || pt || ''
        entry.timestamp = Date.now()
        _saveStagingHistory()
        activeCaseId.value = overwriteId
        activeCaseLabel.value = entry.label
        return overwriteId
      }
    }
    const id = _caseId()
    const entry = {
      id, label: label || autoLabel(),
      figoStage: figoStage || '待确认',
      figoRawOutput: raw || '',
      pathologyText: pt || '',
      patientCase: patientCase || pt || '',
      timestamp: Date.now(),
    }
    stagingHistory.value.unshift(entry)
    if (stagingHistory.value.length > MAX_STAGING_HISTORY) {
      stagingHistory.value = stagingHistory.value.slice(0, MAX_STAGING_HISTORY)
    }
    _saveStagingHistory()
    activeCaseId.value = id
    activeCaseLabel.value = entry.label
    return id
  }

  function loadStagingResult(id) {
    const entry = stagingHistory.value.find(e => e.id === id)
    if (!entry) return false
    activeCaseId.value = entry.id
    activeCaseLabel.value = entry.label
    pathologyText.value = entry.pathologyText || ''
    fullPatientCase.value = entry.patientCase || ''
    confirmedPatientCase.value = entry.patientCase || ''
    figoRawOutput.value = entry.figoRawOutput || ''
    figoStage.value = entry.figoStage || ''
    profileResult.value = null
    analysisResult.value = null
    mdtStreamText.value = ''
    mdtStreaming.value = false
    evidenceList.value = []
    ebmJobId.value = ''
    ebmStatus.value = ''
    ebmProgress.value = null
    ebmReport.value = ''
    ebmLoading.value = false
    ebmError.value = ''
    ebmStageHistory.value = []
    currentStep.value = 1
    caseListVersion.value++
    return true
  }

  function removeStagingResult(id) {
    const idx = stagingHistory.value.findIndex(e => e.id === id)
    if (idx !== -1) {
      stagingHistory.value.splice(idx, 1)
      _saveStagingHistory()
    }
    if (activeCaseId.value === id) {
      const wasIndependent = mode.value === 'independent'
      resetAll(true)
      if (wasIndependent) {
        mode.value = 'independent'
        // 尝试加载下一个分期记录，若无则创建空白槽位
        if (stagingHistory.value.length > 0) {
          loadStagingResult(stagingHistory.value[0].id)
        } else {
          activeCaseId.value = _caseId()
          activeCaseLabel.value = '新分期'
        }
      } else {
        activeCaseId.value = ''
      }
    }
  }

  function renameStagingResult(id, newLabel) {
    const entry = stagingHistory.value.find(e => e.id === id)
    if (!entry) return
    entry.label = newLabel
    if (activeCaseId.value === id) {
      activeCaseLabel.value = newLabel
    }
    _saveStagingHistory()
    caseListVersion.value++
  }

  function clearStagingHistory() {
    stagingHistory.value = []
    _saveStagingHistory()
    resetAll(true)
    activeCaseId.value = ''
  }

  async function promoteToCaseList(stagingId) {
    const entry = stagingHistory.value.find(e => e.id === stagingId)
    if (!entry) return false
    try {
      await caseStorage.saveCase(stagingId, {
        label: entry.label,
        data: {
          _version: 1,
          mode: 'sequential',
          currentStep: 1,
          pathologyText: entry.pathologyText || '',
          fullPatientCase: entry.patientCase || '',
          importedFileName: '',
          importedRawText: '',
          hiddenClinicalData: null,
          confirmedPatientCase: entry.patientCase || '',
          figoRawOutput: entry.figoRawOutput || '',
          figoStage: entry.figoStage || '',
          profileResult: null,
          clinicalInfo: { age:'', weight:'', height:'', ecog:'',
            hypertension:false, diabetes:false, cardiac:false, renal:false,
            molecular_type:'', ca125:'', mri_findings:'', notes:'', fertility_desire:false,
            figo_stage: entry.figoStage, esgo_risk_classification:'' },
          analysisResult: null,
          mdtStreamText: '',
          evidenceList: [],
          extraKeywords: '',
          mdtStreaming: false,
          ebmJobId: '',
          ebmStatus: '',
          ebmProgress: null,
          ebmReport: '',
          ebmLoading: false,
          ebmError: '',
          ebmStageHistory: [],
          label: entry.label,
        },
      })
      await caseStorage.setActiveCaseId(stagingId)
      await _refreshIndex()
      // 仅从分期历史列表中移除，不 reset 状态（后续 persist 还需要数据）
      const _idx = stagingHistory.value.findIndex(e => e.id === stagingId)
      if (_idx !== -1) stagingHistory.value.splice(_idx, 1)
      _saveStagingHistory()
      activeCaseId.value = stagingId
      activeCaseLabel.value = entry.label
      return true
    } catch (e) {
      console.error('[Store] promoteToCaseList 失败:', e.message)
      return false
    }
  }

  // ── 前缀缓存刷新 ──────────────────────────────────────────
  async function _refreshIndex() {
    try {
      const list = await caseStorage.listCases()
      _caseIndexCache.value = list
      caseListVersion.value++
      return list
    } catch {
      // 后端不可达时保持本地缓存不变
      return _caseIndexCache.value
    }
  }

  function _bumpVersion() { caseListVersion.value++ }

  /** 检查某个病例是否有后台任务在跑（供侧边栏显示状态） */
  function hasBackgroundTask(caseId) {
    return streamOwnerId.value === caseId || ebmOwnerIds.has(caseId)
  }

  // ── 收集当前所有状态 ──────────────────────────────────────
  function collectState() {
    return {
      _version: 1,
      mode: mode.value,
      currentStep: currentStep.value,
      pathologyText: pathologyText.value,
      fullPatientCase: fullPatientCase.value,
      importedFileName: importedFileName.value,
      importedRawText: importedRawText.value,
      hiddenClinicalData: hiddenClinicalData.value,
      profileResult: profileResult.value,
      confirmedPatientCase: confirmedPatientCase.value,
      clinicalInfo: clinicalInfo.value,
      analysisResult: analysisResult.value,
      mdtStreamText: mdtStreamText.value,
      editableMdtReport: editableMdtReport.value,
      evidenceList: evidenceList.value,
      extraKeywords: extraKeywords.value,
      mdtStreaming: mdtStreaming.value,
      ebmJobId: ebmJobId.value,
      ebmStatus: ebmStatus.value,
      ebmProgress: ebmProgress.value,
      ebmReport: ebmReport.value,
      ebmLoading: ebmLoading.value,
      ebmError: ebmError.value,
      ebmStageHistory: ebmStageHistory.value,
      figoRawOutput: figoRawOutput.value,
      figoStage: figoStage.value,
      label: activeCaseLabel.value,
    }
  }

  // ── 写入当前病例到服务端 ──────────────────────────────────
  async function persist() {
    // 独立模式不持久化到后端——数据留在 stagingHistory（sessionStorage）
    if (mode.value === 'independent') return
    if (!activeCaseId.value) {
      activeCaseId.value = _caseId()
      activeCaseLabel.value = autoLabel()
    }
    try {
      await caseStorage.saveCase(activeCaseId.value, {
        label: activeCaseLabel.value,
        data: collectState(),
      })
      await caseStorage.setActiveCaseId(activeCaseId.value)
      await _refreshIndex()
    } catch (e) {
      console.error('[Store] persist 失败:', e.message)
    }
  }

  /** 将当前 reactive 状态保存到指定病例的槽位（不切换 activeCaseId） */
  async function _saveToSlot(caseId) {
    if (!caseId) return
    try {
      await caseStorage.saveCase(caseId, {
        label: activeCaseLabel.value || '未命名',
        data: collectState(),
      })
      await _refreshIndex()
    } catch (e) {
      console.error('[Store] _saveToSlot 失败:', e.message)
    }
  }

  // ── 从服务端恢复病例数据到 reactive 状态 ─────────────────
  async function _restoreSlot(caseId) {
    try {
      const full = await caseStorage.getCase(caseId)
      if (!full?.data) return false
      const d = full.data

      if (d.currentStep !== undefined)    currentStep.value        = d.currentStep
      if (d.pathologyText !== undefined)  pathologyText.value      = d.pathologyText
      if (d.fullPatientCase !== undefined) fullPatientCase.value   = d.fullPatientCase
      if (d.importedFileName !== undefined) importedFileName.value  = d.importedFileName
      if (d.importedRawText !== undefined) importedRawText.value   = d.importedRawText
      if (d.hiddenClinicalData !== undefined) hiddenClinicalData.value = d.hiddenClinicalData
      if (d.profileResult !== undefined)   profileResult.value     = d.profileResult
      if (d.confirmedPatientCase !== undefined) confirmedPatientCase.value = d.confirmedPatientCase

      // 先重置临床信息为默认值，再合并槽位数据（防止不同患者之间字段泄漏）
      clinicalInfo.value = {
        age: '', weight: '', height: '', ecog: '',
        hypertension: false, diabetes: false, cardiac: false, renal: false,
        molecular_type: '', ca125: '', mri_findings: '', notes: '',
        fertility_desire: false, figo_stage: '', esgo_risk_classification: '',
      }
      if (d.clinicalInfo) Object.assign(clinicalInfo.value, d.clinicalInfo)

      if (d.analysisResult !== undefined)   analysisResult.value   = d.analysisResult
      if (d.mdtStreamText !== undefined)    mdtStreamText.value    = d.mdtStreamText
      if (d.editableMdtReport !== undefined) editableMdtReport.value = d.editableMdtReport
      if (d.evidenceList !== undefined)     evidenceList.value     = d.evidenceList
      if (d.extraKeywords !== undefined)    extraKeywords.value    = d.extraKeywords

      // 先重置 EBM 状态为默认值，再用槽位数据覆盖
      ebmJobId.value    = ''
      ebmStatus.value   = ''
      ebmProgress.value = null
      ebmReport.value   = ''
      ebmLoading.value  = false
      ebmError.value    = ''
      ebmStageHistory.value = []
      if (d.mdtStreaming !== undefined) mdtStreaming.value = d.mdtStreaming
      if (d.ebmJobId    !== undefined) ebmJobId.value    = d.ebmJobId
      if (d.ebmStatus   !== undefined) ebmStatus.value   = d.ebmStatus
      if (d.ebmProgress !== undefined) ebmProgress.value = d.ebmProgress
      if (d.ebmReport   !== undefined) ebmReport.value   = d.ebmReport
      if (d.ebmLoading  !== undefined) ebmLoading.value  = d.ebmLoading
      if (d.ebmError    !== undefined) ebmError.value    = d.ebmError
      if (d.ebmStageHistory !== undefined) ebmStageHistory.value = d.ebmStageHistory
      if (d.figoRawOutput  !== undefined) figoRawOutput.value  = d.figoRawOutput
      if (d.figoStage      !== undefined) figoStage.value      = d.figoStage

      activeCaseLabel.value = full.label || d.label || ''
      return true
    } catch (e) {
      console.error('[Store] _restoreSlot 失败:', e.message)
      return false
    }
  }

  // ── 冷启动恢复 ────────────────────────────────────────────
  async function restore() {
    try {
      // 独立模式：从 sessionStorage 恢复临时分期历史，不从后端加载正式病例
      if (mode.value === 'independent') {
        await _refreshIndex()  // 仍需刷新索引以显示"加入病例列表"后的正式病例
        if (stagingHistory.value.length > 0) {
          const latest = stagingHistory.value[0]
          loadStagingResult(latest.id)
        } else {
          // 全新独立模式用户，创建默认临时槽位
          activeCaseId.value = _caseId()
          activeCaseLabel.value = '新分期'
        }
        return
      }
      const activeId = await caseStorage.getActiveCaseId()
      const index = await _refreshIndex()

      if (activeId && index.some(m => m.id === activeId)) {
        const ok = await _restoreSlot(activeId)
        if (ok) {
          activeCaseId.value = activeId
          return
        }
      }

      // 回退：用最近保存的病例
      if (index.length > 0) {
        const firstId = index[0]?.id
        if (firstId) {
          const ok = await _restoreSlot(firstId)
          if (ok) {
            activeCaseId.value = firstId
            await caseStorage.setActiveCaseId(firstId)
            return
          }
        }
      }

      // 全新用户，创建默认病例
      activeCaseId.value = _caseId()
      activeCaseLabel.value = '新病例'
      await persist()
    } catch (e) {
      console.error('[Store] restore 失败:', e.message)
      backendUnreachable.value = true
    }
  }

  // ── 病例列表（同步，从本地缓存读取） ──────────────────────
  function listCases() {
    void caseListVersion.value  // 触发响应式依赖
    return _caseIndexCache.value
  }

  // ── 切换病例 ──────────────────────────────────────────────
  async function switchCase(caseId) {
    // 始终恢复数据：即使 caseId 未变，也需要确保 reactive 状态与后端一致
    // （自动执行结果查看、跨页面导航等场景下，组件可能被销毁重建，丢失本地状态）
    if (caseId !== activeCaseId.value && mode.value !== 'independent') {
      await persist()
    }
    const ok = await _restoreSlot(caseId)
    if (ok) {
      if (caseId !== activeCaseId.value) {
        activeCaseId.value = caseId
        await caseStorage.setActiveCaseId(caseId)
      }
      caseListVersion.value++
      // 自动模式下：切换到其他病例时自动进入查看模式，防止 router-view 被 AutoExecutionView 遮挡
      if (mode.value === 'auto') {
        autoViewingCase.value = true
      }
    }
    return ok
  }

  // ── 新建病例 ──────────────────────────────────────────────
  async function newCase(initialText = '') {
    if (mode.value === 'independent') {
      resetAll(true)
      // resetAll 会把 mode 设为 sequential，独立模式下需要恢复
      mode.value = 'independent'
      activeCaseId.value = _caseId()
      activeCaseLabel.value = initialText ? autoLabel() : '新病例'
      return
    }
    await persist()
    resetAll(true)  // 静默重置，不清服务端
    activeCaseId.value = _caseId()
    activeCaseLabel.value = initialText ? autoLabel() : '新病例'
    await persist()
  }

  // ── 重命名 ────────────────────────────────────────────────
  async function renameCase(caseId, newLabel) {
    if (caseId === activeCaseId.value) {
      activeCaseLabel.value = newLabel
    }
    try {
      await caseStorage.renameCase(caseId, newLabel)
      await _refreshIndex()
    } catch (e) {
      console.error('[Store] renameCase 失败:', e.message)
    }
  }

  // ── 删除病例 ──────────────────────────────────────────────
  async function deleteCase(caseId) {
    try {
      await caseStorage.deleteCase(caseId)
    } catch (e) {
      console.error('[Store] deleteCase 失败:', e.message)
    }

    // 清理后台任务所有权
    ebmOwnerIds.delete(caseId)
    if (streamOwnerId.value === caseId) streamOwnerId.value = ''

    await _refreshIndex()

    if (caseId === activeCaseId.value) {
      const index = _caseIndexCache.value
      if (index.length > 0) {
        const ok = await _restoreSlot(index[0].id)
        if (ok) {
          activeCaseId.value = index[0].id
          await caseStorage.setActiveCaseId(index[0].id)
          caseListVersion.value++
        }
      } else {
        resetAll(true)
        activeCaseId.value = _caseId()
        activeCaseLabel.value = '新病例'
        await persist()
      }
    }
  }

  // ── 自动标签 ──────────────────────────────────────────────
  function autoLabel() {
    const p = profileResult.value
    if (p) {
      const stage = p.figo_stage || ''
      const age = clinicalInfo.value.age || ''
      const parts = []
      if (age) parts.push(age + '岁')
      if (stage) parts.push(stage)
      if (parts.length) return parts.join('·')
    }
    const txt = pathologyText.value || fullPatientCase.value || ''
    if (txt) {
      const clean = txt.replace(/\s+/g, '').slice(0, 15)
      return clean || '未命名病例'
    }
    return '未命名病例'
  }

  // ── Actions ───────────────────────────────────────────────
  async function setMode(m) {
    // 从独立模式切换到其他模式时，如果有活跃的 staging 数据，先提升为正式病例
    if (mode.value === 'independent' && m !== 'independent' && activeCaseId.value) {
      const entry = stagingHistory.value.find(e => e.id === activeCaseId.value)
      if (entry) {
        try {
          await promoteToCaseList(activeCaseId.value)
        } catch (e) {
          console.error('[setMode] 提升病例失败，仍然切换模式:', e)
        }
      }
    }
    mode.value = m
    localStorage.setItem(MODE_KEY, m)
    persist()
  }
  function setStep(s) { currentStep.value = s }
  function setPathologyText(t) { pathologyText.value = t }

  function setImportedFile({ fileName, rawText, pathologySection, clinicalData }) {
    importedFileName.value = fileName
    importedRawText.value = rawText
    fullPatientCase.value = rawText
    pathologyText.value = pathologySection || rawText
    hiddenClinicalData.value = clinicalData || null
    if (clinicalData) {
      Object.assign(clinicalInfo.value, clinicalData)
    }
  }

  function clearImport() {
    importedFileName.value = ''
    importedRawText.value = ''
    fullPatientCase.value = ''
    pathologyText.value = ''
    hiddenClinicalData.value = null
  }

  async function setProfileResult(r) {
    profileResult.value = r
    if (r?.new_patient_dict) {
      Object.assign(clinicalInfo.value, r.new_patient_dict)
    }
    Object.assign(clinicalInfo.value, {
      figo_stage: r?.figo_stage || '',
      esgo_risk_classification: r?.esgo_risk_classification || '',
    })
    activeCaseLabel.value = autoLabel()
    await persist()
  }
  function confirmPatientCase(text) { confirmedPatientCase.value = text }
  function setClinicalInfo(info) { Object.assign(clinicalInfo.value, info) }
  function setAnalysisResult(r) {
    analysisResult.value = r
    if (r?.knowledge_evidence) {
      evidenceList.value = r.knowledge_evidence.map((e, i) => ({
        ...e, id: i, highlighted: false, hidden: false,
      }))
    }
  }

  function appendMdtToken(token) {
    // 如果流属于后台病例，写入该病例的槽位而非当前 reactive 状态
    if (streamOwnerId.value && streamOwnerId.value !== activeCaseId.value) {
      _appendToBackgroundSlot(streamOwnerId.value, token)
      return
    }
    mdtStreamText.value += token
  }

  /** 将流 token 追加到后台病例的槽位（累积到本地缓存，debounce 后整批发送） */
  function _appendToBackgroundSlot(caseId, token) {
    // 追加 token 到 caseStorage 的后台文本缓存（模块级 Map，不触发 HTTP）
    appendBackgroundMdtToken(caseId, token)
    // 标记 streaming 状态（通过 debounced patch，不夹带 mdtStreamText）
    caseStorage.patchCase(caseId, { mdtStreaming: true }).catch(e =>
      console.error('[Store] 后台标记 streaming 失败:', e.message)
    )
  }

  /** 后台流完成：把 analysisResult / mdtReport 写入指定病例槽位 */
  async function _commitBackgroundResult(caseId, result) {
    try {
      // 先 force flush 所有待发的 token patch
      await forceFlushPatchBuffer()
      await caseStorage.patchCase(caseId, {
        analysisResult: result,
        mdtStreamText: result?.mdt_report || '',
        editableMdtReport: result?.mdt_report || '',
        mdtStreaming: false,
      }, true)  // immediate = true，跳过 debounce
      // 刷新索引（hasResult 由服务端自动更新）
      await _refreshIndex()
    } catch (e) {
      console.error('[Store] _commitBackgroundResult 失败:', e.message)
    }
  }

  /** 后台流失败/结束：标记 streaming 状态为 false */
  async function _finishBackgroundStream(caseId) {
    try {
      await forceFlushPatchBuffer()
      await caseStorage.patchCase(caseId, {
        mdtStreaming: false,
      }, true)
    } catch (e) {
      console.error('[Store] _finishBackgroundStream 失败:', e.message)
    }
  }

  /** 后台 EBM 深搜进度/结果写入指定病例槽位 */
  async function _saveEbmToSlot(caseId, patch) {
    try {
      await caseStorage.patchCase(caseId, patch)
      if (patch.ebmReport) {
        await _refreshIndex()
      }
    } catch (e) {
      console.error('[Store] _saveEbmToSlot 失败:', e.message)
    }
  }

  function resetMdtStream() { mdtStreamText.value = ''; mdtStreaming.value = false }
  function setMdtStreaming(v) { mdtStreaming.value = v }

  function resetAll(silent = false) {
    mode.value = 'sequential'
    currentStep.value = 1
    pathologyText.value = ''
    fullPatientCase.value = ''
    importedFileName.value = ''
    importedRawText.value = ''
    hiddenClinicalData.value = null
    profileResult.value = null
    confirmedPatientCase.value = ''
    clinicalInfo.value = {
      age:'', weight:'', height:'', ecog:'',
      hypertension:false, diabetes:false, cardiac:false, renal:false,
      molecular_type:'', ca125:'', mri_findings:'', notes:'', fertility_desire:false,
      figo_stage: '', esgo_risk_classification: '',
    }
    analysisResult.value = null
    mdtStreamText.value = ''
    mdtStreaming.value = false
    evidenceList.value = []
    extraKeywords.value = ''
    ebmJobId.value = ''
    ebmStatus.value = ''
    ebmProgress.value = null
    ebmReport.value = ''
    ebmLoading.value = false
    ebmError.value = ''
    ebmStageHistory.value = []
    figoRawOutput.value = ''
    figoStage.value = ''
    if (!silent) {
      activeCaseId.value = ''
      activeCaseLabel.value = ''
      _caseIndexCache.value = []
      caseListVersion.value++
      // 服务端清理由调用方处理（newCase / deleteCase）
    }
  }

  function setMdtStreamText(text) {
    mdtStreamText.value = text
  }

  function setEditableMdtReport(text) {
    editableMdtReport.value = text
  }

  function toggleHighlight(id) {
    const item = evidenceList.value.find(e => e.id === id)
    if (item) item.highlighted = !item.highlighted
  }

  function toggleHide(id) {
    const item = evidenceList.value.find(e => e.id === id)
    if (item) item.hidden = !item.hidden
  }

  function restoreAllHidden() {
    evidenceList.value.forEach(e => { e.hidden = false })
  }

  function setBackendUnreachable(v) {
    backendUnreachable.value = v
  }

  // ── Auto-Execution ─────────────────────────────────────────

  /** 将文件加入自动执行队列（创建病例 + 解析文本后调用） */
  function enqueueAutoCase(caseId, label, fileName, text) {
    if (!text || text.length < 10) {
      console.error('[Auto] enqueueAutoCase 拒绝空文本:', { caseId, label, fileName, textLen: text?.length || 0 })
      autoQueue.value.push({
        id: caseId,
        label,
        fileName,
        status: 'failed',
        phase: 'pending',
        progress: 0,
        phaseProgress: '',
        error: `文件解析失败：文本内容过短（${text?.length || 0} 字符）`,
        result: null,
        createdAt: Date.now(),
        controller: null,
        _text: '',
      })
      return
    }
    autoQueue.value.push({
      id: caseId,
      label,
      fileName,
      status: 'queued',
      phase: 'pending',
      progress: 0,
      phaseProgress: '',
      error: null,
      result: null,
      createdAt: Date.now(),
      controller: null,
      _text: text,  // 内部使用，不入库
      _phaseStart: 0,                    // 当前阶段开始时间戳 ms
      phaseTimings: { figo: null, profile: null, mdt: null, ebm: null },  // 各阶段耗时 ms
      _figoResult: null,                 // 中间结果 — 断点续跑
      _profileResult: null,
      _mdtResult: null,
      _ebmJobId: null,
      _ebmResult: null,
    })
    _scheduleAutoQueue()
  }

  /** 批量导入：创建病例并入队 */
  async function autoExecuteBatch(files) {
    for (const file of files) {
      try {
        const { parseUploadedFile } = await import('@/api/index.js')
        const text = await parseUploadedFile(file)
        const caseId = _caseId()
        const label = file.name.replace(/\.[^.]+$/, '') || '未命名'

        // 仅入队，不预先入库 — 管线成功后才写入服务端
        enqueueAutoCase(caseId, label, file.name, text)
      } catch (e) {
        console.error('[Auto] 文件导入失败:', file.name, e.message)
        // 解析失败的项直接标记 failed，不入库
        autoQueue.value.push({
          id: _caseId(),
          label: file.name,
          fileName: file.name,
          status: 'failed',
          phase: 'pending',
          progress: 0,
          phaseProgress: '',
          error: `文件解析失败: ${e.message}`,
          result: null,
          createdAt: Date.now(),
          controller: null,
          _text: '',
        })
      }
    }
  }

  /** 调度队列：从 queued 中取任务，受 concurrency 限制 */
  function _scheduleAutoQueue() {
    if (_autoQueueBusy) return
    _autoQueueBusy = true

    Promise.resolve().then(async () => {
      try {
        while (true) {
          const running = autoQueue.value.filter(q => q.status === 'running')
          if (running.length >= autoConcurrency.value) break

          const next = autoQueue.value.find(q => q.status === 'queued')
          if (!next) break

          // 启动
          next.status = 'running'
          next.phase = 'figo'
          next.progress = 0
          next._phaseStart = Date.now()
          next.controller = new AbortController()
          autoRunning.value.add(next.id)

          // fire-and-forget：不阻塞队列调度
          _executeSingleCase(next).finally(() => {
            autoRunning.value.delete(next.id)
            _autoQueueBusy = false
            _scheduleAutoQueue()  // 释放一个并发槽位
          })
        }
      } finally {
        _autoQueueBusy = false
      }
    })
  }

  /** 执行单个病例的完整管线（支持断点续跑） */
  async function _executeSingleCase(entry) {
    const caseId = entry.id
    let text = entry._text
    const signal = entry.controller.signal

    console.log('[Auto] _executeSingleCase 开始:', {
      caseId,
      label: entry.label,
      textLen: text?.length || 0,
      hasFigo: !!entry._figoResult,
      hasProfile: !!entry._profileResult,
      hasMdt: !!entry._mdtResult,
      hasEbmJobId: !!entry._ebmJobId,
      isRecovery: !!(entry._figoResult || entry._profileResult || entry._mdtResult || entry._ebmJobId),
    })

    // 如果 _text 丢失（刷新/序列化异常导致），尝试从 caseStorage 恢复
    if (!text || text.length < 10) {
      console.warn('[Auto] _text 缺失或过短，尝试从 caseStorage 恢复...', { caseId, textLen: text?.length || 0 })
      try {
        const stored = await caseStorage.getCase(caseId)
        const recovered = stored?.data?.importedRawText || stored?.data?.fullPatientCase || stored?.data?.pathologyText || ''
        if (recovered && recovered.length >= 10) {
          text = recovered
          entry._text = recovered  // 更新回队列条目，避免下次重试再次丢失
          console.log('[Auto] 已从 caseStorage 恢复文本，长度:', recovered.length)
        } else {
          console.warn('[Auto] caseStorage 中也没有有效文本，恢复失败')
          console.log('[Auto] caseStorage 返回结构:', {
            hasStored: !!stored,
            storedKeys: stored ? Object.keys(stored) : [],
            dataKeys: stored?.data ? Object.keys(stored.data) : [],
            rawTextLen: stored?.data?.importedRawText?.length,
            fullCaseLen: stored?.data?.fullPatientCase?.length,
            pathTextLen: stored?.data?.pathologyText?.length,
            label: stored?.label,
          })
        }
      } catch (e) {
        console.warn('[Auto] caseStorage 查询失败，无法恢复文本:', e.message)
      }
    }

    // 便捷：设置当前阶段并立即持久化（用于崩溃恢复）
    const setPhase = (phase, progress) => {
      const now = Date.now()
      const prev = entry.phase
      if (prev && prev !== 'pending' && prev !== 'done' && entry._phaseStart > 0) {
        entry.phaseTimings[prev] = now - entry._phaseStart
      }
      entry.phase = phase
      entry._phaseStart = now
      entry.progress = progress
      _flushQueueNow()
    }

    // 中间结果变量
    let figoResult = entry._figoResult || null
    let profileResult = entry._profileResult || null
    let mdtResult = entry._mdtResult || null
    let ebmResult = entry._ebmResult || null
    let ebmJobId = entry._ebmJobId || null

    try {
      // 首次执行才创建服务端病例记录（断点续跑时已存在）
      const isRecovery = !!(figoResult || profileResult || mdtResult || ebmJobId)
      if (!isRecovery) {
        await caseStorage.saveCase(caseId, {
          label: entry.label,
          data: {
            _version: 1, mode: 'auto', currentStep: 1,
            importedFileName: entry.fileName, importedRawText: text,
            fullPatientCase: text, pathologyText: text, label: entry.label,
          },
        })
      }

      // ── Phase A: FIGO 分期 ──────────────────────────────────
      if (!figoResult) {
        console.log('[Auto] FIGO 调用前 text 诊断:', {
          caseId,
          textType: typeof text,
          textLen: text?.length,
          textPreview: String(text || '').slice(0, 120),
          isEmpty: !text,
          tooShort: (text || '').length < 10,
        })
        if (!text || text.length < 10) {
          throw new Error(`病例文本过短（${text?.length || 0} 字符），无法进行 FIGO 分期。请检查文件是否解析成功。`)
        }
        setPhase('figo', 5)
        figoResult = await runFigoStage(text, signal)
        entry._figoResult = figoResult
        _flushQueueNow()
      }

      // ── Phase B: 患者画像 ────────────────────────────────────
      if (!profileResult) {
        if (!text || text.length < 10) {
          throw new Error(`病例文本过短（${text?.length || 0} 字符），无法进行患者画像分析。`)
        }
        setPhase('profile', 25)
        profileResult = await runProfileOnly(text, signal)
        entry._profileResult = profileResult
        _flushQueueNow()
      }

      // ── 构建 MDT 输入 ────────────────────────────────────────
      const fullCase = [
        `【病理报告】${text}`,
        `【FIGO 分期】${figoResult.figo_stage || ''}`,
        `【ESGO 风险分层】${profileResult.esgo_risk_classification || ''}`,
        `【患者画像】${JSON.stringify(profileResult.new_patient_dict || {}, null, 2)}`,
      ].join('\n\n')

      // ── Phase C: MDT 方案生成 (SSE) ─────────────────────────
      if (!mdtResult) {
        setPhase('mdt', 35)
        const mdtStages = [
          'patient_profile', 'structured_features', 'graph_query',
          'moe_weight', 'knowledge_retrieval', 'rerank',
          'similar_patients', 'comorbidity_screening', 'mdt_report',
        ]
        mdtResult = await runMdtStream(fullCase, 3, {
          onToken(token) {
            appendBackgroundMdtToken(caseId, token)
            caseStorage.patchCase(caseId, { mdtStreaming: true }).catch(() => {})
          },
          onProgress(stage, payload) {
            const idx = mdtStages.indexOf(payload.stage)
            if (idx >= 0) {
              entry.progress = 35 + Math.round((idx / (mdtStages.length - 1)) * 30)
            }
            entry.phaseProgress = payload.label || payload.stage || ''
          },
          signal,
        })
        // 轻量保存 MDT 结果（不含 stageHistory，减少 localStorage 占用）
        entry._mdtResult = { mdtReport: mdtResult.mdtReport, analysisResult: mdtResult.analysisResult }
        _flushQueueNow()
      }

      const mdtReport = mdtResult.mdtReport || ''

      // ── 构建 EBM 输入 ────────────────────────────────────────
      const treatmentContext = [
        fullCase,
        `【MDT 治疗方案】${mdtReport}`,
      ].join('\n\n')

      // ── Phase D: EBM 循证深搜 ────────────────────────────────
      if (!ebmResult) {
        setPhase('ebm', 70)

        // 提交新任务或复用已保存的 jobId（断点续跑）
        if (!ebmJobId) {
          const submitRes = await withCancel(apiEbmSubmit(treatmentContext), signal)
          ebmJobId = submitRes.job_id
          entry._ebmJobId = ebmJobId
          _flushQueueNow()  // ⚡ 关键：jobId 落盘后才能断点续跑
        }

        // 轮询直到完成（或从断点恢复轮询）
        ebmResult = await resumeEbmPolling(ebmJobId, {
          onProgress(payload) {
            if (payload.progress !== undefined) {
              entry.progress = 70 + Math.round(payload.progress * 0.25)
            }
            entry.phaseProgress = payload.message || payload.stage || payload.status || ''
          },
          signal,
        })
        entry._ebmResult = ebmResult
        _flushQueueNow()
      }

      // ── 完成 ──────────────────────────────────────────────────
      setPhase('done', 100)
      entry.status = 'completed'
      entry.result = {
        figo_stage: figoResult?.figo_stage || '',
        esgo_risk: profileResult?.esgo_risk_classification || '',
        has_mdt: !!mdtReport,
        has_ebm: !!ebmResult?.report,
      }

      // 完整写入服务端（字段对齐 collectState()，确保 _restoreSlot 完整恢复）
      await forceFlushPatchBuffer()
      const knowledgeEvidence = mdtResult?.analysisResult?.knowledge_evidence || []
      await caseStorage.saveCase(caseId, {
        label: entry.label,
        data: {
          _version: 1, mode: 'auto', currentStep: 3,  // 全部阶段完成，定位到证据合成页
          importedFileName: entry.fileName, importedRawText: text,
          fullPatientCase: text, pathologyText: text, label: entry.label,
          confirmedPatientCase: text,
          hiddenClinicalData: null,
          mdtStreaming: false,
          analysisResult: mdtResult?.analysisResult || null,
          mdtStreamText: mdtReport,
          editableMdtReport: mdtReport,
          evidenceList: knowledgeEvidence.map((e, i) => ({
            ...e, id: i, highlighted: false, hidden: false,
          })),
          extraKeywords: '',
          ebmReport: ebmResult?.report?.final_report || '',
          ebmJobId: ebmResult?.jobId || ebmJobId || '',
          ebmStatus: 'completed',
          ebmProgress: null,
          ebmLoading: false,
          ebmError: '',
          ebmStageHistory: [],
          figoRawOutput: figoResult?.raw_output || '',
          profileResult: profileResult || null,
          clinicalInfo: profileResult?.new_patient_dict
            ? { ...profileResult.new_patient_dict, figo_stage: figoResult?.figo_stage || '', esgo_risk_classification: profileResult?.esgo_risk_classification || '' }
            : {},
        },
      })
      await _refreshIndex()

    } catch (e) {
      // 记录失败阶段的耗时
      if (entry._phaseStart > 0 && entry.phase && entry.phase !== 'pending' && entry.phase !== 'done') {
        entry.phaseTimings[entry.phase] = Date.now() - entry._phaseStart
      }
      if (e.name === 'AbortError') {
        entry.status = 'failed'
        entry.error = '用户取消'
      } else {
        entry.status = 'failed'
        entry.error = e.message || '未知错误'
        console.error('[Auto] 管线执行失败:', caseId, e)
      }

      // 清理过期的 EBM jobId（如果 job 已提交但未完成，重试时应重新提交）
      if (ebmJobId && !ebmResult) {
        entry._ebmJobId = null
        console.log('[Auto] 已清除过期 EBM jobId，重试时将重新提交')
      }

      // 保存部分结果到后端（失败不删数据，方便事后查看/重试）
      await forceFlushPatchBuffer()
      if (!(e.name === 'AbortError')) {
        try {
          await caseStorage.saveCase(caseId, {
            label: entry.label,
            data: {
              _version: 1, mode: 'auto',
              currentStep: ebmResult ? 3 : mdtResult ? 2 : profileResult ? 1 : 1,
              importedFileName: entry.fileName, importedRawText: text,
              fullPatientCase: text, pathologyText: text, label: entry.label,
              confirmedPatientCase: text,
              hiddenClinicalData: null,
              mdtStreaming: false,
              analysisResult: mdtResult?.analysisResult || null,
              mdtStreamText: mdtResult?.mdtReport || '',
              editableMdtReport: mdtResult?.mdtReport || '',
              evidenceList: (mdtResult?.analysisResult?.knowledge_evidence || []).map((e, i) => ({
                ...e, id: i, highlighted: false, hidden: false,
              })),
              extraKeywords: '',
              ebmReport: ebmResult?.report?.final_report || '',
              ebmJobId: ebmResult?.jobId || ebmJobId || '',
              ebmStatus: ebmResult ? 'completed' : (ebmJobId ? 'running' : ''),
              ebmProgress: null,
              ebmLoading: false,
              ebmError: e.message || '',
              ebmStageHistory: [],
              figoRawOutput: figoResult?.raw_output || '',
              profileResult: profileResult || null,
              clinicalInfo: profileResult?.new_patient_dict
                ? { ...profileResult.new_patient_dict, figo_stage: figoResult?.figo_stage || '', esgo_risk_classification: profileResult?.esgo_risk_classification || '' }
                : {},
              _pipelineError: e.message || '未知错误',
            },
          })
        } catch (_) { /* 保存失败就失败了，不掩盖原始错误 */ }
      }
    } finally {
      // 已完成：清理冗余恢复字段；失败：保留中间结果用于手动重试
      if (entry.status === 'completed') {
        delete entry._text
        delete entry._figoResult
        delete entry._profileResult
        delete entry._mdtResult
        delete entry._ebmResult
        delete entry._ebmJobId
      }
      entry.controller = null
    }
  }

  /** 重试失败的自动病例（保留中间结果，从断点续跑） */
  function retryAutoCase(caseId) {
    const entry = autoQueue.value.find(q => q.id === caseId)
    console.log('[retryAutoCase] 查找 entry:', caseId, !!entry, entry?.status)
    if (!entry || entry.status !== 'failed') {
      console.warn('[retryAutoCase] 未找到或状态非 failed，跳过')
      return
    }

    console.log('[retryAutoCase] 重置为 queued，保留中间结果:', {
      hasFigo: !!entry._figoResult,
      hasProfile: !!entry._profileResult,
      hasMdt: !!entry._mdtResult,
      hasEbmJobId: !!entry._ebmJobId,
      textLen: entry._text?.length || 0,
      textPreview: String(entry._text || '').slice(0, 60),
    })

    // 保留中间结果用于断点续跑
    entry.status = 'queued'
    entry.phase = 'pending'
    entry.progress = 0
    entry.phaseProgress = ''
    entry.error = null
    entry.result = null
    entry.controller = null
    entry._phaseStart = 0
    // _figoResult / _profileResult / _mdtResult / _ebmJobId / _ebmResult 保留不变
    _persistAutoQueue()  // 立即持久化状态变更

    // 强制解锁调度器（防止并发失败导致锁死）
    console.log('[retryAutoCase] 调度锁状态:', _autoQueueBusy)
    _autoQueueBusy = false
    _scheduleAutoQueue()
  }

  /** 取消正在执行的自动病例 */
  function cancelAutoCase(caseId) {
    const entry = autoQueue.value.find(q => q.id === caseId)
    if (entry) {
      if (entry.status === 'queued') {
        entry.status = 'failed'
        entry.error = '用户取消'
        _persistAutoQueue()  // 立即持久化，防止刷新后恢复为 queued
      } else if (entry.status === 'running' && entry.controller) {
        entry.status = 'failed'
        entry.error = '用户取消'
        _persistAutoQueue()  // 先持久化再 abort，防止刷新窗口期状态回滚
        entry.controller.abort()
      }
    }
  }

  /**
   * 清除队列项
   * @param {object} [opts]
   * @param {'completed'|'failed'} [opts.only] - 只清除特定状态（不传则清除已完成+失败）
   * @param {boolean} [opts.deleteCases] - 同步删除后端病例数据
   */
  async function clearAutoQueue(opts = {}) {
    const { only, deleteCases } = opts
    const statuses = only ? [only] : ['completed', 'failed']

    if (deleteCases) {
      const toDelete = autoQueue.value.filter(q => statuses.includes(q.status))
      for (const entry of toDelete) {
        try {
          await caseStorage.deleteCase(entry.id)
        } catch (e) {
          console.error('[Auto] 删除病例失败:', entry.id, e.message)
        }
      }
      await _refreshIndex()
    }

    autoQueue.value = autoQueue.value.filter(q => !statuses.includes(q.status))
    _persistAutoQueue()  // 立即持久化，防止刷新后已清除条目重新出现
  }

  /**
   * 移除单个队列项
   * @param {string} caseId
   * @param {boolean} [deleteCase=false] — 同步删除后端病例数据
   */
  async function removeQueueItem(caseId, deleteCase = false) {
    const entry = autoQueue.value.find(q => q.id === caseId)
    if (!entry) return

    // 如果正在运行，先取消
    if (entry.status === 'running' && entry.controller) {
      entry.controller.abort()
    }

    if (deleteCase) {
      try {
        await caseStorage.deleteCase(caseId)
        await _refreshIndex()
      } catch (e) {
        console.error('[Auto] 删除病例失败:', caseId, e.message)
      }
    }

    autoQueue.value = autoQueue.value.filter(q => q.id !== caseId)
    _persistAutoQueue()  // 立即持久化，防止刷新后已移除条目重新出现
  }

  /** 清空全部队列（包括取消进行中的） */
  function resetAutoQueue() {
    for (const entry of autoQueue.value) {
      if (entry.controller) entry.controller.abort()
    }
    autoQueue.value = []
    autoRunning.value = new Set()
    _autoQueueBusy = false  // 重置调度锁，防止死锁残留
    _persistAutoQueue()     // 立即持久化空队列
  }

  // ── EBM Actions ───────────────────────────────────────────
  function setEbmJob({ jobId, status }) {
    ebmJobId.value = jobId
    ebmStatus.value = status
    ebmLoading.value = (status === 'pending' || status === 'running')
    ebmError.value = ''
  }
  function setEbmProgress(progress) {
    ebmProgress.value = progress
    if (progress?.status) ebmStatus.value = progress.status
  }
  function setEbmReport(report) {
    ebmReport.value = report
    ebmStatus.value = 'completed'
    ebmLoading.value = false
  }
  function setEbmError(err) {
    ebmError.value = err
    ebmStatus.value = 'failed'
    ebmLoading.value = false
  }
  function resetEbm() {
    ebmJobId.value = ''
    ebmStatus.value = ''
    ebmProgress.value = null
    ebmReport.value = ''
    ebmLoading.value = false
    ebmError.value = ''
  }

  // 冷启动：恢复的排队项需要重新入队调度
  if (autoQueue.value.some(q => q.status === 'queued')) {
    Promise.resolve().then(() => _scheduleAutoQueue())
  }

  // ── 自动队列持久化（localStorage，关标签页不丢） ──────────
  watch(autoQueue, () => _persistAutoQueue(), { deep: true })
  watch(autoConcurrency, (v) => localStorage.setItem('oncology_auto_cc', v))
  // 双重持久化：sessionStorage（标签页级，主存储）+ localStorage（兜底，跨标签页刷新不丢）
  watch(autoViewingCase, (v) => {
    sessionStorage.setItem('oncology_auto_viewing', v ? 'true' : 'false')
  }, { flush: 'sync' })
  // HMR-safe：先移除旧监听器，避免模块热重载时重复累积
  const BEFOREUNLOAD_KEY = '__onco_beforeunload'
  if (window[BEFOREUNLOAD_KEY]) {
    window.removeEventListener('beforeunload', window[BEFOREUNLOAD_KEY])
  }
  window[BEFOREUNLOAD_KEY] = () => {
    // 立即刷新持久化，不等 debounce
    if (_persistAutoQueueTimer) { clearTimeout(_persistAutoQueueTimer); _persistAutoQueueTimer = null }
    const slim = autoQueue.value.map(e => ({
      id: e.id, label: e.label, fileName: e.fileName,
      status: e.status, phase: e.phase, progress: e.progress,
      phaseProgress: e.phaseProgress, error: e.error, result: e.result,
      createdAt: e.createdAt, _text: e._text || '',
      _phaseStart: e._phaseStart, phaseTimings: e.phaseTimings,
      _figoResult: e._figoResult || null,
      _profileResult: e._profileResult || null,
      _mdtResult: e._mdtResult || null,
      _ebmJobId: e._ebmJobId || null,
      _ebmResult: e._ebmResult || null,
    }))
    localStorage.setItem(AUTO_QUEUE_KEY, JSON.stringify(slim))
    // 显式持久化 autoViewingCase（sessionStorage），防止 watch 未触发
    const v = autoViewingCase.value
    sessionStorage.setItem('oncology_auto_viewing', v ? 'true' : 'false')
  }
  window.addEventListener('beforeunload', window[BEFOREUNLOAD_KEY])

  return {
    mode, currentStep,
    pathologyText, fullPatientCase, importedFileName, importedRawText, hiddenClinicalData,
    profileResult, confirmedPatientCase,
    clinicalInfo,
    analysisResult, mdtStreamText, mdtStreaming, evidenceList, extraKeywords,
    isImported, effectivePatientCase, hasProfileResult, hasAnalysisResult, editableMdtReport,
    toggleHighlight, toggleHide, restoreAllHidden,
    setMode, setStep, setPathologyText,
    setImportedFile, clearImport,
    setProfileResult, confirmPatientCase, setClinicalInfo,
    setAnalysisResult, appendMdtToken, resetMdtStream, setMdtStreaming, setMdtStreamText,
    resetAll, persist, restore, setEditableMdtReport,
    ebmJobId, ebmStatus, ebmProgress, ebmReport, ebmLoading, ebmError, ebmStageHistory,
    figoRawOutput, figoStage,
    setEbmJob, setEbmProgress, setEbmReport, setEbmError, resetEbm,
    // 多病例
    activeCaseId, activeCaseLabel, caseListVersion,
    stagingHistory,
    addStagingResult, loadStagingResult, removeStagingResult, renameStagingResult, clearStagingHistory, promoteToCaseList,
    listCases, switchCase, newCase, renameCase, deleteCase, autoLabel,
    // 后台流
    streamOwnerId, ebmOwnerIds, hasBackgroundTask,
    _saveToSlot, _commitBackgroundResult, _finishBackgroundStream, _saveEbmToSlot,
    // 后端连通性
    backendUnreachable, setBackendUnreachable,
    // 自动执行
    autoQueue, autoConcurrency, autoRunning, autoNow, autoViewingCase,
    enqueueAutoCase, autoExecuteBatch, cancelAutoCase, retryAutoCase, clearAutoQueue, removeQueueItem, resetAutoQueue,
  }
})
