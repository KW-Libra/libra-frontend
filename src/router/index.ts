import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true }
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/pages/SignupPage.vue'),
      meta: { public: true }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/pages/DashboardPage.vue')
    },
    {
      path: '/backtests/kr-objective-2020-2023-opendart-googlenews',
      name: 'backtest-validation',
      component: () => import('@/pages/BacktestValidationPage.vue')
    },
    {
      path: '/run/:threadId',
      name: 'run',
      component: () => import('@/pages/RunPage.vue')
    },
    {
      path: '/run/:threadId/result',
      name: 'run-result',
      component: () => import('@/pages/RunResultPage.vue')
    },
    {
      path: '/run/:threadId/report',
      name: 'run-report',
      component: () => import('@/pages/RunReportPage.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  auth.hydrate()

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if ((to.name === 'login' || to.name === 'signup') && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
