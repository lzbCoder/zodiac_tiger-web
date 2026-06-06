import api from './index'

export function getLangSmithStatus() {
  return api.get('/settings/langsmith')
}

export function toggleLangSmith(enabled: boolean) {
  return api.post('/settings/langsmith', { enabled })
}
