/**
 * src/utils/reportExport.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MDT 完整报告导出工具集（v2 — 修复无标题证据展示 + FIGO 分期醒目样式）
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── CSS 变量 ──────────────────────────────────────────────────────────────────
const CSS_VARS = `
  :root {
    --accent-blue:        #3b82f6;
    --accent-blue-light:  rgba(59,130,246,.08);
    --accent-blue-mid:    rgba(59,130,246,.30);
    --accent-teal:        #14b8a6;
    --accent-teal-light:  rgba(20,184,166,.10);
    --accent-green:       #22c55e;
    --accent-amber:       #f59e0b;
    --accent-amber-light: rgba(245,158,11,.10);
    --accent-amber-mid:   rgba(245,158,11,.30);
    --accent-rose:        #f43f5e;
    --accent-rose-light:  rgba(244,63,94,.10);
    --accent-purple:      #8b5cf6;
    --accent-purple-light:rgba(139,92,246,.10);
    --accent-purple-mid:  rgba(139,92,246,.30);
    --text-primary:       #0f172a;
    --text-secondary:     #475569;
    --text-muted:         #94a3b8;
    --bg-1:               #f8fafc;
    --bg-2:               #f1f5f9;
    --bg-3:               #e2e8f0;
    --border:             #e2e8f0;
    --border-md:          #cbd5e1;
    --radius-xs:          4px;
    --radius-sm:          6px;
    --radius-md:          8px;
    --radius-xl:          16px;
    --font-body:          "Inter","Noto Sans SC",-apple-system,sans-serif;
    --font-serif:         "Noto Serif SC",Georgia,serif;
    --font-mono:          "JetBrains Mono","Fira Code",Consolas,monospace;
    --shadow-md:          0 4px 16px rgba(0,0,0,.10);
  }
`

// ─── 报告基础样式 ──────────────────────────────────────────────────────────────
const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.85;
    color: var(--text-primary);
    background: #fff;
    padding: 40px 56px;
    max-width: 900px;
    margin: 0 auto;
  }

  /* ── 报告封面 ── */
  .report-cover {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding-bottom: 20px; margin-bottom: 32px; border-bottom: 2px solid var(--accent-blue);
  }
  .report-hospital {
    font-size: 11px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;
  }
  .report-title {
    font-size: 22px; font-weight: 800; font-family: var(--font-serif);
    color: var(--text-primary); margin-bottom: 4px;
  }
  .report-subtitle { font-size: 13px; color: var(--text-secondary); }
  .report-cover-right { text-align: right; }
  .report-meta-row {
    font-size: 12px; color: var(--text-muted); margin-bottom: 3px;
    font-family: var(--font-mono);
  }
  .report-meta-row strong { color: var(--text-secondary); font-weight: 600; }
  .report-esgo-badge {
    display: inline-block; margin-top: 8px; padding: 4px 12px;
    border-radius: 100px; font-size: 12px; font-weight: 700;
    background: var(--accent-blue-light); color: var(--accent-blue);
    border: 1px solid var(--accent-blue-mid);
  }

  /* ── FIGO 分期徽章（封面醒目展示） ── */
  .report-figo-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 800;
    font-family: var(--font-mono);
    letter-spacing: .04em;
    background: linear-gradient(135deg, var(--accent-purple-light), rgba(139,92,246,.05));
    color: var(--accent-purple);
    border: 1.5px solid var(--accent-purple-mid);
    box-shadow: 0 2px 8px rgba(139,92,246,.15);
  }
  .report-figo-badge .figo-icon {
    width: 16px; height: 16px;
    background: var(--accent-purple);
    color: #fff;
    border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 900; letter-spacing: 0; flex-shrink: 0;
  }
  .report-figo-label {
    font-size: 10px; font-weight: 600; opacity: .7;
    text-transform: uppercase; letter-spacing: .06em;
  }
  .report-figo-value { font-size: 15px; }

  /* ── FIGO 行内 highlight（正文中出现 FIGO 时醒目化） ── */
  .figo-inline {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 1px 7px 1px 5px;
    background: var(--accent-purple-light);
    color: var(--accent-purple);
    border: 1px solid var(--accent-purple-mid);
    border-radius: 5px;
    font-weight: 700; font-size: .92em;
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .figo-inline::before {
    content: '📋';
    font-size: .85em;
  }

  /* ── 章节标题 ── */
  .report-section-heading {
    display: flex; align-items: center; gap: 10px;
    margin: 40px 0 24px; padding: 10px 16px;
    background: linear-gradient(135deg, var(--accent-blue-light), rgba(20,184,166,.05));
    border: 1px solid var(--accent-blue-mid); border-radius: var(--radius-md);
  }
  .report-section-num {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; background: var(--accent-blue); color: #fff;
    border-radius: 50%; font-size: 13px; font-weight: 800; flex-shrink: 0;
  }
  .report-section-title {
    font-size: 16px; font-weight: 800; font-family: var(--font-serif);
    color: var(--text-primary); flex: 1;
  }
  .report-section-tag {
    font-size: 10px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: var(--accent-teal);
    background: var(--accent-teal-light); padding: 2px 8px;
    border-radius: 100px; border: 1px solid rgba(20,184,166,.25);
  }

  /* ── 模块分隔 ── */
  .module-divider { display: flex; align-items: center; gap: 12px; margin: 40px 0; }
  .module-divider::before, .module-divider::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-blue-mid), transparent);
  }
  .module-divider-text {
    font-size: 11px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: var(--text-muted); white-space: nowrap;
  }

  /* ── 证据卡片（有标题版） ── */
  .ev-report-item {
    border: 1px solid var(--border); border-radius: var(--radius-md);
    margin-bottom: 14px; overflow: hidden; page-break-inside: avoid;
  }
  .ev-report-item.starred {
    border-color: var(--accent-amber); background: var(--accent-amber-light);
  }
  .ev-report-hdr {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 10px 14px; background: var(--bg-1);
    border-bottom: 1px solid var(--border); gap: 8px;
  }
  .ev-report-title {
    font-size: 13px; font-weight: 600; color: var(--text-primary);
    line-height: 1.5; flex: 1;
  }
  .ev-report-star { font-size: 14px; color: var(--accent-amber); flex-shrink: 0; }
  .ev-report-tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 14px 4px; }
  .ev-tag {
    display: inline-flex; align-items: center; padding: 2px 8px;
    border-radius: 100px; font-size: 11px; font-weight: 600; border: 1px solid transparent;
  }
  .ev-tag-esgo  { background: rgba(59,130,246,.10); color: var(--accent-blue); border-color: rgba(59,130,246,.25); }
  .ev-tag-nccn  { background: var(--accent-teal-light); color: var(--accent-teal); border-color: rgba(20,184,166,.3); }
  .ev-tag-figo  { background: var(--accent-purple-light); color: var(--accent-purple); border-color: var(--accent-purple-mid); }
  .ev-tag-level { background: rgba(34,197,94,.10); color: var(--accent-green); border-color: rgba(34,197,94,.25); }
  .ev-tag-year  { background: var(--bg-2); color: var(--text-muted); border-color: var(--border); }
  .ev-tag-default { background: var(--bg-2); color: var(--text-secondary); border-color: var(--border); }
  .ev-report-content {
    padding: 8px 14px 12px; font-size: 12px; color: var(--text-secondary);
    line-height: 1.7; white-space: pre-wrap;
  }
  .ev-report-link { padding: 0 14px 10px; font-size: 12px; }
  .ev-report-link a { color: var(--accent-blue); text-decoration: none; }

  /* ── 证据卡片（无标题降级版） ── */
  .ev-notitle-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 14px; border: 1px solid var(--border);
    border-radius: var(--radius-md); margin-bottom: 10px;
    background: var(--bg-1); page-break-inside: avoid;
  }
  .ev-notitle-item.starred { border-color: var(--accent-amber); background: var(--accent-amber-light); }
  .ev-notitle-num {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; flex-shrink: 0;
    background: var(--accent-blue); color: #fff;
    border-radius: 50%; font-size: 11px; font-weight: 700;
    font-family: var(--font-mono); margin-top: 1px;
  }
  .ev-notitle-num.starred-num { background: var(--accent-amber); }
  .ev-notitle-body { flex: 1; min-width: 0; }
  .ev-notitle-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; align-items: center; }
  .ev-notitle-star { font-size: 12px; color: var(--accent-amber); margin-left: 2px; }
  .ev-notitle-content {
    font-size: 12px; color: var(--text-secondary); line-height: 1.7;
    white-space: pre-wrap; word-break: break-all;
  }
  .ev-notitle-empty {
    font-size: 12px; color: var(--text-muted); font-style: italic;
    padding: 4px 0;
  }
  .ev-notitle-link { margin-top: 6px; font-size: 11px; }
  .ev-notitle-link a { color: var(--accent-blue); text-decoration: none; }

  /* ── 参考文献区块 ── */
  .bib-section {
    margin-top: 8px;
  }
  .bib-section-hdr {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 16px; padding-bottom: 10px;
    border-bottom: 2px solid var(--accent-blue);
  }
  .bib-section-hdr-icon {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; flex-shrink: 0;
    background: var(--accent-blue); color: #fff;
    border-radius: 6px; font-size: 13px;
  }
  .bib-section-hdr-text {
    font-size: 15px; font-weight: 800; font-family: var(--font-serif);
    color: var(--text-primary);
  }
  .bib-section-hdr-sub {
    font-size: 12px; color: var(--text-muted); margin-top: 1px;
  }
  .bib-count-badge {
    margin-left: auto; padding: 2px 10px;
    background: var(--accent-blue-light); color: var(--accent-blue);
    border: 1px solid var(--accent-blue-mid); border-radius: 100px;
    font-size: 11px; font-weight: 700; font-family: var(--font-mono);
  }

  /* 单条文献卡片 */
  .bib-card {
    border: 1px solid var(--border); border-radius: var(--radius-md);
    margin-bottom: 10px; overflow: hidden; page-break-inside: avoid;
  }
  .bib-card-hdr {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px; background: var(--bg-1);
    border-bottom: 1px solid var(--border);
  }
  .bib-card-num {
    display: flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; flex-shrink: 0;
    background: var(--accent-blue); color: #fff;
    border-radius: 50%; font-size: 11px; font-weight: 800;
    font-family: var(--font-mono);
  }
  .bib-card-guideline {
    padding: 2px 8px; border-radius: 100px;
    font-size: 10px; font-weight: 700;
    background: rgba(34,197,94,.12); color: var(--accent-green);
    border: 1px solid rgba(34,197,94,.28);
    white-space: nowrap; max-width: 160px;
    overflow: hidden; text-overflow: ellipsis;
  }
  .bib-card-year {
    margin-left: auto; font-size: 10px; font-family: var(--font-mono);
    color: var(--text-muted); flex-shrink: 0;
  }
  .bib-card-body { padding: 10px 14px 12px; }

  /* PMID 行 */
  .bib-pmid-row {
    display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
  }
  .bib-pmid-label {
    font-size: 10px; font-weight: 700; letter-spacing: .04em;
    color: var(--text-muted); background: var(--bg-2);
    border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px;
    flex-shrink: 0;
  }
  .bib-pmid-val {
    font-size: 11px; font-family: var(--font-mono); color: var(--accent-blue);
    word-break: break-all; line-height: 1.4;
  }
  .bib-pmid-val a { color: var(--accent-blue); text-decoration: none; }
  .bib-pmid-val a:hover { text-decoration: underline; }

  /* 标题 */
  .bib-card-title {
    font-size: 13px; font-weight: 600; color: var(--text-primary);
    line-height: 1.55; margin-bottom: 6px;
  }

  /* 期刊/作者/摘要 */
  .bib-card-journal {
    font-size: 11px; color: var(--text-muted); font-style: italic;
    margin-bottom: 4px;
  }
  .bib-card-authors {
    font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;
    line-height: 1.5;
  }
  .bib-card-abstract {
    font-size: 11px; color: var(--text-secondary); line-height: 1.6;
    margin-top: 6px; padding: 8px 10px;
    background: var(--bg-1); border-left: 2px solid var(--border-md);
    border-radius: 0 4px 4px 0;
  }
  .bib-card-abstract-label {
    font-size: 10px; font-weight: 700; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: .05em; display: block;
    margin-bottom: 3px;
  }

  /* 文献链接 */
  .bib-card-link {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 6px; font-size: 11px; color: var(--accent-blue);
    text-decoration: none;
  }
  .bib-card-link:hover { text-decoration: underline; }

  /* ── 报告页脚 ── */
  .report-footer-note {
    margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-muted); line-height: 1.7;
  }

  @media print {
    body { padding: 20px 32px; }
    .ev-report-item, .ev-notitle-item { page-break-inside: avoid; }
  }
