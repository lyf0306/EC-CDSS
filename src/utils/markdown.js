/**
 * src/utils/markdown.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 公共 Markdown 渲染模块。
 * 将 TreatmentView 中的预处理 + marked 配置 + DOMPurify 清洗逻辑统一抽离到此处，
 * 供 MdtReportRenderer.vue、EvidenceView 导出等所有需要渲染 MDT 报告的地方调用。
 *
 * 对外暴露唯一函数：
 *   renderMd(markdownText: string): string   → 返回安全的 HTML 字符串
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { marked } from 'marked'
import DOMPurify from 'dompurify'

// ── marked 全局配置（只需执行一次） ─────────────────────────────────────────
marked.setOptions({
  breaks: true,   // 单个换行符渲染为 <br>
  gfm: true,      // GitHub Flavored Markdown（表格、删除线等）
})

/**
 * AI Markdown 预处理器
 *
 * 修复 SSE 流式输出可能引入的格式问题，使 marked 能正确解析：
 *  ① 字面量 \n（SSE JSON 编码的换行）→ 真实换行
 *  ② 行内粘连列表项拆分
 *  ③ 正文后遇 # 标题时补双换行
 *  ④ 补空格：###标题 → ### 标题
 *  ⑤ 标题行后补空行（防止正文粘连）
 *  ⑥ 中文数字序号标题级别修正（AI 偶尔错用 ###）
 *  ⑦ 有序列表补空格：1.内容 → 1. 内容
 *  ⑧ 压缩多余空行
 *  ⑨ 修复空表格单元格
 *
 * @param {string} text 原始 Markdown 文本
 * @returns {string} 修复后的 Markdown 文本
 */
export function preprocessMarkdown(text) {
  if (!text) return ''
  let t = text

  // ① 字面量 \n → 真实换行，必须最先处理
  t = t.replace(/\\n/g, '\n')
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ② 行内粘连列表项拆分（句末标点/右括号/引号后的 - 认定为列表项）
  //    连字符 ESGO-ESTRO、数字-1、箭头-> 不受影响
  for (let i = 0; i < 4; i++) {
    t = t.replace(/([。.；;，,、：:！!？?)）\]】」』'"\`])-([^\s\-\n>])/g, '$1\n- $2')
    t = t.replace(/([^\n])(- )(?!-)/g, '$1\n$2')
  }

  // ③ 非换行非# 后遇 # 插双换行（不拆散 ## ### 自身）
  t = t.replace(/([^\n#])(#{1,6})/g, '$1\n\n$2')

  // ④ 补空格：###标题 → ### 标题
  t = t.replace(/(#{1,6})([^\s#\n])/g, '$1 $2')

  // ⑤ 标题行后补空行（防止正文粘连）
  t = t.replace(/(#{1,6}[^\n]+)\n([^\n])/g, '$1\n\n$2')

  // ⑥ 中文数字序号标题级别修正
  //    AI 有时对"五、六、..."用 ### 而其他章节用 ##
  t = t.replace(/^###\s+([一二三四五六七八九十]+[、])/gm, '## $1')

  // ⑦ 有序列表补空格：1.内容 → 1. 内容
  t = t.replace(/(\d+)\.([^\s\d\n])/g, '$1. $2')

  // ⑧ 压缩多余空行
  t = t.replace(/\n{3,}/g, '\n\n')

  // ⑨ 修复空表格单元格
  t = t.replace(/\|\|/g, '| |')

  return t
}

/**
 * 将 Markdown 文本渲染为安全的 HTML 字符串
 *
 * 流程：preprocessMarkdown → marked.parse → DOMPurify.sanitize
 *
 * @param {string} text Markdown 原文
 * @returns {string} 经过 XSS 清洗的 HTML 字符串，可直接用于 v-html 或写入 DOM
 */
export function renderMd(text) {
  if (!text) return ''

  try {
    const fixedMarkdown = preprocessMarkdown(text)
    const html = marked.parse(fixedMarkdown)
    return DOMPurify.sanitize(html)
  } catch (err) {
    console.error('[renderMd] Markdown 渲染失败：', err)
    return `<div style="padding:16px;background:#fef2f2;color:#b91c1c;border-radius:8px;font-size:13px;">
      Markdown 渲染失败，请检查内容格式
    </div>`
  }
}