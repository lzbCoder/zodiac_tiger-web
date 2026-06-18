import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/chat',
    },
    {
      path: '/chat',
      name: 'Chat',
      component: () => import('@/views/ChatView.vue'),
    },
    {
      path: '/template',
      name: 'Template',
      component: () => import('@/views/TemplateView.vue'),
    },
    {
      path: '/skill',
      name: 'Skill',
      component: () => import('@/views/SkillView.vue'),
    },
    {
      path: '/skill/:skill_key',
      name: 'SkillDetail',
      component: () => import('@/views/SkillDetailView.vue'),
    },
    {
      path: '/mcp',
      name: 'Mcp',
      component: () => import('@/views/McpServerView.vue'),
    },
    {
      path: '/file',
      name: 'File',
      component: () => import('@/views/FileView.vue'),
    },
    {
      path: '/setting',
      name: 'Setting',
      component: () => import('@/views/SettingView.vue'),
    },
  ],
})

export default router
