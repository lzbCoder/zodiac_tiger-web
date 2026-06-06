import api from './index'

export function getMcpList() {
  return api.get('/mcp/list')
}

export function saveMcp(data: Record<string, any>) {
  return api.post('/mcp/save', data)
}

export function testMcp(id: number) {
  return api.post('/mcp/test', { id })
}

export function toggleMcpStatus(id: number, status: number) {
  return api.post('/mcp/status', { id, status })
}

export function deleteMcp(id: number) {
  return api.delete('/mcp/delete', { data: { id } })
}

export function getMcpLog(mcpId: number, limit = 50) {
  return api.get('/mcp/log', { params: { mcp_id: mcpId, limit } })
}
