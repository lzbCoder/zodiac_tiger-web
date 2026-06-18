import api from './index'
import type { AxiosRequestConfig } from 'axios'

export interface McpServer {
  mcp_key: string
  display_name: string
  endpoint_url: string
  auth_headers: Record<string, string>
  transport_type: string
  enable_status: number
  connect_status: number
  last_check_time: string | null
  remark: string | null
  create_time: string | null
}

export interface McpTool {
  mcp_key: string
  tool_name: string
  tool_desc: string | null
  input_schema: string | null
  is_allow: number
}

export const getMcpServerList = () => api.get('/mcp/server/list')

export const saveMcpServer = (data: {
  mcp_key: string
  display_name: string
  endpoint_url: string
  auth_headers?: Record<string, string>
  transport_type?: string
  remark?: string
}) => api.post('/mcp/server/save', data)

export const deleteMcpServer = (mcp_key: string) =>
  api.delete('/mcp/server/delete', { params: { mcp_key } })

export const toggleMcpStatus = (data: { mcp_key: string; enable_status: number }) =>
  api.put('/mcp/server/status', data)

export const testMcpConnect = (
  data: { endpoint_url: string; auth_headers: Record<string, string>; transport_type?: string; mcp_key?: string },
  config?: AxiosRequestConfig,
) => api.post('/mcp/server/test-connect', data, config)

export const syncMcpTools = (mcp_key: string) =>
  api.post('/mcp/server/sync-tools', null, { params: { mcp_key } })

export const getMcpTools = (mcp_key: string) =>
  api.get('/mcp/tools', { params: { mcp_key } })

export const toggleToolAllow = (data: { mcp_key: string; tool_name: string; is_allow: number }) =>
  api.put('/mcp/tool/allow', data)

export const getMcpAgentBind = (mcp_key: string) =>
  api.get('/mcp/agent-bind', { params: { mcp_key } })

export const updateMcpAgentBind = (data: { mcp_key: string; agent_codes: string[] }) =>
  api.put('/mcp/agent-bind', data)
