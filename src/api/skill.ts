import api from './index'

export interface SkillInfo {
  skill_key: string
  display_name: string
  skill_desc: string
  display_desc: string | null
  folder_abs_path: string
  enable_status: number
  sort: number
  create_time: string | null
  update_time: string | null
}

export function uploadSkill(formData: FormData) {
  return api.post('/skill/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function getSkillList() {
  return api.get('/skill/list')
}

export function editSkill(data: { skill_key: string; display_name: string; display_desc?: string | null }) {
  return api.put('/skill/edit', data)
}

export function toggleSkillStatus(data: { skill_key: string; enable_status: number }) {
  return api.put('/skill/status', data)
}

export function deleteSkill(skill_key: string) {
  return api.delete(`/skill/delete/${skill_key}`)
}

export function getSkillDetail(skill_key: string) {
  return api.get('/skill/detail', { params: { skill_key } })
}

export function getSkillAgentBind(skill_key: string) {
  return api.get('/skill/agent-bind', { params: { skill_key } })
}

export function updateSkillAgentBind(data: { skill_key: string; agent_codes: string[] }) {
  return api.put('/skill/agent-bind', data)
}
