<template>
  <div class="profile-page">
    <div class="page-wrap">

      <!-- ── Header ── -->
      <div class="pg-header">
        <div class="pg-header-l">
          <div>
            <div class="pg-step">STEP 02 · PATIENT RECORD</div>
            <h1 class="pg-title">患者档案确认</h1>
            <p class="pg-sub">核对 AI 自动提取的患者信息，所有字段均可手动修改，修改后点击「保存修改」</p>
          </div>
        </div>
        <div class="pg-header-r">
          <div v-if="autoFilled" class="autofill-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            AI 自动填充
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" @click="goBack">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              返回分期诊断
            </button>
            <button v-if="!isEditing" class="btn btn-secondary" @click="startEdit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              修改档案
            </button>
            <template v-else>
              <button class="btn btn-secondary" @click="cancelEdit">取消</button>
              <button class="btn btn-primary" @click="saveEdit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                保存修改
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- ── Diagnosis Summary Bar ── -->
      <div class="summary-bar card">
        <div class="summary-item summary-item--figo">
          <div class="summary-sys">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            FIGO 分期
          </div>
          <div
            class="summary-val figo-val"
            :contenteditable="isEditing"
            :class="{ 'editable-inline': isEditing }"
            @blur="e => c.figo_stage = e.target.textContent.trim()"
            :ref="el => editRefs.figo_stage = el"
          >{{ c.figo_stage || '—' }}</div>
          <div class="summary-hint">国际妇产科联合会（2023）</div>
        </div>

        <div class="summary-divider"></div>

        <div class="summary-item" :class="esgoColorClass">
          <div class="summary-sys">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ESGO 风险分层
          </div>
          <div v-if="!isEditing" class="summary-val">
            {{ c.esgo_risk_classification || store.profileResult?.esgo_risk_classification || '—' }}
          </div>
          <select
            v-else
            v-model="c.esgo_risk_classification"
            class="summary-val esgo-select-edit"
          >
            <option value="" disabled selected>请选择风险分层</option>
            <option v-for="opt in ['低危','中危','中高危','高危','未知']" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>
          <div class="summary-hint">欧洲妇科肿瘤学会风险分级</div>
        </div>

        <div class="summary-divider"></div>

        <div class="summary-item summary-item--vitals">
          <div class="summary-sys">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
            基本信息
          </div>
          <div class="vitals-row">
            <div class="vital-chip">
              <span class="vital-lbl">年龄</span>
              <input v-if="isEditing" v-model.number="c.age" type="number" min="0" max="120" class="vital-input" placeholder="岁" required/>
              <span v-else class="vital-val">{{ c.age || '—' }} 岁</span>
            </div>
            <div class="vital-chip">
              <span class="vital-lbl">绝经</span>
              <select v-if="isEditing" v-model="c.menopause" class="vital-select">
                <option value="yes">已绝经</option>
                <option value="no">未绝经</option>
                <option value="unknown">未知</option>
              </select>
              <span v-else class="vital-val">{{ menopauseLabel }}</span>
            </div>
            <div class="vital-chip">
              <span class="vital-lbl">BMI</span>
              <select v-if="isEditing" v-model.number="c.bmi_status" class="vital-select">
                <option :value="0">正常</option>
                <option :value="1">超重</option>
                <option :value="2">肥胖</option>
              </select>
              <span v-else class="vital-val">{{ bmiLabel }}</span>
            </div>
          </div>
          <div class="summary-hint">可在修改模式下编辑</div>
        </div>
      </div>

      <!-- ── AI 原始患者画像（移至 summary-bar 下方）── -->
      <div class="card profile-source-card">
        <button class="src-toggle" @click="showSrc = !showSrc">
          <div class="src-toggle-l">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
            AI 原始患者画像（patient_profile_md）— 字段填充依据
          </div>
          <div class="src-toggle-r">
            <span class="src-toggle-hint">{{ showSrc ? '收起' : '展开 / 编辑' }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              :style="{transform:showSrc?'rotate(180deg)':'',transition:'transform .2s'}">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>
        <Transition name="collapse">
          <div v-if="showSrc" class="src-body">
            <div class="src-edit-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              直接编辑下方文本即可修改原始画像；修改后点击右上角「保存修改」生效
            </div>
            <textarea
              v-model="localProfileMd"
              class="src-textarea"
              rows="14"
              :disabled="!isEditing"
              placeholder="患者画像原文…"
            ></textarea>
            <div v-if="isEditing" class="src-action-row">
              <button class="btn btn-secondary btn-sm" @click="reExtract">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                重新解析字段
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- ── Main 2-col Grid ── -->
      <div class="main-grid">

        <!-- ═══ LEFT COLUMN ═══ -->
        <div class="grid-col">

          <!-- §1 病理特征 -->
          <div class="card section-card">
            <div class="sec-title">
              <div class="sec-icon teal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              病理与转移特征
            </div>

            <div class="field-row-2 section-pad">
              <div class="field-item">
                <label class="form-label">组织学类型</label>
                <select v-model="c.histology_type" class="form-select" :disabled="!isEditing">
                  <option value="endometrioid">子宫内膜样癌</option>
                  <option value="serous">浆液性癌</option>
                  <option value="clear_cell">透明细胞癌</option>
                  <option value="carcinosarcoma">癌肉瘤</option>
                  <option value="mixed">混合型</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div class="field-item">
                <label class="form-label">组织学分级</label>
                <select v-model="c.grade" class="form-select" :disabled="!isEditing">
                  <option value="G1">G1（高分化）</option>
                  <option value="G2">G2（中分化）</option>
                  <option value="G3">G3（低分化）</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
            </div>

            <div class="ai-detail-row section-pad">
              <div class="ai-detail-item">
                <div class="ai-detail-lbl">
                  <span class="ai-tag">AI 概述</span>组织学详细描述
                </div>
                <div
                  class="ai-detail-text"
                  :contenteditable="isEditing"
                  :class="{ 'editable-block': isEditing }"
                  @blur="e => c.histology_detail = e.target.textContent.trim()"
                >{{ c.histology_detail || extractedPathology.histologyDetail || '—' }}</div>
              </div>
              <div class="ai-detail-item">
                <div class="ai-detail-lbl">
                  <span class="supp-tag">补充说明</span>医生补充
                </div>
                <textarea
                  v-model="c.histology_supplement"
                  class="form-textarea supp-textarea"
                  :disabled="!isEditing"
                  placeholder="补充诊断意见，可留空…"
                  rows="2"
                ></textarea>
              </div>
            </div>

            <div class="field-row-2 section-pad">
              <div class="field-item">
                <label class="form-label">肌层浸润比例</label>
                <select v-model="c.myometrial_invasion_ratio" class="form-select" :disabled="!isEditing">
                  <option value="<50%">&lt;50%（浅）</option>
                  <option value=">=50%">≥50%（深）</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div class="field-item">
                <label class="form-label">浸润深度 (mm)</label>
                <input v-model="c.myometrial_invasion_depth" type="number" min="0" step="0.1" class="form-input" :disabled="!isEditing" placeholder="mm"/>
              </div>
              <div class="field-item">
                <label class="form-label">宫颈受累</label>
                <select v-model="c.cervical_involvement" class="form-select" :disabled="!isEditing">
                  <option value="none">未受累</option>
                  <option value="glandular">腺体受累</option>
                  <option value="stromal">间质浸润</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div class="field-item">
                <label class="form-label">附件受累</label>
                <select v-model.number="c.adnexal_involvement" class="form-select" :disabled="!isEditing">
                  <option :value="0">未受累</option>
                  <option :value="1">受累</option>
                </select>
              </div>
            </div>

            <div class="ai-detail-row section-pad">
              <div class="ai-detail-item">
                <div class="ai-detail-lbl"><span class="ai-tag">AI 概述</span>浸润与周围受累</div>
                <div
                  class="ai-detail-text"
                  :contenteditable="isEditing"
                  :class="{ 'editable-block': isEditing }"
                  @blur="e => c.invasion_detail = e.target.textContent.trim()"
                >{{ c.invasion_detail || extractedPathology.invasionDetail || '—' }}</div>
              </div>
              <div class="ai-detail-item">
                <div class="ai-detail-lbl"><span class="supp-tag">补充说明</span>医生补充</div>
                <textarea v-model="c.invasion_supplement" class="form-textarea supp-textarea" :disabled="!isEditing" placeholder="补充内容，可留空…" rows="2"></textarea>
              </div>
            </div>

            <div class="field-row-2 section-pad">
              <div class="field-item">
                <label class="form-label">脉管癌栓 (LVSI)</label>
                <select v-model="c.lvsi" class="form-select" :disabled="!isEditing">
                  <option value="positive">阳性</option>
                  <option value="negative">阴性</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div class="field-item">
                <label class="form-label">显著 LVSI</label>
                <select v-model.number="c.lvsi_substantial" class="form-select" :disabled="!isEditing">
                  <option :value="0">无 / 仅局灶</option>
                  <option :value="1">存在显著 LVSI</option>
                </select>
              </div>
            </div>
          </div>

          <!-- §2 淋巴结与腹腔细胞学 -->
          <div class="card section-card">
            <div class="sec-title">
              <div class="sec-icon purple">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>
              </div>
              淋巴结与腹腔细胞学
            </div>
            <div class="field-row-2 section-pad">
              <div class="field-item">
                <label class="form-label">盆腔淋巴结</label>
                <input v-model="c.lymph_node_pelvic" class="form-input" :disabled="!isEditing" placeholder="如 0/12 / negative" pattern="^(negative|positive|unknown|\d+/\d+)$"/>
                <div class="field-hint">negative / positive / unknown / X/Y 格式</div>
              </div>
              <div class="field-item">
                <label class="form-label">腹主动脉旁淋巴结</label>
                <input v-model="c.lymph_node_paraaortic" class="form-input" :disabled="!isEditing" placeholder="如 0/8" pattern="^(negative|positive|unknown|\d+/\d+)$"/>
              </div>
              <div class="field-item span-2">
                <label class="form-label">腹腔冲洗液细胞学</label>
                <select v-model="c.peritoneal_cytology" class="form-select" :disabled="!isEditing">
                  <option value="negative">阴性</option>
                  <option value="positive">阳性</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
            </div>
            <div class="ai-detail-row section-pad">
              <div class="ai-detail-item">
                <div class="ai-detail-lbl"><span class="ai-tag">AI 概述</span>淋巴结状态</div>
                <div
                  class="ai-detail-text"
                  :contenteditable="isEditing"
                  :class="{ 'editable-block': isEditing }"
                  @blur="e => c.lymph_detail = e.target.textContent.trim()"
                >{{ c.lymph_detail || extractedPathology.lymphDetail || '—' }}</div>
              </div>
              <div class="ai-detail-item">
                <div class="ai-detail-lbl"><span class="supp-tag">补充说明</span>医生补充</div>
                <textarea v-model="c.lymph_supplement" class="form-textarea supp-textarea" :disabled="!isEditing" placeholder="补充说明，可留空…" rows="2"></textarea>
              </div>
            </div>
          </div>

        </div>

        <!-- ═══ RIGHT COLUMN ═══ -->
        <div class="grid-col">

          <!-- §3 分子标志物 -->
          <div class="card section-card">
            <div class="sec-title">
              <div class="sec-icon rose">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              </div>
              分子标志物
            </div>
            <div class="field-row-2 section-pad">
              <div class="field-item">
                <label class="form-label">p53 状态</label>
                <select v-model="c.p53" class="form-select" :disabled="!isEditing" :class="c.p53 === 'mutant' ? 'sel-warn' : ''">
                  <option value="wild">野生型</option>
                  <option value="mutant">突变型</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div class="field-item">
                <label class="form-label">MMR 状态</label>
                <select v-model="c.mmr" class="form-select" :disabled="!isEditing">
                  <option value="proficient">完整 (pMMR)</option>
                  <option value="deficient">缺陷 (dMMR)</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div class="field-item span-2">
                <label class="form-label">分子分型</label>
                <select v-model="c.molecular_subtype" class="form-select" :disabled="!isEditing">
                  <option value="POLEmut">POLE 超突变型</option>
                  <option value="MMRd">MMRd（dMMR / MSI-H）</option>
                  <option value="NSMP">NSMP（低拷贝数型）</option>
                  <option value="p53abn">p53abn（高拷贝数型）</option>
                  <option value="unknown">未知 / 待检</option>
                </select>
              </div>
            </div>

            <div class="ai-detail-row section-pad">
              <div class="ai-detail-item">
                <div class="ai-detail-lbl"><span class="ai-tag">AI 概述</span>免疫组化关键指标</div>
                <div
                  class="ai-detail-text"
                  :contenteditable="isEditing"
                  :class="{ 'editable-block': isEditing }"
                  @blur="e => c.molecular_detail = e.target.textContent.trim()"
                >{{ c.molecular_detail || extractedPathology.molecularDetail || '—' }}</div>
              </div>
              <div class="ai-detail-item">
                <div class="ai-detail-lbl"><span class="supp-tag">补充说明</span>医生补充</div>
                <textarea v-model="c.molecular_supplement" class="form-textarea supp-textarea" :disabled="!isEditing" placeholder="如 NGS 结果、二代测序补充，可留空…" rows="2"></textarea>
              </div>
            </div>

            <div v-if="c.molecular_subtype === 'unknown'" class="mol-warn section-pad-bottom">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              分子分型未知时，指南解析将使用条件句式。建议完善 NGS 或 IHC 检测后再生成方案。
            </div>
            <div v-if="c.p53 === 'mutant' && c.molecular_subtype === 'unknown'" class="mol-warn mol-warn--amber section-pad-bottom">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
              IHC p53 突变型 ≠ 分子 p53abn。需 NGS/Sanger 测序确认后方可设为 p53abn。
            </div>
          </div>

          <!-- §4 合并症与全身状态 -->
          <div class="card section-card">
            <div class="sec-title">
              <div class="sec-icon amber">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              合并症与全身状态
            </div>

            <!-- AI 概述独立模块 -->
            <div class="comor-ai-overview section-pad">
              <div class="ai-detail-lbl" style="margin-bottom:6px;">
                <span class="ai-tag">AI 概述</span>合并症综合摘要
              </div>
              <div
                class="ai-detail-text"
                :contenteditable="isEditing"
                :class="{ 'editable-block': isEditing }"
                @blur="e => c.comorbidity_ai_overview = e.target.textContent.trim()"
              >{{ c.comorbidity_ai_overview || extractedPathology.comorbidity_source || '暂无自动提取内容' }}</div>
            </div>

            <!-- 合并症表头（三列：项目 / 补充说明 / 状态） -->
            <div class="comor-table">
              <div class="comor-thead">
                <div class="comor-th comor-th--name">项目</div>
                <div class="comor-th comor-th--supp">医生补充说明</div>
                <div class="comor-th comor-th--status">状态</div>
              </div>
              <div
                v-for="item in comorbidityFields"
                :key="item.key"
                class="comor-row"
                :class="getComorbidityAlert(item)"
              >
                <div class="comor-td comor-td--name">
                  <span class="comor-name">{{ item.label }}</span>
                  <div v-if="getComorbidityAlert(item)" class="comor-dot"></div>
                </div>
                <div class="comor-td comor-td--supp">
                  <textarea
                    v-model="getComorbiditySupp(item.key).value"
                    class="comor-supp-input"
                    :disabled="!isEditing"
                    placeholder="医生补充，可留空…"
                    rows="1"
                    @input="setComorbiditySupp(item.key, $event.target.value)"
                  ></textarea>
                  <div v-if="item.warn && c[item.key] > 0" class="comor-warn-txt">{{ item.warn }}</div>
                </div>
                <div class="comor-td comor-td--status">
                  <select
                    v-model.number="c[item.key]"
                    class="form-select form-select-sm"
                    :disabled="!isEditing"
                    :class="getSelectColor(item)"
                  >
                    <option v-for="opt in item.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
              </div>

              <!-- 其他情况补充说明行 -->
              <div class="comor-row comor-row--other">
                <div class="comor-td comor-td--name">
                  <span class="comor-name">其他情况</span>
                </div>
                <div class="comor-td comor-td--supp comor-td--other-full" style="grid-column: span 2;">
                  <textarea
                    v-model="c.comorbidity_other"
                    class="comor-supp-input comor-other-input"
                    :disabled="!isEditing"
                    placeholder="医生自主填写：补充以上未涵盖的合并症、既往手术史、用药史或其他需关注的全身情况…"
                    rows="2"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- §5 检索设置 + 操作 -->
          <div class="card section-card action-card">
            <div class="topk-row">
              <label class="form-label" style="margin:0">相似病例检索数量</label>
              <select v-model="topK" class="form-select" style="width:100px">
                <option :value="3">3 例</option>
                <option :value="5">5 例</option>
                <option :value="10">10 例</option>
              </select>
            </div>
            <button class="btn btn-cta submit-btn" @click="submit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              确认并生成 MDT 治疗方案
            </button>
            <button class="btn btn-secondary skip-btn" @click="skip">
              跳过，仅凭分期生成方案
            </button>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDiagnosisStore } from '../stores/diagnosis'

