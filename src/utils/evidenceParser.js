/**
 * evidenceParser.js — 循证文献解析工具集
 *
 * 从 EvidenceView.vue 中抽离的纯函数，负责：
 *   1. MDT 报告的参考文献解析（3 种回退策略）
 *   2. EBM 深搜报告的参考文献解析与 HTML 渲染
 *   3. 文本归一化 + 三元组相似度（用于去重）
 *   4. PMID 提取
 */

// ── 内部 HTML 转义（与 escapeHtml 功能相同，但避免循环依赖） ──────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ═══════════════════════════════════════════════════════════════
// 1. 文本归一化 & 相似度
// ═══════════════════════════════════════════════════════════════

/** 归一化文本用于引文匹配 */
export function normForCite(s) {
  return (s || '').toLowerCase().replace(/[\s.,;:!?，。；：！？\-_()（）[\]【】"“”'‘’]+/g, ' ').trim()
}

/** 归一化文本用于去重比较 */
export function normalizeForDedup(s) {
  return s
    .toLowerCase()
    .replace(/[()（）,，.。;；:：'""''""\[\]【】《》<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 基于字符三元组的 Jaccard 相似度
 * 对近重复检测鲁棒，容忍微小措辞差异
 */
export function trigramSimilarity(a, b) {
  if (a === b) return 1.0
  if (!a || !b) return 0
  function trigrams(s) {
    const set = new Set()
    for (let i = 0; i < s.length - 2; i++) {
      set.add(s.substring(i, i + 3))
    }
    return set
  }
  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 && tb.size === 0) return 1.0
  let intersection = 0
  for (const t of ta) {
    if (tb.has(t)) intersection++
  }
  const union = ta.size + tb.size - intersection
  return union === 0 ? 0 : intersection / union
}

// ═══════════════════════════════════════════════════════════════
// 2. 报告拆分
// ═══════════════════════════════════════════════════════════════

/** 将 EBM 深搜报告拆分为正文和参考文献两部分 */
export function splitEbmReport(text) {
  if (!text) return { body: '', refsText: '' }
  const sepRe = /^=+\s*(?:参考文献|References).*$/m
  const match = sepRe.exec(text)
  if (!match) return { body: text, refsText: '' }
  return {
    body: text.slice(0, match.index).trimEnd(),
    refsText: text.slice(match.index),
  }
}

/**
 * 将 EBM 报告正文沿"临床试验"章节边界拆分为前后两部分。
 * 仅"核心临床试验及 PICO 循证解析"章节需要引用编号偏移，
 * "核心指南与共识详尽解析"章节的引用编号保持原样。
 *
 * @returns {{ beforeClinical: string, clinical: string }}
 */
export function splitEbmBodySections(bodyText) {
  if (!bodyText) return { beforeClinical: '', clinical: '' }

  // 匹配 ##/### 级别标题，包含"临床试验"关键词
  const headerRe = /^#{2,3}\s+(?:核心)?临床试验/m
  const match = headerRe.exec(bodyText)

  if (!match) return { beforeClinical: bodyText, clinical: '' }

  return {
    beforeClinical: bodyText.slice(0, match.index),
    clinical: bodyText.slice(match.index),
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. 参考文献条目拆分
// ═══════════════════════════════════════════════════════════════

/**
 * 将参考文献文本按 [N] 边界拆分为独立条目
 * 每个条目以 [N] 开头，包含后续的缩进详情行
 */
export function splitRefEntries(lines) {
  const entries = []
  let cur = null
  for (const line of lines) {
    if (/^\[\d+\]/.test(line.trimStart())) {
      if (cur && cur.length > 0) entries.push(cur)
      cur = [line]
    } else if (cur) {
      cur.push(line)
    }
  }
  if (cur && cur.length > 0) entries.push(cur)
  return entries
}

/** 渲染单条参考文献为 HTML */
function renderRefEntry(lines) {
  if (lines.length === 0) return ''
  let h = '<div class="ebm-ref-entry">'
  h += `<div class="ebm-ref-idx">${esc(lines[0])}</div>`
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    if (trimmed) {
      h += `<div class="ebm-ref-detail">${esc(trimmed)}</div>`
    }
  }
  h += '<div class="ebm-ref-sep"></div>'
  h += '</div>'
  return h
}

/**
 * 渲染 EBM 参考文献块为 HTML
 * 含近重复检测：两条参考文献如果 Title + Guidelines 相似度 > 0.7，仅保留第一条
 */
export function renderEbmRefs(refsText) {
  if (!refsText) return ''

  const entries = []
  let headerText = ''

  const blocks = refsText.split(/\n-{5,}\n?/).filter(b => b.trim())
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '')
    const firstLine = lines[0] || ''

    if (/^=+/.test(firstLine)) {
      headerText = firstLine
      const refGroups = splitRefEntries(lines.slice(1))
      for (const refLines of refGroups) {
        const detailText = refLines.slice(1).map(l => l.trimStart()).filter(Boolean).join(' ')
        entries.push({ lines: refLines, detailText, isDup: false, dupOf: -1 })
      }
    } else {
      const refGroups = splitRefEntries(lines)
      for (const refLines of refGroups) {
        const detailText = refLines.slice(1).map(l => l.trimStart()).filter(Boolean).join(' ')
        entries.push({ lines: refLines, detailText, isDup: false, dupOf: -1 })
      }
    }
  }

  // 近重复检测
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].isDup) continue
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[j].isDup) continue
      const sim = trigramSimilarity(
        normalizeForDedup(entries[i].detailText),
        normalizeForDedup(entries[j].detailText)
      )
      if (sim > 0.7) {
        entries[j].isDup = true
        entries[j].dupOf = i
      }
    }
  }

  // 渲染
  let uniqueCount = 0, dupCount = 0
  let html = ''
  if (headerText) html += `<div class="ebm-ref-header">${esc(headerText)}</div>`
  for (const e of entries) {
    if (e.isDup) {
      dupCount++
      continue
    }
    uniqueCount++
    html += renderRefEntry(e.lines)
  }

  if (dupCount > 0) {
    html += `<div style="color:#94a3b8;font-size:12px;margin-top:4px;">（已自动过滤 ${dupCount} 条高度相似的重复文献）</div>`
  }

  return html
}

