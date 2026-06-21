import api from './index'

export function streamChat(sessionId: string, message: string): EventSource {
  const params = new URLSearchParams({ session_id: sessionId, message })
  // 使用 fetch + ReadableStream 方式处理 SSE 需要更复杂的逻辑
  // 这里返回 URL 供组件使用 EventSource
  const url = `/api/chat/stream`
  return null as any  // 实际流式处理在组件中通过 fetch 实现
}

export function getHistory(sessionId: string) {
  return api.get('/chat/history', { params: { session_id: sessionId } })
}

export function getErrorLog(chatId: string) {
  return api.get(`/chat/error/${chatId}`)
}

export function getSessionList() {
  return api.get('/chat/session/list')
}

export function newSession() {
  return api.post('/chat/session/new')
}

export function deleteSession(sessionId: string) {
  return api.delete('/chat/session', { params: { session_id: sessionId } })
}
