<template>
  <div class="mdt-report-renderer">

    <!-- 骨架屏 -->
    <div v-if="loading && !markdown" class="skel-wrap" aria-label="加载中">
      <div class="skel-stack">
        <div
          v-for="i in 7"
          :key="i"
          class="skeleton"
          :style="{ height: '13px', width: (48 + i * 7) + '%' }"
        ></div>
      </div>
    </div>

    <!-- 渲染区域
         streaming=true  → 加 mdt-cursor-active，显示末尾光标
         streaming=false → 纯展示，无任何动画
    -->
    <div
      v-else-if="markdown"
      class="mdt-rendered"
      :class="{ 'mdt-cursor-active': streaming }"
      v-html="renderedHtml"
    ></div>

    <!-- 空状态 -->
    <div v-else class="mdt-empty">
      <slot name="empty">
        <div class="empty-inner">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
          </svg>
          <p>暂无报告内容</p>
        </div>
      </slot>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { renderMd } from '../utils/markdown.js'

const props = defineProps({
  markdown:  { type: String,  default: '' },
  loading:   { type: Boolean, default: false },
  /**
   * 只有在 SSE 流式输出"进行中"时才传 true。
   * 流结束后父组件必须把它设回 false，否则光标会一直闪。
   */
  streaming: { type: Boolean, default: false },
})

const renderedHtml = computed(() => renderMd(props.markdown))
</script>

<style scoped>
/* ── 容器 ── */
.mdt-report-renderer { width: 100%; }

/* ── 骨架屏 ── */
.skel-wrap  { padding: 4px 0; }
.skel-stack { display: flex; flex-direction: column; gap: 10px; }
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-2, #f1f5f9) 25%,
    var(--bg-3, #e2e8f0) 50%,
    var(--bg-2, #f1f5f9) 75%
  );
  background-size: 400% 100%;
  border-radius: 4px;
  animation: shimmer 1.4s ease infinite;
}
@keyframes shimmer {
  0%   { background-position: 100% 50%; }
  100% { background-position: 0%   50%; }
}

/* ── 空状态 ── */
.mdt-empty {
  display: flex; align-items: center; justify-content: center; padding: 48px 24px;
}
.empty-inner {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; color: var(--text-muted, #94a3b8);
}
.empty-inner p { font-size: 13px; margin: 0; }

/* ── 流式光标 ────────────────────────────────────────────────────────────────
   关键修正：
   1. 不使用 :global()，改用 :deep() —— scoped 样式穿透 v-html 内容的正确姿势
   2. selector 直接从 .mdt-cursor-active 向下穿透，不再重复写 .mdt-rendered
   3. 仅当父元素带有 .mdt-cursor-active 时才生效，其余情况零副作用
─────────────────────────────────────────────────────────────────────────── */
.mdt-cursor-active :deep(p:last-child)::after,
.mdt-cursor-active :deep(li:last-child)::after,
.mdt-cursor-active :deep(h1:last-child)::after,
.mdt-cursor-active :deep(h2:last-child)::after,
.mdt-cursor-active :deep(h3:last-child)::after {
  content: '▋';
  display: inline-block;
  animation: mdt-blink 0.8s step-end infinite;
  color: var(--accent-blue, #3b82f6);
  font-size: 0.85em;
  margin-left: 2px;
  vertical-align: baseline;
}

/* keyframe 名加前缀，避免与任何全局 blink 冲突 */
@keyframes mdt-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>