// ═══════════════════════════════════════════════════════════════
// 4. EBM 参考文献解析（用于合并编号）
// ═══════════════════════════════════════════════════════════════

/**
 * 解析 EBM 参考文献文本为结构化条目（去掉 [N] 编号前缀，供重新编号）
 */
export function parseEbmRefEntries(refsText) {
  if (!refsText) return []
  const lines = refsText.split('\n')
  const entries = []
  let curLines = []
  let inEntry = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^=+/.test(trimmed)) continue
    if (/^-{5,}/.test(trimmed)) {
      if (inEntry && curLines.length > 0) {
        entries.push({ content: curLines.join('\n').trim() })
        curLines = []
        inEntry = false
      }
      continue
    }
    if (/^\[\d+\]/.test(trimmed)) {
      if (inEntry && curLines.length > 0) {
        entries.push({ content: curLines.join('\n').trim() })
      }
      curLines = [trimmed.replace(/^\[\d+\]\s*/, '')]
      inEntry = true
    } else if (inEntry && trimmed) {
      curLines.push(trimmed.startsWith('  ') ? trimmed : '  ' + trimmed)
    }
  }
  if (inEntry && curLines.length > 0) {
    entries.push({ content: curLines.join('\n').trim() })
  }
  return entries
}

/**
 * 为 EBM 参考文献条目构建 HTML，支持偏移编号
 * @param {Array}  entries   parseEbmRefEntries 的输出
 * @param {number} offset    起始编号偏移（KG 文献数量）
 */
export function buildEbmRefsOffsetHtml(entries, offset) {
  if (!entries || !entries.length) return ''

  let html = '<div class="ebm-refs" style="margin-top:20px;">'
  html += `<div class="ebm-refs-hdr" style="font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #3b82f6;">深搜新增参考文献（${entries.length} 条）</div>`

  entries.forEach((ref, i) => {
    const newIdx = offset + i + 1
    const contentLines = ref.content.split('\n')
    const firstLine = contentLines[0] || ''
    const restLines = contentLines.slice(1)

    html += `
    <div class="ebm-ref-entry" style="margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
      <div class="ebm-ref-idx" style="font-weight:600;color:#1e293b;margin-bottom:2px;">[${newIdx}] ${esc(firstLine)}</div>`
    restLines.forEach(l => {
      const trimmed = l.trimStart()
      if (trimmed) {
        html += `<div class="ebm-ref-detail" style="font-size:13px;color:#475569;padding-left:4px;">${esc(trimmed)}</div>`
      }
    })
    html += '</div>'
  })

  html += '</div>'
  return html
}

// ═══════════════════════════════════════════════════════════════
// 5. MDT 报告参考文献解析（3 种回退策略）
// ═══════════════════════════════════════════════════════════════

