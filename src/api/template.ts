import api from './index'

export function getTemplateList(params?: Record<string, any>) {
  return api.get('/template/list', { params })
}

export function saveTemplate(data: Record<string, any>) {
  return api.post('/template/save', data)
}

export function deleteTemplate(id: number) {
  return api.delete('/template/delete', { params: { template_id: id } })
}

export function toggleTemplateStatus(id: number, status: number) {
  return api.post('/template/status', { id, status })
}
