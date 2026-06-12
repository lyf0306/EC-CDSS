<template>
  <div class="t-card" :class="[`accent-${color}`, { 'is-editing': editing }]">
    <div class="t-header">
      <div class="t-left">
        <span class="t-icon">{{ icon }}</span>
        <div class="t-meta">
          <span class="t-category">{{ category }}</span>
          <div class="t-name"><slot name="title" /></div>
        </div>
      </div>
      <div class="t-right">
        <span class="tag" :class="levelClass">{{ level }}</span>
        <button v-if="editing" class="btn btn-ghost btn-sm del-btn" title="移除此项">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="t-detail">
      <slot name="detail" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  icon: String,
  category: String,
  level: String,
  color: { type: String, default: 'blue' },
  editing: Boolean,
})
const levelClass = computed(() => {
  if (props.level?.includes('A')) return 'tag-teal'
  if (props.level?.includes('B')) return 'tag-amber'
  return 'tag-blue'
})
</script>

<style scoped>
.t-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-0);
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 8px;
  transition: box-shadow 0.15s;
  border-left-width: 3px;
}
.t-card:hover { box-shadow: var(--shadow-sm); }
.t-card.is-editing { box-shadow: 0 0 0 2px rgba(37,99,235,0.15); border-color: var(--accent-blue); }

.accent-rose   { border-left-color: var(--accent-rose); }
.accent-blue   { border-left-color: var(--accent-blue); }
.accent-amber  { border-left-color: var(--accent-amber); }
.accent-purple { border-left-color: var(--accent-purple); }
.accent-teal   { border-left-color: var(--accent-teal); }
.accent-green  { border-left-color: var(--accent-green); }

.t-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.t-left { display: flex; align-items: flex-start; gap: 10px; }
.t-icon { font-size: 18px; line-height: 1; padding-top: 1px; flex-shrink: 0; }
.t-meta { display: flex; flex-direction: column; gap: 1px; }
.t-category { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.t-name { font-size: 14px; font-weight: 600; color: var(--text-primary); line-height: 1.4; }
.t-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.del-btn:hover { color: var(--accent-rose); background: var(--accent-rose-light); }

.t-detail { font-size: 13px; color: var(--text-secondary); line-height: 1.7; }
</style>