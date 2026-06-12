import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 网络状态检测 composable
 * 暴露 isOnline ref，监听 navigator.onLine + online/offline 事件
 */
export function useNetworkStatus() {
  const isOnline = ref(navigator.onLine)

  function onOnline() { isOnline.value = true }
  function onOffline() { isOnline.value = false }

  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  })

  return { isOnline }
}
