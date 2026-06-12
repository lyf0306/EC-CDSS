// Mock API — simulates 1s backend delay

export function mockFIGOAnalysis(pathologyText) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        thinking: `【分析过程】

1. 病理类型识别：
   报告提示子宫内膜样腺癌，G2（中分化），这是子宫内膜癌最常见的组织学类型，占所有子宫内膜癌的约80%。

2. 肌层浸润深度评估：
   报告提示肌层浸润深度 > 1/2，即深肌层浸润。依据FIGO 2023分期系统，深肌层浸润（≥1/2）是判断分期的关键指标。

3. 宫颈累及情况：
   报告描述宫颈间质受累，这是FIGO分期中明确定义的分期升级指标。宫颈间质浸润意味着肿瘤已扩散至宫颈组织层，但尚未超出子宫。

4. 淋巴结状态：
   盆腔淋巴结检出转移1/15，提示区域淋巴结转移，这将影响最终分期。

5. 腹腔冲洗液：
   腹腔冲洗液细胞学阳性，需结合其他指标综合考量。

6. FIGO 2023分期逻辑推演：
   - 基础病变（肌层浸润 > 1/2）→ IB期
   - 宫颈间质受累 → 升级为 II 期
   - 盆腔淋巴结阳性 → 升级为 IIIC1 期

7. 综合判断：
   基于以上各维度分析，结合FIGO 2023最新分期标准（FIGO 2023 staging of endometrial carcinoma），本例最终分期确定为FIGO IIIC1期。`,
        figo: 'IIIC1期',
        stage_detail: {
          primary: 'IIIC1期',
          grade: 'G2（中分化）',
          histology: '子宫内膜样腺癌',
          myometrial_invasion: '深肌层浸润（>1/2）',
          cervical_involvement: '宫颈间质受累',
          lymph_nodes: '盆腔淋巴结阳性（1/15）',
          cytology: '腹腔冲洗液细胞学阳性',
        }
      })
    }, 1200)
  })
}

export function mockTreatmentPlan(figo, clinicalInfo) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        surgery: {
          name: '全子宫+双侧附件+盆腔淋巴结清扫术',
          detail: '推荐腹腔镜辅助下全子宫切除+双侧输卵管卵巢切除+系统性盆腔淋巴结清扫+腹主动脉旁淋巴结取样',
          level: 'A类推荐',
        },
        chemotherapy: {
          name: '紫杉醇 + 卡铂（TC方案）× 6周期',
          detail: '紫杉醇175mg/m² + 卡铂AUC 5，每3周为一周期，共6周期。推荐在术后4-6周开始，联合放疗同步进行。',
          level: 'A类推荐',
          regimen: [
            { drug: '紫杉醇', dose: '175 mg/m²', route: '静脉滴注（3h）', day: 'D1' },
            { drug: '卡铂', dose: 'AUC 5', route: '静脉滴注（1h）', day: 'D1' },
          ]
        },
        radiotherapy: {
          name: '盆腔外照射放疗（EBRT）',
          detail: '盆腔IMRT 45-50.4 Gy，分25-28次，同步含铂化疗（顺铂40mg/m²，每周一次）。术后可补充阴道近距离放疗（5 Gy×3次）。',
          level: 'A类推荐',
        },
        targeted_therapy: {
          name: '免疫/靶向治疗（可选）',
          detail: 'dMMR/MSI-H患者推荐添加帕博利珠单抗200mg（每3周）；TP53突变患者可考虑参加临床试验。本例需完善分子分型检测。',
          level: 'B类推荐（依分子分型）',
        },
        followup: '治疗结束后前2年每3月随访一次，第3-5年每6月一次，5年后每年一次。随访内容包括体格检查、妇科检查、CA125及影像学检查。'
      })
    }, 1200)
  })
}

export function mockEvidenceSearch(patientFeatures, keywords) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 1,
          title: 'NCCN临床实践指南：子宫肿瘤（2024.V1）',
          content: '对于FIGO IIIC1期子宫内膜癌，NCCN指南推荐以铂类为基础的化疗联合放疗作为术后辅助治疗标准方案（1类证据）。TC方案（紫杉醇+卡铂）是首选化疗方案，与放疗的序贯或同步模式均有循证依据支持。对于dMMR/MSI-H患者，指南新增帕博利珠单抗作为辅助治疗选项。',
          source: 'NCCN',
          year: 2024,
          evidence_level: 'Level 1',
          link: 'https://www.nccn.org',
          highlighted: false,
          hidden: false,
        },
        {
          id: 2,
          title: 'ESGO/ESTRO/ESP子宫内膜癌管理指南（2023）',
          content: 'ESGO联合指南将IIIC1期患者归类为高危组，推荐化疗联合放疗（化放疗，CRT）作为辅助治疗。证据显示与单纯放疗相比，联合化疗显著改善5年无病生存率（DFS HR 0.74，P=0.007）。对分子分型为p53突变型患者，推荐更积极的全身治疗。',
          source: 'ESGO',
          year: 2023,
          evidence_level: 'Level 1',
          link: 'https://www.esgo.org',
          highlighted: false,
          hidden: false,
        },
        {
          id: 3,
          title: 'PORTEC-3随机对照试验：化放疗vs单纯放疗（Lancet Oncol, 2022）',
          content: 'PORTEC-3试验纳入686例高危子宫内膜癌患者，随机分配至化放疗组（顺铂同步放疗+卡铂/紫杉醇辅助化疗）与单纯放疗组。随访7年结果显示：化放疗组5年OS为80.8% vs 76.7%（HR 0.71, P=0.034），IIIC期亚组获益更为显著（HR 0.58）。',
          source: 'Lancet Oncol',
          year: 2022,
          evidence_level: 'RCT Level 1b',
          link: 'https://doi.org/10.1016/S1470-2045(22)00535-2',
          highlighted: false,
          hidden: false,
        },
        {
          id: 4,
          title: 'NRG-GY018随机对照试验：帕博利珠单抗联合化疗（NEJM, 2023）',
          content: '该III期RCT研究了帕博利珠单抗联合TC化疗用于晚期/复发子宫内膜癌的疗效。dMMR队列中，帕博利珠单抗组1年PFS率为74.0% vs 38.1%（HR 0.30, P<0.001）；pMMR队列亦有显著获益（HR 0.54）。本研究支持帕博利珠单抗作为一线治疗的重要补充。',
          source: 'NEJM',
          year: 2023,
          evidence_level: 'RCT Level 1b',
          link: 'https://doi.org/10.1056/NEJMoa2302312',
          highlighted: false,
          hidden: false,
        },
        {
          id: 5,
          title: 'TCGA子宫内膜癌分子分型与预后研究（Nature, 2013, updated 2023）',
          content: 'TCGA将子宫内膜癌分为4种分子亚型：POLE超突变型、MSI高频突变型、低拷贝数型（内膜样）、高拷贝数型（浆液样）。POLE超突变型预后最好，p53突变/高拷贝数型预后最差。分子分型已被2023 FIGO分期系统整合，成为指导辅助治疗选择的重要依据。',
          source: 'Nature/TCGA',
          year: 2023,
          evidence_level: 'Cohort Study Level 2',
          link: 'https://doi.org/10.1038/nature12113',
          highlighted: false,
          hidden: false,
        },
      ])
    }, 1400)
  })
}