const store  = useDiagnosisStore()
const router = useRouter()

const showSrc    = ref(false)
const autoFilled = ref(false)
const topK       = ref(3)
const isEditing  = ref(false)
const editRefs   = reactive({})

const c = reactive({ ...store.clinicalInfo })
const localProfileMd = ref(store.profileResult?.patient_profile_md || '')

// ── 切换病例时重置本地 UI 状态 ──────────────────────────────
watch(() => store.activeCaseId, () => {
  // 先清理上一病例残留在 c 中的提取字段（histology_detail / invasion_detail / lymph_detail
  // / molecular_detail / comorbidity_source / menopause / comorbidity_supps 等），
  // Object.assign 不会删除 target 中 source 不存在的 key，必须显式清理防泄漏。
  const whitelist = new Set(Object.keys(store.clinicalInfo))
  for (const k of Object.keys(c)) {
    if (!whitelist.has(k)) delete c[k]
  }
  Object.assign(c, store.clinicalInfo)
  localProfileMd.value = store.profileResult?.patient_profile_md || ''
  // 从新病例画像重新提取病理学详情
  if (localProfileMd.value) {
    const ext = extractAllFromMd(localProfileMd.value)
    Object.entries(ext).forEach(([k, v]) => { if (!c[k]) c[k] = v })
  }
  showSrc.value = false
  autoFilled.value = false
  isEditing.value = false
  Object.keys(editRefs).forEach(k => delete editRefs[k])
  snapshot = {}
})