/**
 * 从 MDT 报告文本中解析参考文献列表
 *
 * 策略（按优先级）：
 *   1. Format A — EBM 结构化格式：[N] PMID: xxx | 证据等级 … Title: … Guidelines: …
 *   2. Format B — MDT 纯文本：[N]\n<Title>\n<Source>\nPMID: …
 *   3. Loose chunk — 按 [N] 边界拆分，提取能提取的一切
 */
export function parseMdtReferences(reportText) {
  if (!reportText) return []

  const sepRe = /(?:^=+\s*|^#{1,3}\s*|^\**\s*|^)(?:参考文献|References)(?:\s*\**|\s*={2,}|:.*)?\s*$/m
  const match = sepRe.exec(reportText)
  if (!match) return []
  const refSection = reportText.slice(match.index)

  // Format A
  const entryRe = /\[(\d+)\]\s*(PMID:\s*\d+[^\n]*|NCT\d+[^\n]*)((?:\s*\|\s*[^\n]*)?)\n\s*Title:\s*([^\n]+)\n\s*Guidelines:\s*([^\n]*)/g
  let items = []
  let em
  while ((em = entryRe.exec(refSection)) !== null) {
    const idLine = em[2].trim()
    const badges = em[3].trim()
    const title = em[4].trim()
    const pmidMatch = idLine.match(/PMID:\s*(\d{7,9})/)
    const nctMatch = idLine.match(/(NCT\d{8})/)
    const link = pmidMatch
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`
      : nctMatch
        ? `https://clinicaltrials.gov/study/${nctMatch[1]}`
        : ''
    const source = badges.replace(/^\|\s*/, '').trim() || 'PubMed'
    items.push({ id: items.length, title, content: title, source, link, highlighted: false, hidden: false, _fromReport: true })
  }
  if (items.length > 0) return items

  // Format B
  const plainRe = /\[(\d+)\]\s*\n\s*([^\n]+)\n\s*([^\n]+)\n\s*PMID:\s*(\d{7,9}|[0-9a-fA-F]{64,})\s*(?:\n|$)/g
  while ((em = plainRe.exec(refSection)) !== null) {
    const num = em[1]
    const title = em[2].trim()
    const sourceRaw = em[3].trim()
    const pmid = em[4].trim()
    const isRealPmid = /^\d{7,9}$/.test(pmid)
    const link = isRealPmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : ''
    const source = sourceRaw || '参考文献'
    items.push({ id: items.length, title, content: title, source, link, highlighted: false, hidden: false, _fromReport: true })
  }

  // Format C — loose chunk fallback
  if (items.length === 0) {
    const body = refSection.replace(/^.*\n/, '').replace(/^[-–—]{3,}\s*\n?/gm, '')
    const chunkRe = /\[(\d+)\][\s\S]*?(?=\[\d+\]|$)/g
    let chunk
    while ((chunk = chunkRe.exec(body)) !== null) {
      const block = chunk[0]
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) continue
      const title = lines[1].length > 10 ? lines[1] : (lines[2] || lines[1])
      const pmidLine = lines.find(l => /^PMID:\s*(\d+|[\da-fA-F]{32,})/.test(l))
      let link = ''
      if (pmidLine) {
        const pm = pmidLine.match(/^PMID:\s*(\d+|[\da-fA-F]{32,})/)
        if (pm) {
          link = /^\d{7,9}$/.test(pm[1]) ? `https://pubmed.ncbi.nlm.nih.gov/${pm[1]}/` : ''
        }
      }
      const nonPmidLines = lines.slice(1).filter(l => !/^PMID:/.test(l))
      const source = nonPmidLines.length > 1 ? nonPmidLines[1] : (nonPmidLines[0] !== title ? nonPmidLines[0] : '参考文献')
      items.push({ id: items.length, title, content: title, source: source || '参考文献', link, highlighted: false, hidden: false, _fromReport: true })
    }
  }

  return items
}

/**
 * 从报告文本的参考文献区段提取所有 PMID
 */
export function extractRefPmidsFromReport(reportText) {
  if (!reportText) return new Set()
  const sepRe = /(?:^=+\s*|^#{1,3}\s*|^\**\s*|^)(?:参考文献|References)(?:\s*\**|\s*={2,}|:.*)?\s*$/m
  const match = sepRe.exec(reportText)
  if (!match) return new Set()
  const refSection = reportText.slice(match.index)
  const pmids = new Set()
  const pmidRe = /PMID:\s*(\d{7,9})/g
  let m
  while ((m = pmidRe.exec(refSection)) !== null) {
    pmids.add(m[1])
  }
  return pmids
}
