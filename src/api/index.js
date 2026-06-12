/**
 * API Service Layer
 * Wraps /api/v1/* endpoints from pipeline_service.py + analyze.py
 */

// const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const BASE = import.meta.env.VITE_API_BASE || 'http://117.50.173.249:8050'
const EBM_BASE = import.meta.env.VITE_EBM_BASE || 'http://117.50.173.249:8051'

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * 从 API 错误响应中提取可读的错误信息。
 * FastAPI 的 detail 字段可能是 string、object、array 等多种形态。
 */
function extractErrorDetail(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(d => d?.msg || (typeof d === 'string' ? d : JSON.stringify(d))).join('; ')
  }
  if (detail && typeof detail === 'object') {
    return detail.message || detail.msg || detail.error || JSON.stringify(detail)
  }
  return String(detail ?? '')
}

const RETRY_MAX = 3
const RETRY_BASE_DELAY = 1500  // ms，指数退避起点

/**
 * 判断错误是否属于瞬时故障（可重试）
 * — 并发限流：Too many concurrent jobs
 * — I/O 错误：Errno 5, Input/output error, Connection reset, Broken pipe
 * — HTTP 状态码：429, 502, 503, 504
 * — 网络错误：fetch 抛出 TypeError / AbortError
 */
function isTransientError(err) {
  const msg = (err.message || '').toLowerCase()
  // 后端并发限制
  if (msg.includes('too many concurrent')) return true
  // Python I/O 错误
  if (msg.includes('errno 5') || msg.includes('input/output error')) return true
  // 连接中断
  if (msg.includes('connection reset') || msg.includes('broken pipe')) return true
  if (msg.includes('econnreset') || msg.includes('econnrefused')) return true
  // HTTP 可重试状态码
  if (msg.includes('429') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true
  // 网络层错误（fetch TypeError）
  if (err.name === 'TypeError' && (msg.includes('network') || msg.includes('fetch'))) return true
  return false
}

/** 带指数退避重试的 fetch 包装 */
async function fetchWithRetry(url, options, retries = RETRY_MAX) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ detail: res.statusText }))
        const err = new Error(extractErrorDetail(errBody.detail) || `HTTP ${res.status}`)
        // 只有瞬时可重试错误才继续，4xx（除 429）不重试
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw err
        if (attempt < retries && isTransientError(err)) {
          await new Promise(r => setTimeout(r, RETRY_BASE_DELAY * Math.pow(2, attempt)))
          continue
        }
        throw err
      }
      return res
    } catch (err) {
      // AbortError（用户取消）不重试
      if (err.name === 'AbortError') throw err
      if (attempt < retries && isTransientError(err)) {
        console.warn(`[API] 瞬时错误，${RETRY_BASE_DELAY * Math.pow(2, attempt)}ms 后重试 (${attempt + 1}/${retries}):`, err.message)
        await new Promise(r => setTimeout(r, RETRY_BASE_DELAY * Math.pow(2, attempt)))
        continue
      }
      throw err
    }
  }
}

async function post(path, body) {
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function postEbm(path, body) {
  const res = await fetchWithRetry(`${EBM_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function getEbm(path) {
  const res = await fetchWithRetry(`${EBM_BASE}${path}`)
  return res.json()
}


// ─── /api/v1/figo-stage ────────────────────────────────────────────────────
// 第一步：调用 OriClinical vLLM 进行 FIGO 分期
// 返回：{ figo_stage: "IIIC1ii", raw_output: "..." }
export async function apiFigoStage(patientCase) {
  return post('/api/v1/figo-stage', { patient_case: patientCase })
}


// ─── /api/v1/analyze/profile-only ──────────────────────────────────────────
// Used after FIGO step: extract profile + keywords + ESGO from patient_case
export async function apiProfileOnly(patientCase) {
  return post('/api/v1/analyze/profile-only', { patient_case: patientCase })
}

// ─── /api/v1/analyze (full pipeline, non-streaming) ────────────────────────
export async function apiAnalyzeFull(patientCase, topKSimilar = 3) {
  return post('/api/v1/analyze', { patient_case: patientCase, top_k_similar: topKSimilar })
}

// ─── /api/v1/analyze/stream (SSE streaming) ─────────────────────────────────
// onEvent(type, payload) called for each SSE event
// onToken(text) for incremental MDT text chunks
// Returns a controller with .abort()
export function apiAnalyzeStream(patientCase, topKSimilar, { onEvent, onToken, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_case: patientCase, top_k_similar: topKSimilar }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        onError?.(new Error(extractErrorDetail(err.detail) || `HTTP ${res.status}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = null;
      let chunkCount = 0;

      console.log('[SSE] 连接已建立，开始读取流...', { status: res.status, contentType: res.headers.get('content-type') });

      // 解析单行的函数
      const processLine = (line) => {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (currentEvent === 'token') {
            onToken?.(dataStr);
          } else if (currentEvent === 'error') {
            try {
              const errorObj = JSON.parse(dataStr);
              console.error('[SSE ERROR]', errorObj);
              onError?.(new Error(extractErrorDetail(errorObj.detail) || dataStr));
            } catch {
              onError?.(new Error(dataStr));
            }
          } else if (currentEvent === 'result') {
            try {
              const resultObj = JSON.parse(dataStr);
              console.log('[SSE RESULT]', resultObj);
              onEvent?.('result', resultObj);
            } catch (e) {
              console.error('[SSE RESULT PARSE ERROR]', dataStr, e);
            }
          } else if (currentEvent === 'progress') {
            try {
              const progObj = JSON.parse(dataStr);
              console.log('[SSE PROGRESS]', progObj);
              onEvent?.('progress', progObj);
            } catch (e) {
              console.error('[SSE PROGRESS PARSE ERROR]', dataStr, e);
            }
          }
          currentEvent = null; // reset after processing data
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`[SSE] 流关闭，共收到 ${chunkCount} 个数据块，buffer 剩余: "${buffer.slice(0,200)}"`);
          // 处理 buffer 中剩余的内容（可能包含最后的事件）
          if (buffer.trim()) {
            const remainingLines = buffer.split('\n');
            for (const line of remainingLines) {
              processLine(line);
            }
          }
          break;
        }
        chunkCount++;
        const text = decoder.decode(value, { stream: true });
        if (chunkCount <= 3) console.log(`[SSE] 第${chunkCount}块 (${value.byteLength} bytes):`, text.slice(0,300));
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整的行
        for (const line of lines) {
          processLine(line);
        }
      }
      console.log(`[SSE] 结束 — 共处理 ${chunkCount} 块数据，事件类型统计见上方`);
      onDone?.();
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('[SSE FATAL]', e);
        onError?.(e);
      }
    }
  })();

  return controller;
}