let snapshot = {}
function startEdit() {
  snapshot = JSON.parse(JSON.stringify({ ...c }))
  isEditing.value = true
  const validESGO = ['低危', '中危', '中高危', '高危', '未知']
  if (!validESGO.includes(c.esgo_risk_classification)) {
    c.esgo_risk_classification = ''
  }
}
function cancelEdit() {
  Object.assign(c, snapshot)
  localProfileMd.value = store.profileResult?.patient_profile_md || ''
  isEditing.value = false
}
async function saveEdit() {
  Object.entries(editRefs).forEach(([key, el]) => {
    if (el) c[key] = el.textContent.trim()
  })
  if (store.profileResult) {
    store.profileResult.patient_profile_md = localProfileMd.value
    store.profileResult.figo_stage = c.figo_stage
    store.profileResult.esgo_risk_classification = c.esgo_risk_classification
  }
  store.setClinicalInfo({ ...c })
  await store.persist()
  isEditing.value = false
}

function reExtract() {
  const md = localProfileMd.value
  const extracted = extractAllFromMd(md)
  Object.assign(c, extracted)
}

onMounted(() => {
  Object.assign(c, store.clinicalInfo)
  localProfileMd.value = store.profileResult?.patient_profile_md || ''
  autoFilled.value = !!store.profileResult?.new_patient_dict

  if (store.profileResult?.patient_profile_md) {
    const extracted = extractAllFromMd(store.profileResult.patient_profile_md)
    Object.entries(extracted).forEach(([k, v]) => {
      if (!c[k]) c[k] = v
    })
  }
})