`

// ─── .mdt-rendered 内联样式（新窗口注入用） ───────────────────────────────────
const MDT_RENDERED_STYLES = `
  .mdt-rendered {
    font-size: 14px; line-height: 1.85; color: var(--text-primary);
    font-family: var(--font-body); white-space: normal; word-break: normal; overflow-wrap: break-word;
  }
  .mdt-rendered h1 {
    font-size: 20px; font-weight: 800; font-family: var(--font-serif); color: var(--text-primary);
    margin: 28px 0 18px; padding: 0 0 10px 14px;
    border-bottom: 2px solid var(--accent-blue); border-left: 4px solid var(--accent-blue);
    border-radius: 2px 0 0 0; display: block; white-space: normal; word-break: keep-all; line-height: 1.5;
  }
  .mdt-rendered h1::before { display: none; }
  .mdt-rendered h2 {
    font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 28px 0 0; padding: 8px 12px;
    background: var(--accent-blue-light); border-left: 3px solid var(--accent-blue);
    border-radius: 0 6px 6px 0; display: block; word-break: keep-all; line-height: 1.6;
  }
  .mdt-rendered h2 + * { margin-top: 20px !important; }
  .mdt-rendered h3 {
    font-size: 14px; font-weight: 700; color: var(--accent-blue);
    margin: 18px 0 8px; padding-left: 14px; position: relative;
    display: block; word-break: keep-all; line-height: 1.6;
  }
  .mdt-rendered h3::before {
    content: ''; display: block; position: absolute; left: 0; top: 50%;
    transform: translateY(-50%); width: 6px; height: 6px;
    background: var(--accent-blue); border-radius: 50%;
  }
  .mdt-rendered h4 {
    font-size: 13px; font-weight: 700; color: var(--text-secondary);
    margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .05em; display: block;
  }
  .mdt-rendered h5 {
    font-size: 14px; font-weight: 700; color: var(--text-primary);
    margin: 16px 0 8px; padding: 6px 0 6px 12px;
    border-left: 3px solid var(--accent-teal); display: block;
  }
  .mdt-rendered p { margin: 0 0 12px; line-height: 1.85; word-break: keep-all; }
  .mdt-rendered ul, .mdt-rendered ol { margin: 6px 0 14px; padding-left: 0; list-style: none; display: block; }
  .mdt-rendered ul > li {
    display: block; position: relative; padding-left: 16px;
    font-size: 13px; color: var(--text-secondary); line-height: 1.65; word-break: keep-all;
  }
  .mdt-rendered ul > li::before {
    content: ''; position: absolute; left: 2px; top: 8px;
    width: 6px; height: 6px; background: var(--accent-blue); border-radius: 50%; display: block;
  }
  .mdt-rendered ol { counter-reset: ol-counter; }
  .mdt-rendered ol > li {
    display: block; position: relative; padding-left: 26px;
    font-size: 13px; color: var(--text-secondary); line-height: 1.65;
    counter-increment: ol-counter; word-break: keep-all;
  }
  .mdt-rendered ol > li::before {
    content: counter(ol-counter); position: absolute; left: 0; top: 1px;
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; background: var(--accent-blue); color: #fff;
    border-radius: 50%; font-size: 10px; font-weight: 700;
  }
  .mdt-rendered li { margin-bottom: 4px; }
  .mdt-rendered li > ul, .mdt-rendered li > ol { margin: 6px 0 2px; padding-left: 8px; border-left: 2px solid var(--accent-blue-mid); }
  .mdt-rendered strong { font-weight: 700; color: var(--text-primary); }
  .mdt-rendered em { font-style: italic; color: var(--text-secondary); }
  .mdt-rendered hr { border: none; height: 1px; background: linear-gradient(90deg, var(--accent-blue-mid), transparent); margin: 20px 0; }
  .mdt-rendered blockquote {
    margin: 12px 0; padding: 10px 14px; background: var(--accent-blue-light);
    border-left: 3px solid var(--accent-blue); border-radius: 0 6px 6px 0;
    font-size: 13px; color: var(--text-secondary); line-height: 1.65;
  }
  .mdt-rendered blockquote p { margin: 0; }
  .mdt-rendered code {
    font-family: var(--font-mono); font-size: 12px; background: var(--bg-2);
    border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; color: var(--accent-blue);
  }
  .mdt-rendered pre {
    background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px 14px; overflow-x: auto; margin: 10px 0;
  }
  .mdt-rendered pre code { background: none; border: none; padding: 0; font-size: 12px; color: var(--text-secondary); }
  .mdt-rendered table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
  .mdt-rendered thead tr { background: var(--accent-blue); }
  .mdt-rendered thead th { padding: 8px 12px; text-align: left; color: #fff; font-weight: 700; font-size: 12px; letter-spacing: .04em; }
  .mdt-rendered tbody tr { border-top: 1px solid var(--border); }
  .mdt-rendered tbody tr:hover { background: var(--accent-blue-light); }
  .mdt-rendered tbody td { padding: 7px 12px; color: var(--text-secondary); vertical-align: top; }
  .mdt-rendered tbody tr:nth-child(even) { background: var(--bg-1); }

  /* FIGO 行内醒目（mdt 正文中出现时自动高亮） */
  .figo-inline {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 1px 7px 1px 5px;
    background: var(--accent-purple-light); color: var(--accent-purple);
    border: 1px solid var(--accent-purple-mid); border-radius: 5px;
    font-weight: 700; font-size: .92em; font-family: var(--font-mono); white-space: nowrap;
  }
  .figo-inline::before { content: '📋'; font-size: .85em; }
`

// ─────────────────────────────────────────────────────────────────────────────
// 内部工具：标签 class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HTML 转义 — 防止 XSS，确保用户/LLM 产出的文本安全嵌入 HTML
 */
export function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function sourceTagClass(source) {
  const s = (source || '').toUpperCase()
  if (s.includes('ESGO')) return 'ev-tag ev-tag-esgo'
  if (s.includes('NCCN')) return 'ev-tag ev-tag-nccn'
  if (s.includes('FIGO')) return 'ev-tag ev-tag-figo'
  return 'ev-tag ev-tag-default'
}

/**
 * 从 content / title / source_ids 里提取能作为标题的首句话。
 * 策略（按优先级）：
 *   1. item.title（非空，且不含纯占位文本）
 *   2. content 首行（去掉 > 引用符和 # 标题符后的第一行，≤80字）
 *   3. source_ids 里第一个有意义的 id 片段
 *   4. 返回 null（由调用方决定降级展示）
 */
function extractTitle(item) {
  const t = (item.title || '').trim()
  if (t && t !== '（无标题）' && t !== '(无标题)' && t.length > 2) return t

  if (item.content) {
    const firstLine = item.content
      .replace(/\\n/g, '\n')
      .split('\n')
      .map(l => l.replace(/^[>#\s*-]+/, '').trim())
      .find(l => l.length > 4)
    if (firstLine) return firstLine.slice(0, 80) + (firstLine.length > 80 ? '…' : '')
  }

  if (item.source_ids?.length) {
    const sid = String(item.source_ids[0])
    const m = sid.match(/::(.+)$/)
    if (m && m[1].length > 2) return m[1].slice(0, 60)
  }

  return null
}

/**
 * 将 HTML 文本中的 FIGO 分期字样（如 FIGO IA、FIGO IIB）替换为醒目 badge。
 * 支持：FIGO I/II/III/IV + 可选 A/B/C 亚期，大小写容错。
 */
/**
 * 在 HTML 字符串中将 FIGO 分期字样替换为紫色醒目 badge。
 *
 * 覆盖格式（全部 case-insensitive）：
 *   FIGO IA / FIGO IIB / FIGO III C / FIGO IV
 *   FIGO分期 IA / FIGO期IA / FIGO：IA / FIGO: IA
 *   中文罗马混写：III期、IVB期（出现在 FIGO 后面）
 *
 * 注意：此函数接收的是已经 escapeHtml 过的字符串，
 *       &amp; / &lt; / &gt; 不会影响 FIGO 识别。
 */
function highlightFigo(html) {
  if (!html) return html

  // 罗马数字部分：I / II / III / IV（按长到短顺序，避免 IV 被 I+V 错拆）
  // 亚期：可选 A / B / C（后面可跟中文"期"）
  const ROMAN = '(?:IV|III|II|I)'
  const SUB   = '[ABC]?'
  const SUFFIX = '(?:期|stage)?'   // 可选中文"期"或英文 stage

  // 前缀：FIGO 后可跟 分期/期/：/:/空格 等任意组合
  const PREFIX = 'FIGO\s*(?:分期|期|[：:])\s*'

  const re = new RegExp(
    `(${PREFIX})(${ROMAN}${SUB}${SUFFIX})` +
    `|\b(FIGO)\s+(${ROMAN}${SUB}${SUFFIX})`,
    'gi'
  )

  return html.replace(re, (match, pre1, stage1, pre2, stage2) => {
    // 两种分支：带"FIGO分期/期/："前缀，或带空格的独立写法
    const stage = (stage1 || stage2 || '').trim()
    if (!stage) return match
    // 统一显示为 "FIGO <stage>"
    const label = `FIGO ${stage}`
    return `<span class="figo-inline">${label}</span>`
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 公共：将证据列表 + 参考文献转为 HTML 片段
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {Array}  evidenceList  store.evidenceList
 * @param {Array}  bib           store.analysisResult?.bibliography ?? []
 */
// ─────────────────────────────────────────────────────────────────────────────
// 内部：将参考文献数组渲染为完整医学文献卡片 HTML
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 支持字段（全部可选，有什么展示什么）：
 *   ref_index, pmid, id, title, guidelines, year, journal,
 *   authors, abstract, url, doi, link
 *
 * PMID 字段名兼容：pmid / PMID / id（当 id 看起来是数字时）
 */
function buildBibHtml(bib) {
  if (!bib || !bib.length) return ''

  // 指南来源对应的颜色主题
  function guidelineTheme(g) {
    if (!g) return { bg: 'var(--bg-2)', color: 'var(--text-muted)', border: 'var(--border)' }
    if (g.includes('ESGO') || g.includes('ESTRO'))
      return { bg: 'rgba(59,130,246,.10)', color: 'var(--accent-blue)',   border: 'rgba(59,130,246,.25)' }
    if (g.includes('NCCN'))
      return { bg: 'rgba(20,184,166,.10)', color: 'var(--accent-teal)',   border: 'rgba(20,184,166,.28)' }
    if (g.includes('FIGO'))
      return { bg: 'rgba(139,92,246,.10)', color: 'var(--accent-purple)', border: 'rgba(139,92,246,.25)' }
    if (g.includes('中华医学会') || g.includes('中国'))
      return { bg: 'rgba(34,197,94,.10)',  color: 'var(--accent-green)',  border: 'rgba(34,197,94,.25)'  }
    return { bg: 'var(--bg-2)', color: 'var(--text-muted)', border: 'var(--border-md)' }
  }

  // 判断 pmid：纯数字 = 真实 PubMed ID，长哈希 = 内部 ID
  function fmtId(pmid) {
    if (!pmid) return ''
    const s = String(pmid).trim()
    if (/^\d+$/.test(s)) return s                          // 纯数字，直接显示
    if (s.length > 16)   return s.slice(0, 8) + '…' + s.slice(-4) // 哈希缩略
    return s
  }

  const cards = bib.map(b => {
    const hasTitle     = b.title && b.title.trim()
    const hasGuideline = b.guidelines && b.guidelines.trim()
    const hasPmid      = b.pmid && String(b.pmid).trim()
    const theme        = guidelineTheme(b.guidelines)

    // 左侧彩色序号竖条颜色与指南主题一致
    const numStyle = `background:${theme.color};`

    // 指南标签
    const guideTag = hasGuideline ? `
      <span style="
        padding:2px 8px; border-radius:100px; font-size:10px; font-weight:700;
        background:${theme.bg}; color:${theme.color}; border:1px solid ${theme.border};
        white-space:nowrap;
      ">${escapeHtml(b.guidelines)}</span>` : ''

    // PMID / ID 行
    const idDisplay = hasPmid ? fmtId(b.pmid) : ''
    const idRow = idDisplay ? `
      <div style="display:flex;align-items:center;gap:5px;margin-top:5px;">
        <span style="
          font-size:9px;font-weight:700;letter-spacing:.04em;
          color:var(--text-muted);background:var(--bg-2);
          border:1px solid var(--border);border-radius:3px;
          padding:1px 5px;flex-shrink:0;font-family:var(--font-mono);
        ">${/^\d+$/.test(String(b.pmid)) ? 'PMID' : 'ID'}</span>
        <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);">${escapeHtml(idDisplay)}</span>
      </div>` : ''

    // 标题行
    const titleRow = hasTitle ? `
      <div style="
        font-size:13px;font-weight:600;color:var(--text-primary);
        line-height:1.5;margin-top:${idDisplay ? '4px' : '0'};
      ">${highlightFigo(escapeHtml(b.title))}</div>` : `
      <div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:4px;">（暂无标题）</div>`

    return `
    <div style="
      display:flex;align-items:stretch;
      border:1px solid var(--border);border-radius:8px;
      margin-bottom:8px;overflow:hidden;
      background:#fff;page-break-inside:avoid;
    ">
      <!-- 左侧序号竖条 -->
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:32px;flex-shrink:0;
        ${numStyle}
        color:#fff;font-size:12px;font-weight:800;
        font-family:var(--font-mono);
      ">${b.ref_index}</div>

      <!-- 右侧内容 -->
      <div style="flex:1;padding:9px 13px;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${guideTag}
        </div>
        ${idRow}
        ${titleRow}
      </div>
    </div>`
  }).join('\n')

  return `
  <div style="margin-top:8px;">
    <!-- 参考文献区块标题 -->
    <div style="
      display:flex;align-items:center;gap:10px;
      padding:10px 14px;margin-bottom:14px;
      background:linear-gradient(135deg,var(--accent-blue-light),rgba(20,184,166,.05));
      border:1px solid var(--accent-blue-mid);border-radius:8px;
    ">
      <div style="
        width:28px;height:28px;flex-shrink:0;
        background:var(--accent-blue);color:#fff;
        border-radius:6px;display:flex;align-items:center;justify-content:center;
        font-size:14px;
      ">📚</div>
      <div>
        <div style="font-size:15px;font-weight:800;font-family:var(--font-serif);color:var(--text-primary);">参考文献</div>
        <div style="font-size:11px;color:var(--text-muted);">References · ${bib.length} 篇</div>
      </div>
    </div>
    ${cards}
  </div>`
}