// ─── PathoEBM API (port 8002) ────────────────────────────────────────────────
// Evidence-based medicine deep search — async job-based API

/** Submit a new EBM deep-search job */
export async function apiEbmSubmit(treatmentContext, modelChoice = 'auto', maxIterations = 2) {
  return postEbm('/jobs', {
    treatment_context: treatmentContext,
    model_choice: modelChoice,
    max_iterations: maxIterations,
  })
}

/** Poll job status + progress */
export async function apiEbmJobStatus(jobId) {
  return getEbm(`/jobs/${jobId}`)
}

/** Fetch final report (only after completed) */
export async function apiEbmJobResult(jobId) {
  return getEbm(`/jobs/${jobId}/result`)
}

/** Cancel a running EBM job */
export async function apiEbmCancel(jobId) {
  const res = await fetch(`${EBM_BASE}/jobs/${jobId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** Health check */
export async function apiEbmHealth() {
  return getEbm('/health')
}

// ─── File parsing (client-side, before sending to backend) ──────────────────
// Extracts text from .docx or .pdf uploaded by the user,
// then returns the full text as patient_case string.

export async function parseUploadedFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'docx') {
    // 先校验文件头部是否为 ZIP (PK)
    await validateZipHeader(file)
    return parseDocx(file)
  } else if (ext === 'pdf') {
    return parsePdf(file)
  } else if (ext === 'txt') {
    return file.text()
  } else if (ext === 'doc') {
    throw new Error('暂不支持旧版 .doc 格式，请先转换为 .docx 再上传')
  }

  throw new Error(`不支持的文件格式：.${ext}，请上传 .docx、.pdf 或 .txt 文件`)
}

async function parseDocx(file) {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  try {
    const result = await mammoth.extractRawText({ arrayBuffer })
    if (!result.value?.trim()) throw new Error('Word 文档内容为空')
    return result.value.trim()
  } catch (err) {
    // 如果 jszip 解压失败，给出明确提示
    if (err.message?.includes('central directory')) {
      throw new Error('文件已损坏或不是有效的 .docx 文件，请尝试重新保存后上传')
    }
    throw new Error(`Word 文件解析失败：${err.message}`)
  }
}

async function parsePdf(file) {
  // Use PDF.js from CDN via dynamic import workaround
  const pdfjsLib = await import('pdfjs-dist')
  // Set worker source — use local bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    pages.push(textContent.items.map(item => item.str).join(' '))
  }
  const text = pages.join('\n').trim()
  if (!text) throw new Error('PDF 文档内容为空或为扫描件（无法提取文字）')
  return text
}

/**
 * 校验文件是否为有效的 ZIP 格式（docx 必须满足）
 * 通过读取前 4 字节判断是否为 PK 头
 */
async function validateZipHeader(file) {
  const headerBytes = await readFirstBytes(file, 4)
  const header = new TextDecoder().decode(headerBytes)
  if (header !== 'PK\x03\x04') {
    throw new Error('该文件不是有效的 .docx 格式（Word 2007+），请确认文件来源')
  }
}

function readFirstBytes(file, n) {
  return new Promise((resolve, reject) => {
    const blob = file.slice(0, n)
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result))
    reader.onerror = () => reject(new Error('无法读取文件头部'))
    reader.readAsArrayBuffer(blob)
  })
}