watch(() => store.clinicalInfo, (v) => { Object.assign(c, v) }, { deep: true })
watch(() => store.profileResult, (v) => {
  if (v?.patient_profile_md) localProfileMd.value = v.patient_profile_md
  autoFilled.value = !!v?.new_patient_dict
  Object.assign(c, store.clinicalInfo)
}, { deep: true })

function extractSection(md, ...keys) {
  for (const key of keys) {
    const re = new RegExp(`${key}[：:]\\s*(.+?)(?=\\n\\s*-|\\n\\s*\\*\\*|$)`, 'ms')
    const m = md.match(re)
    if (m) return m[1].replace(/\n\s*-/g, '\n-').trim()
  }
  return ''
}

function extractAllFromMd(md) {
  if (!md) return {}
  const plain = md.replace(/\*\*/g, '')
  return {
    histology_detail:   extractSection(plain, '组织学类型', '组织学详细'),
    invasion_detail:    extractSection(plain, '浸润与周围受累', '浸润深度', '宫颈受累'),
    lymph_detail:       extractSection(plain, '淋巴结状态', '淋巴结转移'),
    molecular_detail:   extractSection(plain, '分子分型关键指标', '免疫组化'),
    comorbidity_source: extractSection(plain, '合并症与既往史', '既往史', '合并症'),
  }
}

