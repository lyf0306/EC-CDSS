/**
 * reportExport 纯函数单元测试
 * ──────────────────────────────────────────────────────────────
 * 覆盖 escapeHtml() —— XSS 最后防线，所有 5 种特殊字符必须转义。
 */

import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/utils/reportExport.js'

// ────────────────────────────────────────────────────────────────
describe('escapeHtml', () => {
  // ── 基础转义 ──────────────────────────────────────────────
  it('返回空字符串当输入为 falsy', () => {
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(false)).toBe('')
  })

  it('转义 & → &amp;', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('&&&')).toBe('&amp;&amp;&amp;')
  })

  it('转义 < → &lt; 和 > → &gt;', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('转义双引号 → &quot;', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
    expect(escapeHtml('"')).toBe('&quot;')
  })

  it('转义单引号 → &#039;', () => {
    expect(escapeHtml("it's")).toBe("it&#039;s")
    expect(escapeHtml("'")).toBe("&#039;")
  })

  // ── 组合场景 ──────────────────────────────────────────────
  it('同时转义全部 5 种特殊字符', () => {
    const input = '<a href="x" onclick=\'alert(&)\'>'
    const output = escapeHtml(input)
    expect(output).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#039;alert(&amp;)&#039;&gt;'
    )
  })

  it('不修改安全字符', () => {
    const input = 'Hello, World! 你好，世界！123'
    expect(escapeHtml(input)).toBe(input)
  })

  it('不修改空格和标点', () => {
    const input = 'Patient: 42-year-old female. Stage: IIIc1 (FIGO 2023)'
    expect(escapeHtml(input)).toBe(input)
  })

  // ── 边界情况 ──────────────────────────────────────────────
  it('处理数字输入', () => {
    expect(escapeHtml(42)).toBe('42')
    // 0 是 falsy，escapeHtml 返回空字符串（设计如此）
    expect(escapeHtml(0)).toBe('')
    expect(escapeHtml(-1)).toBe('-1')
  })

  it('处理对象输入（转为字符串）', () => {
    expect(escapeHtml({})).toBe('[object Object]')
  })

  it('处理数组输入（转为字符串含逗号）', () => {
    expect(escapeHtml([1, 2, 3])).toBe('1,2,3')
  })

  it('长字符串不丢失内容', () => {
    const input = 'a'.repeat(10000) + '<script>alert("xss")</script>'
    const output = escapeHtml(input)
    expect(output.length).toBeGreaterThan(input.length) // 特殊字符被替换后更长
    expect(output).toContain('&lt;script&gt;')
    expect(output).not.toContain('<script>')
  })

  // ── 回归快照 — 加新场景时只需往数组里加 ────────────────
  it('经典攻击向量全部被中和', () => {
    const vectors = [
      { input: '<script>alert(1)</script>',       forbidden: '<' },
      { input: 'javascript:alert(1)',              forbidden: ''   },  // 无特殊字符，原样返回
      { input: '<img src=x onerror=alert(1)>',     forbidden: '<' },
      { input: '"><script>alert(1)</script>',      forbidden: '<' },
      { input: "'; DROP TABLE users; --",          forbidden: ''   },  // 对 HTML 安全
    ]
    // 合法的 HTML 转义实体
    const validEntities = ['&amp;', '&lt;', '&gt;', '&quot;', '&#039;']
    for (const v of vectors) {
      const out = escapeHtml(v.input)
      if (v.forbidden) {
        expect(out).not.toContain(v.forbidden)
      }
      // 检查每个 & 都开启了合法实体
      let idx = 0
      while ((idx = out.indexOf('&', idx)) !== -1) {
        // 提取完整实体：从 & 到下一个 ;
        const semi = out.indexOf(';', idx)
        const entity = semi !== -1 ? out.substring(idx, semi + 1) : out.substring(idx)
        expect(validEntities).toContain(entity)
        idx = semi !== -1 ? semi + 1 : idx + 1
      }
    }
  })
})
