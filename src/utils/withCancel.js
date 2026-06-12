/**
 * 将 Promise 包装为可取消的（外部 AbortController 触发 reject）
 * autoExecutor.js 和 diagnosis.js 共用
 *
 * @param {Promise} promise   原始 Promise
 * @param {AbortSignal} signal 外部 AbortController.signal（可选）
 * @returns {Promise} 包装后的 Promise（abort 时 reject DOMException('Cancelled')）
 */
export function withCancel(promise, signal) {
  if (!signal) return promise
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Cancelled', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      v => { signal.removeEventListener('abort', onAbort); resolve(v) },
      e => { signal.removeEventListener('abort', onAbort); reject(e) }
    )
  })
}