const extractedPathology = computed(() => extractAllFromMd(store.profileResult?.patient_profile_md || ''))

const COMOR_KEYS_ZH = {
  glycemic_status:      ['糖尿病', '血糖', '胰岛素', 'PCOS', '糖耐量'],
  hypertension:         ['高血压'],
  bmi_status:           ['BMI', '肥胖', '超重', '体重'],
  hyperlipidemia:       ['高脂血症', '脂肪肝', '高脂'],
  anemia:               ['贫血'],
  hepatic_viral:        ['乙肝', '丙肝', '戊肝', '肝炎', '病毒性肝'],
  hepatic_dysfunction:  ['肝功能', '肝功异常', '肝硬化'],
  major_cv_risk:        ['心血管', '冠心病', '脑梗', '肾功能不全', '心脏病'],
  hpv_status:           ['HPV', '人乳头瘤'],
}

function getComorbiditySupp(key) {
  if (!c.comorbidity_supps) c.comorbidity_supps = {}
  return {
    get value() { return c.comorbidity_supps[key] || '' },
    set value(v) { c.comorbidity_supps[key] = v }
  }
}
function setComorbiditySupp(key, val) {
  if (!c.comorbidity_supps) c.comorbidity_supps = {}
  c.comorbidity_supps[key] = val
}