export function buildEvidenceHtml(evidenceList, bib = []) {
  const items = evidenceList.filter(e => !e.hidden)
  if (!items.length) return '<p style="color:#94a3b8;font-size:13px;padding:16px 0;">暂无证据数据</p>'

  // ── KG evidence in bibliography reference style ──
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

  const refHtml = items.map((item, idx) => {
    // Title
    let title = (item.title || '').trim()
    if (!title || title === '（无标题）') {
      title = item.content
        ? item.content.replace(/\\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean)[0]?.slice(0, 120) || `证据 ${idx + 1}`
        : `证据 ${idx + 1}`
    }
    title = esc(title).replace(/\n/g, ' ')

    // Meta line: source | evidence_level | year
    const metaParts = [item.source, item.evidence_level, item.year].filter(Boolean)
    const meta = metaParts.length ? esc(metaParts.join(' | ')) : ''

    // PMID or link
    let idHtml = ''
    if (item.link) {
      const pmidMatch = item.link.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)
      if (pmidMatch) {
        idHtml = `PMID: ${pmidMatch[1]}`
      } else {
        const shortLink = esc(item.link.replace(/^https?:\/\//, '').slice(0, 60))
        idHtml = `<a href="${esc(item.link)}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:none;">${shortLink}</a>`
      }
    }

    const starMark = item.highlighted ? ' <span style="color:#eab308;">★</span>' : ''

    return `
    <div class="ebm-ref-entry" style="margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">
      <div class="ebm-ref-idx" style="font-weight:600;color:#1e293b;margin-bottom:2px;">[${idx + 1}] ${starMark}</div>
      <div class="ebm-ref-detail" style="font-size:13px;color:#1e293b;padding-left:4px;">${title}</div>
      ${meta ? `<div class="ebm-ref-detail" style="font-size:13px;color:#475569;padding-left:4px;">${meta}</div>` : ''}
      ${idHtml ? `<div class="ebm-ref-detail" style="font-size:12px;color:#64748b;padding-left:4px;">${idHtml}</div>` : ''}
    </div>`
  }).join('\n')

  // 参考文献
  const bibHtml = bib.length ? buildBibHtml(bib) : ''

  return refHtml + bibHtml
}

// ─────────────────────────────────────────────────────────────────────────────
// 公共：生成完整报告 HTML 页面
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} options
 * @param {string}  options.mdtHtml
 * @param {string}  options.evidenceHtml
 * @param {string}  [options.esgo]         ESGO 风险分级
 * @param {string}  [options.figo]         FIGO 分期（如 "IIIA"、"IIB"）
 * @param {string}  [options.patientInfo]
 * @param {string}  [options.requestId]
 */
