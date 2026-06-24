import api from './index'

export function getLangSmithStatus() {
  return api.get('/settings/langsmith')
}

export function toggleLangSmith(enabled: boolean) {
  return api.post('/settings/langsmith', { enabled })
}

export interface LogConfig {
  level: string
  rotationSize: number
  retentionDays: number
}

export function getLogConfig() {
  return api.get('/settings/log')
}

export function saveLogConfig(payload: LogConfig) {
  return api.post('/settings/log', payload)
}
