import api from './index'

export function getSkillList() {
  return api.get('/skill/list')
}

export function saveSkill(data: Record<string, any>) {
  return api.post('/skill/save', data)
}

export function toggleSkillStatus(id: number, status: number) {
  return api.post('/skill/status', { id, status })
}

export function deleteSkill(id: number) {
  return api.delete('/skill/delete', { params: { id } })
}

export function getAvailableSkills() {
  return api.get('/skill/available')
}
