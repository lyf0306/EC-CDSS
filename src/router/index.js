import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/figo' },
  { path: '/figo', component: () => import('../views/FigoView.vue'), meta: { step: 1, title: '分期诊断' } },
  {
    path: '/treatment',
    component: () => import('../views/TreatmentView.vue'),
    meta: { step: 2, title: '方案生成' },
    beforeEnter: async (_to, _from) => {
      // 动态导入 store 避免循环依赖
      const { useDiagnosisStore } = await import('../stores/diagnosis')
      const store = useDiagnosisStore()
      if (!store.hasProfileResult && !store.figoStage && store.mode !== 'auto') {
        return '/figo'
      }
    },
  },
  { path: '/evidence', component: () => import('../views/EvidenceView.vue'), meta: { step: 3, title: '证据合成' } },
  { path: '/profile', component: () => import('../views/PatientProfileView.vue'), meta: { step: 1, title: '患者档案', isProfile: true } },
  { path: '/:pathMatch(.*)*', component: () => import('../views/NotFound.vue'), meta: { title: '404' } },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