const menopauseLabel = computed(() => ({ yes: '已绝经', no: '未绝经', unknown: '未知' }[c.menopause] || '—'))
const bmiLabel = computed(() => ({ 0: '正常', 1: '超重', 2: '肥胖' }[c.bmi_status] || '—'))

const esgoColorClass = computed(() => {
  const v = c.esgo_risk_classification || store.profileResult?.esgo_risk_classification || ''
  if (v.includes('高危') && !v.includes('中高')) return 'esgo-high'
  if (v.includes('中高')) return 'esgo-hiinter'
  if (v.includes('中危')) return 'esgo-inter'
  if (v.includes('低危')) return 'esgo-low'
  if (v.includes('晚期')) return 'esgo-adv'
  return 'esgo-unk'
})

const comorbidityFields = [
  { key: 'glycemic_status', label: '血糖状态',
    options: [{value:0,label:'正常'},{value:1,label:'糖耐量异常/胰岛素抵抗'},{value:2,label:'糖尿病'}] },
  { key: 'hypertension', label: '高血压',
    options: [{value:0,label:'无'},{value:1,label:'有'}] },
  { key: 'bmi_status', label: 'BMI / 体重',
    options: [{value:0,label:'正常'},{value:1,label:'超重 (24–28)'},{value:2,label:'肥胖 (≥28)'}] },
  { key: 'hyperlipidemia', label: '高脂血症',
    options: [{value:0,label:'无'},{value:1,label:'有（高脂/脂肪肝）'}] },
  { key: 'anemia', label: '贫血程度',
    options: [{value:0,label:'无'},{value:1,label:'轻度'},{value:2,label:'中重度'}],
    warn: '中重度贫血时化疗风险升高' },
  { key: 'hepatic_viral', label: '病毒性肝炎',
    options: [{value:0,label:'无'},{value:1,label:'有（乙肝/戊肝）'}],
    warn: '⚠️ 活动性肝炎须先抗病毒治疗' },
  { key: 'hepatic_dysfunction', label: '肝功能异常',
    options: [{value:0,label:'无'},{value:1,label:'有'}],
    warn: '肝功能异常影响化疗药物代谢' },
  { key: 'major_cv_risk', label: '严重心血管风险',
    options: [{value:0,label:'无'},{value:1,label:'有（脑梗/冠心病/肾功）'}],
    warn: '建议 MDT 评估放化疗耐受' },
  { key: 'hpv_status', label: 'HPV 感染',
    options: [{value:0,label:'无'},{value:1,label:'有（高危 HPV）'}] },
]

function getComorbidityAlert(item) {
  const v = c[item.key]
  if (!v || v === 0) return ''
  if (item.key === 'hepatic_viral') return 'alert-critical'
  if (item.key === 'major_cv_risk' || item.key === 'hepatic_dysfunction') return 'alert-high'
  if (item.key === 'anemia' && v >= 2) return 'alert-mid'
  return ''
}
function getSelectColor(item) {
  const v = c[item.key]
  if (!v || v === 0) return ''
  if (item.key === 'hepatic_viral' && v > 0) return 'sel-critical'
  if ((item.key === 'major_cv_risk' || item.key === 'hepatic_dysfunction') && v > 0) return 'sel-warn'
  return ''
}

function goBack() { router.push('/figo') }

async function submit() {
  store.setClinicalInfo({ ...c })
  await store.persist()
  store.extraKeywords = topK.value
  store.setStep(2)
  router.push('/treatment')
}

