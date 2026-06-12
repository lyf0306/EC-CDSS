# 子宫内膜癌 AI 临床决策支持系统 — 前端文档

> **内容介绍：**
> 这是毕设项目的完整前端交接文档，覆盖项目结构、各模块功能、与后端的所有接口对接方式、状态管理逻辑及常见维护指引。

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈与依赖](#2-技术栈与依赖)
3. [目录结构](#3-目录结构)
4. [快速启动](#4-快速启动)
5. [路由设计](#5-路由设计)
6. [全局状态管理（Pinia Store）](#6-全局状态管理pinia-store)
7. [API 对接层详解](#7-api-对接层详解)
8. [各页面功能说明](#8-各页面功能说明)
9. [公共组件说明](#9-公共组件说明)
10. [工具模块说明](#10-工具模块说明)
11. [Mock 数据说明](#11-mock-数据说明)
12. [样式系统](#12-样式系统)
13. [后端接口汇总](#13-后端接口汇总)
14. [常见问题与维护指引](#14-常见问题与维护指引)

---

## 1. 项目概览

本项目是一个面向妇科肿瘤科的 **AI 辅助临床决策系统**前端，核心功能为：

- 输入术后病理报告文本（支持手动输入或导入 `.docx` / `.pdf` / `.txt` 文件）
- 调用后端 AI（OriClinical vLLM）完成 **FIGO 2023 分期诊断**
- 自动提取患者画像、ESGO 风险分层
- 生成 **MDT 多学科诊疗方案**（支持 SSE 流式输出）
- 展示循证知识库检索结果，支持标注与导出完整 PDF / Word 报告

整体采用 **三步流程设计**：`分期诊断（FIGO）→ 方案生成（Treatment）→ 证据合成（Evidence）`，并提供独立模式和连续模式两种工作流。

---

## 2. 技术栈与依赖

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3（Composition API + `<script setup>`） |
| 状态管理 | Pinia |
| 路由 | Vue Router 4（Hash 模式） |
| Markdown 渲染 | marked + DOMPurify |
| 文件解析 | mammoth（.docx）、pdfjs-dist（.pdf） |
| 报告导出 | html2canvas + jsPDF（PDF）、docx.js（Word） |
| 样式 | 纯 CSS（scoped + 全局 CSS 变量，无 UI 框架） |
| 构建工具 | Vite（推测，基于 `import.meta.env` 和 `import.meta.url` 用法） |

**关键 npm 包（需确认 package.json）：**
```
vue, vue-router, pinia
marked, dompurify
mammoth
pdfjs-dist
html2canvas, jspdf
docx
```

---

## 3. 目录结构

```
src/
├── main.js                    # 应用入口，挂载 Vue + Pinia + Router
├── App.vue                    # 根组件：顶部导航栏 + 步骤条 + router-view
│
├── router/
│   └── index.js               # 路由配置（Hash 模式，4 条路由）
│
├── stores/
│   └── diagnosis.js           # Pinia 全局状态（唯一 store，贯穿全流程）
│
├── api/
│   └── index.js               # 所有后端接口封装（fetch + SSE）
│
├── views/                     # 页面级组件（对应4条路由）
│   ├── FigoView.vue            # Step 1：分期诊断
│   ├── TreatmentView.vue       # Step 2：方案生成
│   ├── EvidenceView.vue        # Step 3：证据合成
│   └── PatientProfileView.vue  # 患者档案确认（Step 1.5，连续模式专用）
│
├── components/                # 公共 UI 组件
│   ├── MdtReportRenderer.vue  # MDT 报告 Markdown 渲染器（含流式光标）
│   ├── TreatmentCard.vue      # 治疗方案卡片（带颜色标记和推荐级别）
│   └── ExportPreviewModal.vue # 导出预览弹窗（PDF / Word / 复制富文本）
│
├── utils/
│   ├── markdown.js            # Markdown 预处理 + 安全渲染（renderMd 函数）
│   └── reportExport.js        # 完整报告 HTML 构建 + PDF/Word 导出逻辑
│
├── mock/
│   └── api.js                 # Mock API（本地开发用，无需后端）
│
└── assets/
    ├── main.css               # 全局样式 + CSS 变量定义
    └── report-style.css       # 导出报告专用样式
```

> **注意：** 目录中含有多个 `* copy.*` 备份文件（如 `diagnosis copy.js`、`FigoView copy.vue` 等），这些是开发过程中的旧版本备份，**不参与实际运行**，可在确认无误后删除。

---

## 4. 快速启动

```bash
# 安装依赖
npm install

# 开发模式启动（默认连接 http://10.91.11.250:8000）
npm run dev

# 连接其他后端地址
VITE_API_BASE=http://your-backend:8000 npm run dev

# 构建生产包
npm run build
```

**环境变量：**

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE` | 后端服务地址 | `http://10.91.11.250:8000` |

在 `src/api/index.js` 第 4 行：
```js
const BASE = import.meta.env.VITE_API_BASE || 'http://10.91.11.250:8000'
```
如需修改默认地址，直接改这行即可。

---

## 5. 路由设计

路由使用 **Hash 模式**（`createWebHashHistory`），URL 格式为 `/#/figo`。

| 路径 | 组件 | meta.step | 说明 |
|------|------|-----------|------|
| `/` | — | — | 自动重定向到 `/figo` |
| `/figo` | FigoView | 1 | 分期诊断（主入口） |
| `/treatment` | TreatmentView | 2 | MDT 方案生成 |
| `/evidence` | EvidenceView | 3 | 循证证据浏览与导出 |
| `/profile` | PatientProfileView | 1 | 患者档案确认（isProfile: true） |

**`/profile` 页面的特殊行为：**
- 当处于 `/profile` 时，顶部导航的标签页和模式切换按钮会被**锁定**（`tab-locked` / `controls-locked` CSS 类）
- `App.vue` 通过 `route.meta?.isProfile === true` 判断当前是否在档案页

---

## 6. 全局状态管理（Pinia Store）

**文件：** `src/stores/diagnosis.js`
**Store ID：** `diagnosis`

这是整个应用的**唯一状态中心**，所有数据均通过此 store 在步骤间流转。

### 6.1 核心状态字段

```
模式与步骤
├── mode                  'independent' | 'sequential'  工作模式
└── currentStep           number  当前步骤（1/2/3）

Step 1 输入
├── pathologyText         显示在文本框中的病理报告文本
├── fullPatientCase       完整病历文本（文件导入时为全文，手动输入时与 pathologyText 相同）
├── importedFileName      导入的文件名（空字符串表示未导入）
├── importedRawText       文件解析后的原始完整文本
└── hiddenClinicalData    从文件中提取的非病理临床字段（自动填入 Step 2 表单，不显示在 Step 1）

Step 1 API 结果
├── profileResult         /api/v1/analyze/profile-only 返回的结果对象
│   ├── patient_profile_md        患者信息摘要（Markdown 格式）
│   ├── bilingual_keywords        双语关键词列表
│   ├── new_patient_dict          结构化患者信息字典
│   ├── esgo_risk_classification  ESGO 风险分层
│   └── figo_stage               FIGO 分期结果
└── confirmedPatientCase  经用户确认后传给后续步骤的最终 patient_case 字符串

Step 2 临床信息表单
└── clinicalInfo          {
      age, weight, height, ecog,
      hypertension, diabetes, cardiac, renal,
      molecular_type, ca125, mri_findings, notes,
      fertility_desire, figo_stage, esgo_risk_classification
    }

Step 3 分析结果
├── analysisResult        /api/v1/analyze 或 SSE 最终 result 事件的完整结果对象
├── mdtStreamText         SSE 流式输出中实时拼接的 MDT 报告文本
├── mdtStreaming          boolean，是否正在流式输出
├── editableMdtReport     用户手动编辑过的 MDT 报告文本
└── evidenceList          知识证据列表（含 highlighted / hidden 两个 UI 状态字段）
```

### 6.2 核心 Actions 说明

| Action | 说明 |
|--------|------|
| `setImportedFile({ fileName, rawText, pathologySection, clinicalData })` | 用户导入文件后调用，同时填充 `pathologyText`（仅病理部分）和 `fullPatientCase`（全文） |
| `clearImport()` | 清除文件导入的所有数据 |
| `setProfileResult(r)` | 保存 profile-only 接口结果，同时自动同步 `clinicalInfo` 中的 FIGO / ESGO 字段 |
| `confirmPatientCase(text)` | 在 PatientProfileView 确认后，将最终 patient_case 锁定 |
| `setAnalysisResult(r)` | 保存完整分析结果，同时将 `knowledge_evidence` 展开为带 UI 字段的 `evidenceList` |
| `appendMdtToken(token)` | SSE 流式输出时，每次收到 token 事件调用此函数追加文本 |
| `resetAll()` | 重置所有状态到初始值（"重新开始"按钮） |
| `persist()` / `restore()` | 将核心状态写入 / 读取 `sessionStorage`（刷新页面不丢失数据） |
| `toggleHighlight(id)` / `toggleHide(id)` | 操作证据列表中单条证据的标注/隐藏状态 |

### 6.3 Computed 属性

| 属性 | 说明 |
|------|------|
| `isImported` | 是否已导入文件（`!!importedFileName`） |
| `effectivePatientCase` | `fullPatientCase || pathologyText`，用于 API 调用 |
| `hasProfileResult` | 是否已完成 Step 1 分析 |
| `hasAnalysisResult` | 是否已完成 Step 3 分析 |

---

## 7. API 对接层详解

**文件：** `src/api/index.js`

所有 API 均指向同一后端服务（`BASE` 变量）。

### 7.1 公共 POST 请求辅助函数

```js
async function post(path, body)
// 返回 JSON 响应体；HTTP 非 2xx 时抛出 Error，message 为后端的 detail 字段
```

---

### 7.2 接口列表

#### `apiFigoStage(patientCase)`

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/v1/figo-stage` |
| **请求体** | `{ patient_case: string }` |
| **响应** | `{ figo_stage: string, raw_output: string }` |
| **说明** | Step 1 第一阶段：调用 OriClinical vLLM 进行 FIGO 分期，仅返回分期结论 |
| **调用时机** | FigoView 中用户点击「FIGO 分期」按钮 |

---

#### `apiProfileOnly(patientCase)`

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/v1/analyze/profile-only` |
| **请求体** | `{ patient_case: string }` |
| **响应** | `{ patient_profile_md, bilingual_keywords, new_patient_dict, esgo_risk_classification, figo_stage }` |
| **说明** | Step 1 第二阶段：在 FIGO 分期完成后，提取完整患者画像与 ESGO 风险分层 |
| **调用时机** | FigoView 中 FIGO 分期成功后自动触发（同一按钮流程的第二步） |

---

#### `apiAnalyzeFull(patientCase, topKSimilar = 3)`

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/v1/analyze` |
| **请求体** | `{ patient_case: string, top_k_similar: number }` |
| **响应** | 见下方完整响应结构 |
| **说明** | 完整流水线（非流式），一次性返回所有结果。目前前端**优先使用流式版本**，此函数作为备用 |

---

#### `apiAnalyzeStream(patientCase, topKSimilar, callbacks)` ⭐ 核心接口

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/v1/analyze/stream` |
| **请求体** | `{ patient_case: string, top_k_similar: number }` |
| **协议** | Server-Sent Events（SSE），Content-Type: text/event-stream |
| **返回值** | `AbortController`（调用 `.abort()` 可中止请求） |

**SSE 事件类型：**

| event 名 | data 格式 | 说明 |
|----------|-----------|------|
| `token` | 裸字符串（非 JSON） | MDT 报告的增量文本片段，前端追加到 `mdtStreamText` |
| `progress` | `{ stage: string, message: string }` | 进度提示（当前执行到哪个阶段） |
| `result` | 完整结果 JSON 对象（见下） | 流结束前发送的最终完整结果 |
| `error` | `{ detail: string }` | 后端处理出错 |

**Callbacks 参数：**
```js
{
  onEvent(type, payload)  // type 为 'result' 或 'progress'
  onToken(text)           // 每收到一个 token 片段时调用
  onDone()                // 流正常结束时调用
  onError(err)            // 出错时调用
}
```

**使用示例（TreatmentView 中的调用方式）：**
```js
import { apiAnalyzeStream } from '../api/index.js'

const controller = apiAnalyzeStream(
  store.confirmedPatientCase,
  3,
  {
    onToken(text) {
      store.appendMdtToken(text)
    },
    onEvent(type, payload) {
      if (type === 'result') {
        store.setAnalysisResult(payload)
      }
    },
    onDone() {
      store.setMdtStreaming(false)
    },
    onError(err) {
      console.error('分析出错:', err.message)
    }
  }
)

// 中止请求
controller.abort()
```

**完整 `result` 响应结构：**
```json
{
  "request_id": "string",
  "patient_profile_md": "Markdown 格式的患者画像",
  "esgo_risk_classification": "高危 / 中危 / 低危",
  "mdt_report": "完整 MDT 报告 Markdown 文本",
  "knowledge_evidence": [
    {
      "title": "证据标题",
      "content": "证据内容",
      "source": "来源（NCCN / ESGO / Lancet 等）",
      "year": 2024,
      "evidence_level": "Level 1",
      "link": "https://..."
    }
  ],
  "bibliography": ["参考文献列表"],
  "similar_patients": [...],
  "xgb_predictions": {...},
  "comorbidity_screening": {...}
}
```

---

#### `parseUploadedFile(file)` — 客户端文件解析

| 项目 | 内容 |
|------|------|
| **性质** | 纯前端函数，不调用后端 |
| **支持格式** | `.docx`（mammoth）、`.pdf`（pdfjs-dist）、`.txt`（原生 File API） |
| **返回** | `Promise<string>`，解析后的纯文本内容 |
| **错误处理** | `.doc` 格式明确提示不支持；无效 ZIP 头的 `.docx` 文件给出具体提示 |

---

## 8. 各页面功能说明

### 8.1 FigoView（`/figo`）— 分期诊断

**核心流程：**

```
用户输入病理文本
    ↓（或点击「导入病历文件」→ parseUploadedFile → 自动填充）
点击「FIGO 分期」按钮
    ↓ apiFigoStage()
显示分期结果（figoResult）
    ↓ 自动触发
    apiProfileOnly()
显示患者画像 + ESGO 分层（profileResult）
    ↓ 用户点击「进入患者档案确认」或「直接进入方案生成」
    store.confirmPatientCase(text) → 跳转
```

**两阶段按钮（btn-pipeline）：**
- `phase` 变量控制当前阶段：`'idle'` → `'figo'` → `'profile'` → `'done'`
- FIGO 完成后自动触发 profile-only，用户无需手动点击第二步

**文件导入逻辑：**
- 调用 `parseUploadedFile(file)` 解析文件内容
- 如果文件包含完整病历，后端会从中分离病理部分（由 `hiddenClinicalData` 承载非病理字段）
- `importedFileName` 非空时显示导入 Banner，隐藏上传按钮

---

### 8.2 PatientProfileView（`/profile`）— 患者档案确认

**功能：** 供用户核对并手动修改 AI 自动提取的患者信息，确认后保存到 store。

**编辑模式：**
- `isEditing` 为 false 时只读展示；点击「修改档案」进入编辑模式
- 顶部分期摘要栏（FIGO 分期、ESGO 分层）使用 `contenteditable` 实现内联编辑

**表单字段：** 年龄、BMI（身高/体重）、ECOG 评分、合并症（高血压/糖尿病/心脏病/肾功能不全）、分子分型、CA125、MRI 所见、生育意愿、备注

**保存逻辑：**
```js
store.setClinicalInfo(editedData)
store.confirmPatientCase(store.fullPatientCase || store.pathologyText)
router.push('/treatment')
```

---

### 8.3 TreatmentView（`/treatment`）— 方案生成

**核心功能：**
- 左侧：患者信息摘要 + 合并症芯片 + 调试面板（显示 patient_case 长度等）
- 中间：MDT 报告区域，使用 `MdtReportRenderer` 渲染流式 Markdown
- 右侧：相似病例、XGB 预测结果

**SSE 流式控制：**
- 点击「生成 MDT 治疗方案」→ `apiAnalyzeStream()` 开始，`store.setMdtStreaming(true)`
- 点击「停止生成」→ `controller.abort()`，`store.setMdtStreaming(false)`
- 流结束后 `result` 事件触发 `store.setAnalysisResult()`，自动填充 evidenceList

**MDT 报告编辑：**
- 报告生成完毕后可手动编辑（`editableMdtReport`）
- 编辑内容通过 `store.setEditableMdtReport()` 保存，导出时使用编辑后的版本

**无 profileResult 时的降级处理：**
- 显示手动输入 FIGO 分期的表单（`manualFigo`），允许用户直接进入此页面使用

---

### 8.4 EvidenceView（`/evidence`）— 证据合成

**三列布局：**
- 左列：患者特征摘要 + 治疗方案摘要
- 中列：知识证据卡片列表（可标注 ⭐ / 隐藏）
- 右列：参考文献列表

**证据操作：**
```js
store.toggleHighlight(id)   // 标注/取消标注（高亮金色边框）
store.toggleHide(id)        // 隐藏/显示（导出时可过滤掉隐藏项）
store.restoreAllHidden()    // 恢复所有被隐藏的证据
```

**导出流程：**
1. 点击「导出完整报告」→ 调用 `buildFullReportHtml()`（来自 `reportExport.js`）
2. 生成包含 MDT 报告 + 知识证据的完整 HTML 字符串
3. 打开 `ExportPreviewModal`，传入 HTML 和 Markdown
4. 用户在弹窗中选择：复制富文本 / 导出 PDF / 导出 Word

---

## 9. 公共组件说明

### 9.1 MdtReportRenderer.vue

**Props：**

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `markdown` | String | `''` | 要渲染的 Markdown 文本 |
| `loading` | Boolean | `false` | 为 true 且 markdown 为空时显示骨架屏 |
| `streaming` | Boolean | `false` | 流式输出进行中时为 true，显示末尾光标动画 |

**注意：** 流式输出结束后，父组件**必须**将 `streaming` 设回 `false`，否则光标会持续闪烁。

---

### 9.2 TreatmentCard.vue

**Props：**

| Prop | 类型 | 说明 |
|------|------|------|
| `icon` | String | Emoji 图标 |
| `category` | String | 分类标签（如 "手术治疗"） |
| `level` | String | 推荐级别（含 'A' 显示绿色，含 'B' 显示橙色，其他蓝色） |
| `color` | String | 左边框颜色：`'blue'` / `'rose'` / `'amber'` / `'purple'` / `'teal'` / `'green'` |
| `editing` | Boolean | 是否处于编辑模式（显示删除按钮） |

**Slots：**
- `#title`：卡片标题内容
- `#detail`：卡片详情内容

---

### 9.3 ExportPreviewModal.vue

**Props：**

| Prop | 类型 | 说明 |
|------|------|------|
| `visible` | Boolean | 控制弹窗显隐 |
| `html` | String | 完整报告 HTML（由 `buildFullReportHtml()` 生成） |
| `markdown` | String | 合并后的完整 Markdown（用于渲染预览） |

**Emits：**

| 事件 | 说明 |
|------|------|
| `close` | 关闭弹窗（点击遮罩或 Esc 键触发） |
| `copy` | 触发复制富文本到剪贴板 |
| `export-pdf` | 触发 PDF 导出 |
| `export-word` | 触发 Word 导出 |

---

## 10. 工具模块说明

### 10.1 `src/utils/markdown.js`

**对外暴露两个函数：**

#### `renderMd(text: string): string`
主渲染函数，调用链：`preprocessMarkdown → marked.parse → DOMPurify.sanitize`
返回可直接用于 `v-html` 的安全 HTML 字符串。

#### `preprocessMarkdown(text: string): string`
AI 输出 Markdown 预处理器，修复以下问题：
- 字面量 `\n`（SSE JSON 编码的换行）→ 真实换行
- 行内粘连的列表项自动拆分
- 标题前自动补双换行
- `###标题` → `### 标题`（补空格）
- 中文数字序号标题级别修正（`###` → `##`）
- 压缩多余空行
- 修复空表格单元格 `||` → `| |`

---

### 10.2 `src/utils/reportExport.js`

**主要导出函数：**

#### `buildFullReportHtml(store, options)`
将 store 中的数据组装为完整的报告 HTML 字符串，包含：
- 报告封面（医院名称、报告标题、生成日期、ESGO 风险徽章）
- 患者信息摘要区
- MDT 治疗方案（渲染后的 Markdown）
- 知识证据列表（过滤掉 `hidden: true` 的条目）
- 参考文献

#### `exportToPdf(html, filename)`
使用 `html2canvas` + `jsPDF` 将 HTML 渲染为 PDF 并触发下载。

#### `exportToWord(markdown, filename)`
使用 `docx.js` 将 Markdown 转换为 Word 文档并触发下载。

---

## 11. Mock 数据说明

**文件：** `src/mock/api.js`

提供三个 Mock 函数，模拟后端返回（延迟 1200-1400ms）：

| 函数 | 模拟接口 |
|------|---------|
| `mockFIGOAnalysis(pathologyText)` | FIGO 分期 + 思维链分析 |
| `mockTreatmentPlan(figo, clinicalInfo)` | MDT 治疗方案（手术/化疗/放疗/靶向/随访） |
| `mockEvidenceSearch(patientFeatures, keywords)` | 5 条循证证据（NCCN / ESGO / PORTEC-3 / NRG-GY018 / TCGA） |

**如何切换到 Mock 模式：**
在各 View 文件中，将 `import { apiFigoStage } from '../api/index.js'` 替换为 `import { mockFIGOAnalysis } from '../mock/api.js'`，并适配调用签名即可。

> Mock 数据基于 FIGO IIIC1 期子宫内膜样腺癌 G2 的真实临床场景，可直接用于演示。

---

## 12. 样式系统

### CSS 变量（定义在 `src/assets/main.css`）

颜色系统采用语义化命名，以下为核心变量：

```css
/* 主色调 */
--accent-blue:        #3b82f6;
--accent-teal:        #14b8a6;
--accent-amber:       #f59e0b;
--accent-rose:        #f43f5e;
--accent-purple:      #8b5cf6;
--accent-green:       #22c55e;

/* 文字 */
--text-primary:       #0f172a;
--text-secondary:     #475569;
--text-muted:         #94a3b8;

/* 背景 */
--bg-0:               #ffffff;
--bg-1:               #f8fafc;
--bg-2:               #f1f5f9;
--bg-3:               #e2e8f0;

/* 边框 */
--border:             #e2e8f0;
--border-md:          #cbd5e1;

/* 圆角 */
--radius-sm:          6px;
--radius-md:          8px;
--radius-xl:          16px;

/* 布局（关键） */
--nav-height:         52px;   /* 顶部导航栏高度 */
--stepper-height:     44px;   /* 步骤条高度（连续模式） */

/* 字体 */
--font-body:   "Inter","Noto Sans SC",-apple-system,sans-serif;
--font-serif:  "Noto Serif SC",Georgia,serif;
--font-mono:   "JetBrains Mono","Fira Code",Consolas,monospace;
```

### 布局规则

- 顶部导航栏固定（`position: fixed; z-index: 50`），高度 `--nav-height`
- 连续模式下步骤条也固定（`z-index: 40`），位于导航栏下方
- 主内容区的 `padding-top` 需根据是否有步骤条动态切换（`.main-area.with-stepper`）
- 各页面内容区最大宽度 1440px，页面内布局多使用 3 列 Grid

---

## 13. 后端接口汇总

> 本节是给后端对接时的快速参考，前端已实现完整的错误处理。

| 接口 | 方法 | 路径 | 主要请求参数 | 主要响应字段 |
|------|------|------|-------------|-------------|
| FIGO 分期 | POST | `/api/v1/figo-stage` | `patient_case` | `figo_stage`, `raw_output` |
| 患者画像 | POST | `/api/v1/analyze/profile-only` | `patient_case` | `patient_profile_md`, `esgo_risk_classification`, `figo_stage`, `new_patient_dict`, `bilingual_keywords` |
| 完整分析（非流式） | POST | `/api/v1/analyze` | `patient_case`, `top_k_similar` | （见 result 结构） |
| 完整分析（流式） | POST | `/api/v1/analyze/stream` | `patient_case`, `top_k_similar` | SSE 流：token / progress / result / error 事件 |

**通用错误响应格式（HTTP 4xx/5xx）：**
```json
{ "detail": "错误描述信息" }
```
前端统一抛出 `Error`，message 为 `detail` 字段内容，各页面自行 catch 并显示在 `.parse-error` 元素中。

---

## 14. 常见问题与维护指引

### Q1：如何修改后端地址？

编辑 `src/api/index.js` 第 4 行：
```js
const BASE = import.meta.env.VITE_API_BASE || 'http://10.91.11.250:8000'
```
或在启动时设置环境变量 `VITE_API_BASE`。

---

### Q2：SSE 流式输出时 MDT 报告乱码 / 格式错误？

查看 `src/utils/markdown.js` 中的 `preprocessMarkdown` 函数，AI 输出的常见格式问题均在此处修复。如有新的格式问题，在此函数末尾追加正则修复规则即可。

---

### Q3：导入的 .docx 文件提示「不是有效格式」？

前端会在解析前校验 ZIP 文件头（PK 魔数），确认 `src/api/index.js` 中的 `validateZipHeader` 函数。老版本 Word（`.doc` 格式）明确不支持，需用户先另存为 `.docx`。

---

### Q4：页面刷新后数据丢失？

正常情况下刷新不会丢失数据，因为 `App.vue` 的 `onMounted` 钩子会调用 `store.restore()` 从 `sessionStorage` 恢复状态。如果数据丢失，检查 `store.persist()` 是否在正确的时机被调用（目前在 PatientProfileView 保存操作后调用）。**关闭标签页后数据会清除**（sessionStorage 特性），这是预期行为。

---

### Q5：如何新增一个治疗方案卡片颜色？

1. 在 `TreatmentCard.vue` 的 `<style>` 中追加：
   ```css
   .accent-yourcolor { border-left-color: var(--accent-yourcolor); }
   ```
2. 确保 `main.css` 中定义了 `--accent-yourcolor` CSS 变量。
3. 使用时传入 `color="yourcolor"` prop。

---

### Q6：如何在不影响生产的情况下测试新接口？

使用 `src/mock/api.js` 中的 Mock 函数。在对应的 View 文件中临时替换 import，Mock 函数的签名已模拟真实接口，不需要后端即可完整测试前端流程。

---

### Q7：`* copy.*` 备份文件可以删除吗？

可以。以下文件是开发过程的旧版本备份，不参与任何 import，确认无误后可删除：
- `src/App copy.vue`
- `src/api/index copy.js`
- `src/stores/diagnosis copy.js`
- `src/utils/reportExport copy.js`
- `src/views/EvidenceView copy.vue`
- `src/views/FigoView copy.vue`
- `src/views/PatientProfileView copy.vue`（内容与正式版完全相同）
- `src/views/TreatmentView copy.vue`（内容与正式版完全相同）

---

*文档生成时间：2026 年 6 月 | 版本：1.0*