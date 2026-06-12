<template>
  <div class="not-found-page">
    <div class="nf-card">
      <div class="nf-code">404</div>
      <h1 class="nf-title">页面未找到</h1>
      <p class="nf-desc">您访问的页面不存在或已被移除</p>
      <button class="btn btn-primary" @click="$router.push('/figo')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        返回分期诊断
      </button>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 40px 20px;
}
.nf-card {
  text-align: center;
  max-width: 420px;
}
.nf-code {
  font-size: 96px;
  font-weight: 800;
  color: var(--accent-blue);
  line-height: 1;
  margin-bottom: 8px;
  font-family: 'JetBrains Mono', monospace;
}
.nf-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}
.nf-desc {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 24px;
}
</style>