function skip() {
  store.setStep(2)
  router.push('/treatment')
}
</script>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────────────────── */
.profile-page { min-height: 100vh; padding: 24px 24px 56px; }
.page-wrap { max-width: 1440px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

/* ── Header ─────────────────────────────────────────────────────────────── */
.pg-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.pg-header-l { display: flex; flex-direction: column; gap: 10px; }
.pg-step { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--accent-blue); }
.pg-title { font-size: 24px; font-family: var(--font-serif); margin-top: 2px; }
.pg-sub { font-size: 13px; color: var(--text-secondary); margin-top: 3px; }
.pg-header-r { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.autofill-badge {
  display: flex; align-items: center; gap: 5px; padding: 5px 12px;
  background: var(--accent-green-light); border: 1px solid var(--accent-green-mid);
  border-radius: 100px; font-size: 12px; font-weight: 600; color: var(--accent-green);
}

/* ── Summary Bar ────────────────────────────────────────────────────────── */
.summary-bar { display: flex; align-items: stretch; padding: 0; overflow: hidden; }
.summary-item { flex: 1; padding: 14px 20px; display: flex; flex-direction: column; gap: 4px; }
.summary-item--figo { border-right: 1px solid var(--border); }
.summary-item--vitals { border-left: 1px solid var(--border); }
.summary-divider { width: 1px; background: var(--border); flex-shrink: 0; }
.summary-sys {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-muted);
}
.summary-val { font-size: 20px; font-weight: 700; font-family: var(--font-serif); line-height: 1.2; color: var(--text-primary); }
.figo-val { color: var(--accent-blue); font-size: 22px; }
.summary-hint { font-size: 11px; color: var(--text-muted); }
.esgo-high    { background: var(--accent-rose-light); }
.esgo-high .summary-val { color: var(--accent-rose); }
.esgo-hiinter { background: var(--accent-amber-light); }
.esgo-hiinter .summary-val { color: var(--accent-amber); }
.esgo-inter   { background: var(--accent-blue-light); }
.esgo-inter .summary-val { color: var(--accent-blue); }
.esgo-low     { background: var(--accent-green-light); }
.esgo-low .summary-val { color: var(--accent-green); }
.esgo-adv     { background: var(--accent-purple-light); }
.esgo-adv .summary-val { color: var(--accent-purple); }
.esgo-unk     { background: var(--bg-2); }
.esgo-select-edit {
  font-size: 20px; font-weight: 700; font-family: var(--font-serif); line-height: 1.2;
  border: 1px dashed var(--accent-blue); border-radius: var(--radius-sm);
  padding: 2px 6px; background: transparent; color: inherit;
  width: 100%; box-sizing: border-box; cursor: pointer;
}
.esgo-select-edit:focus { outline: 2px solid var(--accent-blue); border-style: solid; }
.vitals-row { display: flex; gap: 8px; flex-wrap: wrap; }
.vital-chip { display: flex; align-items: center; gap: 5px; }
.vital-lbl { font-size: 11px; color: var(--text-muted); }
.vital-val { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.vital-input { width: 56px; font-size: 13px; }
.vital-select { font-size: 12px; padding: 3px 6px; }

/* ── Main 2-col grid ────────────────────────────────────────────────────── */
.main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: stretch; }
.grid-col { display: flex; flex-direction: column; gap: 16px; height: 100%; }

/* ── Section cards ──────────────────────────────────────────────────────── */
.section-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.sec-title {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 18px 10px; border-bottom: 1px solid var(--border);
  font-size: 13px; font-weight: 700; color: var(--text-primary);
}
.sec-title-hint { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: auto; }
.sec-icon { width: 26px; height: 26px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sec-icon.blue   { background: var(--accent-blue-light);   color: var(--accent-blue); }
.sec-icon.teal   { background: var(--accent-teal-light);   color: var(--accent-teal); }
.sec-icon.amber  { background: var(--accent-amber-light);  color: var(--accent-amber); }
.sec-icon.purple { background: var(--accent-purple-light); color: var(--accent-purple); }
.sec-icon.rose   { background: var(--accent-rose-light);   color: var(--accent-rose); }
.section-pad { padding: 12px 18px; border-bottom: 1px solid var(--border); }
.section-pad:last-child { border-bottom: none; }
.section-pad-bottom { padding: 0 18px 12px; }

/* ── Field grids ────────────────────────────────────────────────────────── */
.field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.field-item { display: flex; flex-direction: column; gap: 5px; }
.field-item.span-2 { grid-column: span 2; }
.field-hint { font-size: 11px; color: var(--text-muted); }
.form-input:disabled,
.form-select:disabled,
.form-textarea:disabled { opacity: 0.75; cursor: default; background: var(--bg-2); }

/* ── AI概述 + 补充说明 row ──────────────────────────────────────────────── */
.ai-detail-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ai-detail-item { display: flex; flex-direction: column; gap: 5px; }
.ai-detail-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .06em;
}
.ai-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--accent-blue-light); color: var(--accent-blue);
  font-weight: 700; letter-spacing: .04em;
}
.supp-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--accent-green-light); color: var(--accent-green);
  font-weight: 700; letter-spacing: .04em;
}
.ai-detail-text {
  font-size: 12px; color: var(--text-secondary); line-height: 1.65;
  background: var(--bg-2); border-radius: var(--radius-sm);
  padding: 7px 10px; min-height: 40px;
  border: 1px solid transparent;
}
.supp-textarea { font-size: 12px; resize: none; }
.editable-inline { border: 1px dashed var(--accent-blue) !important; border-radius: var(--radius-sm); padding: 2px 6px; outline: none; cursor: text; }
.editable-block { border: 1px dashed var(--accent-blue) !important; background: var(--accent-blue-light) !important; outline: none; cursor: text; }