export function buildFullReportHtml({ mdtHtml, ebmBodyHtml, evidenceHtml, esgo = '', figo = '', patientInfo = '', requestId = '' }) {
  const ts = new Date().toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  // MDT 正文中的 FIGO 字样也醒目化
  const processedMdtHtml = mdtHtml ? highlightFigo(mdtHtml) : ''
  const hasMdt = !!mdtHtml
  const hasEbm = !!ebmBodyHtml

  // FIGO 封面徽章
  const figoBadge = figo ? `
    <div class="report-figo-badge">
      <span class="figo-icon">F</span>
      <span class="report-figo-label">FIGO 分期</span>
      <span class="report-figo-value">${escapeHtml(figo)}</span>
    </div>` : ''

  let sectionsHtml = ''

  // EBM 深搜校验结果正文（无章节标题头）
  if (hasEbm) {
    sectionsHtml += `
  <div class="mdt-rendered">${ebmBodyHtml}</div>
`
  }

  // MDT 治疗方案 (only if present)
  if (hasMdt) {
    sectionsHtml += '\n  <div class="module-divider"><span class="module-divider-text">MDT 治疗方案</span></div>\n'
    sectionsHtml += `
  <div class="report-section-heading">
    <div class="report-section-num">1</div>
    <div class="report-section-title">MDT 治疗方案</div>
    <div class="report-section-tag">ESGO 2025 / NCCN 指南</div>
  </div>

  <div class="mdt-rendered">${processedMdtHtml}</div>
`
  }

  // 循证证据与参考文献（无章节标题头）
  if (hasEbm || hasMdt) {
    sectionsHtml += '\n  <div class="module-divider"><span class="module-divider-text">循证证据与参考文献</span></div>\n'
  }
  sectionsHtml += `
  ${evidenceHtml}
`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>循证医学深搜校验报告</title>
  <style>
    ${CSS_VARS}
    ${BASE_STYLES}
    ${MDT_RENDERED_STYLES}
  </style>
</head>
<body>

  <div class="report-cover">
    <div class="report-cover-left">
      <div class="report-hospital">妇科肿瘤 MDT 智能决策系统</div>
      <div class="report-title">循证医学深搜校验报告</div>
      <div class="report-subtitle">Evidence-Based Medicine Verification Report</div>
    </div>
    <div class="report-cover-right">
      <div class="report-meta-row"><strong>生成时间：</strong>${ts}</div>
      ${requestId ? `<div class="report-meta-row"><strong>Request ID：</strong>${escapeHtml(requestId.slice(0, 8))}…</div>` : ''}
      ${esgo ? `<div class="report-esgo-badge">ESGO ${escapeHtml(esgo)}</div>` : ''}
      ${figoBadge}
    </div>
  </div>

  ${patientInfo ? `
  <div style="margin-bottom:28px;padding:12px 16px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text-secondary);line-height:1.7;white-space:pre-wrap;">${escapeHtml(patientInfo)}</div>
  ` : ''}
${sectionsHtml}
  <div class="report-footer-note">
    <strong>免责声明：</strong>本报告由 AI 辅助生成，仅供临床参考，不构成最终诊疗决策依据。
    所有治疗方案须由具有资质的临床医师结合患者实际情况综合判断后执行。
    参考指南：ESGO 2025 子宫内膜癌指南、NCCN 妇科肿瘤临床实践指南。
  </div>

</body></html>`
}


// ─────────────────────────────────────────────────────────────────────────────
// 导出方式 1：复制富文本
// ─────────────────────────────────────────────────────────────────────────────
export async function copyRichText(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const richHtml  = bodyMatch ? bodyMatch[1] : html
  const plainText = richHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .trim()

  if (navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([richHtml], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ])
  } else {
    await navigator.clipboard.writeText(plainText)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出方式 2：打印 / PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportToPdf(html) {
  const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
  if (!win) { alert('弹出窗口被阻止，请允许本页弹出新窗口后重试。'); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.addEventListener('load', () => setTimeout(() => win.print(), 300))
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出方式 3：Word (.doc) — 按预览格式导出，不含封面/徽章等 PDF 装饰
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 将预览 Markdown 转为 Word 导出用的简化 HTML 文档。
 * 与 PDF 格式不同：无封面页、无 FIGO 徽章、无章节编号圆圈，
 * 仅保留 .mdt-rendered 正文样式，与预览弹窗内效果一致。
 */
export function buildWordHtml(markdown, { renderMd } = {}) {
  if (!renderMd) {
    return wrapWordDoc(`<pre style="white-space:pre-wrap;font-family:var(--font-body);">${escapeHtml(markdown || '')}</pre>`)
  }
  const bodyHtml = renderMd(markdown || '')
  return wrapWordDoc(`<div class="mdt-rendered">${bodyHtml}</div>`)
}

/** 将 body 内容包装为 Word 兼容的 .doc 文档 */
function wrapWordDoc(bodyContent) {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
  <style>
    ${CSS_VARS}
    ${MDT_RENDERED_STYLES}
    body {
      font-family: var(--font-body);
      font-size: 14px;
      line-height: 1.85;
      color: var(--text-primary);
      padding: 40px 56px;
      max-width: 900px;
      margin: 0 auto;
    }
  </style>
</head>
<body>${bodyContent}</body>
</html>`
}

export function exportToWord(html, filename) {
  const fn = filename || `MDT报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.doc`
  const wordHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
      ${html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[0] || ''}
    </head>
    <body>${html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html}</body>
    </html>`

  const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = fn
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}