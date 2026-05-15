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
      component: () => import('@/pages/DashboardPage.vue'),
      meta: { public: true}
    },
    {
      path: '/run/:threadId',
      name: 'run',
      component: () => import('@/pages/RunPage.vue'),
      meta: { public: true }
    },
    {
      path: '/run/:threadId/result',
      name: 'run-result',
      component: () => import('@/pages/RunResultPage.vue'),
      meta: { public: true }
    },
    {
      path: '/run/:threadId/report',
      name: 'run-report',
      component: () => import('@/pages/RunReportPage.vue'),
      meta: { public: true }
    },
    {
      path: '/design/run-screen',
      name: 'design-run-screen',
      component: () => import('@/pages/design/RunScreenDesign.vue'),
      meta: { public: true }
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
  //if (to.meta.public && auth.isAuthenticated) {
  //  return { name: 'dashboard' }
  //}
})

export default router