/* ── 合并症 AI 概述独立模块 ─────────────────────────────────────────────── */
.comor-ai-overview { background: var(--bg-2); }

/* ── Comorbidity table（三列） ──────────────────────────────────────────── */
.comor-table { display: flex; flex-direction: column; }
.comor-thead {
  display: grid;
  grid-template-columns: 110px 1fr 150px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  padding: 0 4px;
}
.comor-th { padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
.comor-row {
  display: grid;
  grid-template-columns: 110px 1fr 150px;
  border-bottom: 1px solid var(--border);
  transition: background .12s;
}
.comor-row:last-child { border-bottom: none; }
.comor-row--other { grid-template-columns: 110px 1fr; }
.comor-td { padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; gap: 3px; border-right: 1px solid var(--border); }
.comor-td:last-child { border-right: none; }
.comor-td--name { flex-direction: row; align-items: center; gap: 6px; }
.comor-td--other-full { grid-column: span 2; border-right: none; }
.comor-name { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.comor-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-rose); flex-shrink: 0; }
.comor-supp-input {
  width: 100%; font-size: 11.5px; line-height: 1.5;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  resize: none; background: transparent; color: var(--text-secondary);
  padding: 2px 0; outline: none; font-family: inherit;
}
.comor-supp-input:not(:disabled) { border-color: var(--border); background: var(--bg-1); padding: 4px 6px; }
.comor-supp-input::placeholder { color: var(--text-muted); }
.comor-other-input { font-size: 12px; }
.comor-warn-txt { font-size: 11px; color: var(--accent-amber); margin-top: 3px; line-height: 1.35; }
.alert-critical { background: var(--accent-rose-light); }
.alert-high  { background: var(--accent-amber-light); }
.alert-mid   { background: #fffbeb; }
.form-select-sm { font-size: 12px; padding: 5px 8px; }
.sel-critical { border-color: var(--accent-rose) !important; color: var(--accent-rose); }
.sel-warn     { border-color: var(--accent-amber) !important; color: var(--accent-amber); }

/* ── Molecular warnings ─────────────────────────────────────────────────── */
.mol-warn {
  display: flex; align-items: flex-start; gap: 5px;
  margin: 0 18px; padding: 8px 10px; background: var(--bg-2);
  border-radius: var(--radius-sm); font-size: 12px; color: var(--text-secondary); line-height: 1.5;
}
.mol-warn--amber { background: var(--accent-amber-light); border: 1px solid var(--accent-amber-mid); color: var(--accent-amber); }

/* ── Action card ────────────────────────────────────────────────────────── */
.action-card { margin-top: auto; padding: 18px !important; display: flex; flex-direction: column; gap: 10px; }
.topk-row { display: flex; align-items: center; justify-content: space-between; }
.submit-btn { width: 100%; justify-content: center; }
.skip-btn   { width: 100%; justify-content: center; }

/* ── Source card（已移至 summary-bar 下方）──────────────────────────────── */
.profile-source-card { padding: 0; overflow: hidden; }
.src-toggle {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 18px; background: transparent; border: none; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--text-secondary); width: 100%;
}
.src-toggle:hover { background: var(--bg-2); }
.src-toggle-l { display: flex; align-items: center; gap: 7px; }
.src-toggle-r { display: flex; align-items: center; gap: 6px; }
.src-toggle-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.src-body { border-top: 1px solid var(--border); padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }
.src-edit-hint {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-muted);
  padding: 7px 10px; background: var(--bg-2); border-radius: var(--radius-sm);
}
.src-textarea {
  font-family: var(--font-mono); font-size: 12px; line-height: 1.7;
  width: 100%; resize: vertical; background: var(--bg-1);
  border-radius: var(--radius-md); padding: 12px 14px;
  border: 1px solid var(--border); color: var(--text-secondary);
}
.src-textarea:not(:disabled) { border-color: var(--accent-blue-mid); background: var(--accent-blue-light); }
.src-action-row { display: flex; justify-content: flex-end; }

/* ── Collapse transition ────────────────────────────────────────────────── */
.collapse-enter-active, .collapse-leave-active {
  transition: opacity .2s, max-height .25s ease;
  overflow: hidden; max-height: 600px;
}
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; }
</style>