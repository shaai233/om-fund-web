import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/fund/:code',
      name: 'fund-detail',
      component: function () { return import('@/views/FundDetailView.vue') }
    },
    {
      path: '/index/:code',
      name: 'index-detail',
      component: function () { return import('@/views/IndexDetailView.vue') }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ],
  scrollBehavior: function () {
    return { top: 0 }
  }
})

export default router
