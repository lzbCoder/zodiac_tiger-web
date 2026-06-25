<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { ElMessageBox, ElMessage } from 'element-plus'
import { newSession } from '@/api/chat'
import SessionList from '@/components/chat/SessionList.vue'
import ChatWindow from '@/components/chat/ChatWindow.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import RightPanel from '@/components/chat/RightPanel.vue'
import HelpFloating from '@/components/chat/HelpFloating.vue'
import NewSessionDialog from '@/components/chat/NewSessionDialog.vue'

const store = useChatStore()
const chatWindowRef = ref<InstanceType<typeof ChatWindow>>()
const currentChatId = ref('')
const abortCtrl = ref<AbortController | null>(null)

// 刷新后不再提前新建会话（避免每次刷新往库里塞空会话）。
// 停在空欢迎态，首条消息发送时由 handleSend 懒创建会话。
async function handleSend(text: string, enableSearch: boolean = false) {
  if (!store.currentSessionId) {
    const res = await newSession()
    store.setSessionId(res.data.session_id)
  }

  currentChatId.value = ''
  store.addMessage({ role: 'user', content: text })
  store.clearSelection()
  store.isStreaming = true

  store.addMessage({ role: 'ai', content: '', steps: [] })
  const aiIdx = store.lastAiMsgIndex()
  store.applyAgentEvent(aiIdx, { type: 'progress', name: '开始处理', status: 'running', node_kind: 'stage' })

  const ctrl = new AbortController()
  abortCtrl.value = ctrl
  let wasAborted = false
  let hadError = false

  try {
    const resp = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        session_id: store.currentSessionId,
        message: text,
        enable_search: enableSearch,
        reply_model: store.replyModel,
        show_reasoning: store.showReasoning,
      }),
    })

    const reader = resp.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let buffer = ''
    let aiContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6)
        try {
          const event = JSON.parse(jsonStr)
          if (['progress', 'tool', 'retrieval', 'thinking', 'thinking_token'].includes(event.type)) {
            store.applyAgentEvent(aiIdx, event)
          } else if (event.type === 'token') {
            aiContent += event.content
            const msg = store.messages[aiIdx]
            if (msg) msg.content = aiContent
          } else if (event.type === 'interrupt') {
            const irData = JSON.parse(event.content || '{}')
            if (irData.type === 'travel_param_missing') {
              ElMessageBox.prompt(
                irData.prompt || `请输入${irData.label}`,
                irData.label || '补充信息',
                { confirmButtonText: '提交', cancelButtonText: '取消' },
              ).then(async ({ value }: any) => {
                if (!value) return
                const params: any = {}
                const f = irData.field
                params[f] = ['traveler_count','budget','days'].includes(f) ? parseInt(value) || 1 : value
                // 用 SSE 连接 resume，继续收事件流
                await resumeStream(params)
              }).catch(() => {})
            }

async function resumeStream(params: any) {
  store.isStreaming = true
  let hadError = false
  let interrupted = false
  try {
    const resp = await fetch('/api/chat/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params, chat_id: currentChatId.value, config: { configurable: { thread_id: `admin:${store.currentSessionId}`, reply_model: store.replyModel, enable_thinking: store.showReasoning } } }),
    })
    const reader = resp.body?.getReader()
    if (!reader) { store.isStreaming = false; return }
    const decoder = new TextDecoder()
    let buffer = ''
    let aiContent = ''
    const aiIdx = store.lastAiMsgIndex()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6))
        if (['progress', 'tool', 'retrieval', 'thinking', 'thinking_token'].includes(event.type)) {
          store.applyAgentEvent(aiIdx, event)
        } else if (event.type === 'token') {
          aiContent += event.content; const msg = store.messages[aiIdx]; if (msg) msg.content = aiContent
        } else if (event.type === 'error') {
          hadError = true
          const emsg = store.messages[aiIdx]
          if (emsg && event.chat_id) emsg.chatId = event.chat_id
        } else if (event.type === 'interrupt') {
          // 递归处理下一个中断
          interrupted = true
          store.isStreaming = false
          const ir = JSON.parse(event.content || '{}')
          if (ir.type === 'travel_param_missing') {
            ElMessageBox.prompt(ir.prompt || `请输入${ir.label}`, ir.label || '补充信息',
              { confirmButtonText: '提交', cancelButtonText: '取消' },
            ).then(async ({ value: v }: any) => {
              if (!v) return
              const p: any = {}; p[ir.field] = ['traveler_count','budget','days'].includes(ir.field) ? parseInt(v) || 1 : v
              await resumeStream(p)
            }).catch(() => {})
          }
          return
        }
      }
    }
  } catch (e: any) {
    hadError = true
  } finally {
    store.isStreaming = false
    // 还有后续中断时不收尾（交给下一段 resume）
    if (!interrupted) {
      const aiIdx = store.lastAiMsgIndex()
      const msg = store.messages[aiIdx]
      if (msg && msg.steps) {
        const endStatus = hadError ? 'error' : 'completed'
        for (const s of msg.steps) {
          if (s.status === 'running' || s.status === 'in_progress') s.status = endStatus
          if (s.thinking && s.thinking.status === 'running') s.thinking.status = endStatus
          if (s.tools) for (const t of s.tools) if (t.status === 'running') t.status = endStatus
        }
      }
      if (msg && !msg.content && hadError) {
        msg.content = '任务执行异常，请检查错误日志，稍后重试！'
      }
    }
  }
}
          } else if (event.type === 'done') {
            // 流结束，finally 块统一收尾
          } else if (event.type === 'result') {
            currentChatId.value = event.chat_id || ''
            const rmsg = store.messages[aiIdx]
            if (rmsg && event.chat_id) rmsg.chatId = event.chat_id
            // 实时更新左侧会话列表标题：仅对未命名会话（首条消息）自动命名，
            // 避免覆盖用户已重命名的标题（标题以后端持久化为准）
            if (event.session_title) {
              const cur = store.sessions.find((x) => x.id === store.currentSessionId)
              if (!cur || !cur.title || cur.title === '新会话') {
                store.updateSessionTitle(store.currentSessionId, event.session_title)
              }
            }
          } else if (event.type === 'error') {
            hadError = true
            // 绑定 chat_id，供错误详情弹窗查询 execution_error_log。
            // 不再合成额外「错误」节点：真实失败节点会变红 + 气泡 ChatAlert 已承载错误详情，
            // 且合成节点不入库、回显不一致。
            const emsg = store.messages[aiIdx]
            if (emsg && event.chat_id) emsg.chatId = event.chat_id
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      wasAborted = true
    } else {
      hadError = true
    }
  } finally {
    store.isStreaming = false
    abortCtrl.value = null
    const msg = store.messages[aiIdx]
    if (msg) {
      if (msg.steps) {
        // 异常→error(红)，手动终止→terminated(橙)，正常→completed
        const endStatus = wasAborted ? 'terminated' : (hadError ? 'error' : 'completed')
        for (const s of msg.steps) {
          if (s.status === 'running' || s.status === 'in_progress') s.status = endStatus
          if (s.thinking && s.thinking.status === 'running') s.thinking.status = endStatus
          if (s.tools) for (const t of s.tools) if (t.status === 'running') t.status = endStatus
        }
      }
      if (!msg.content) {
        msg.content = wasAborted
          ? '（任务已被手动终止）'
          : (hadError ? '任务执行异常，请检查错误日志，稍后重试！' : '（任务执行中，请稍后）')
      }
    }
    if (wasAborted) {
      ElMessage({ message: '任务已终止，当前执行进度已保存', type: 'warning', duration: 3000 })
    }
  }
}

async function handleStop() {
  // 先通知后端（Redis 信号）
  await fetch('/api/chat/abort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: store.currentSessionId }),
  }).catch(() => {})
  // 等 500ms 让后端有机会走 Redis 检测的优雅退出路径（GeneratorExit → break）
  // 避免直接硬断连导致 checkpointer 连接 pending 查询残留
  await new Promise(r => setTimeout(r, 500))
  abortCtrl.value?.abort()
}
</script>

<template>
  <div class="chat-view">
    <SessionList />
    <div class="chat-center">
      <div class="chat-center-inner">
        <ChatWindow ref="chatWindowRef" />
        <ChatInput @send="handleSend" @stop="handleStop" />
      </div>
      <!-- 能力选择弹窗：以对话区为居中参照，不侵入侧边栏 -->
      <div class="dialog-anchor">
        <NewSessionDialog v-model="store.showNewSessionDialog" />
      </div>
    </div>
    <RightPanel />
    <HelpFloating />
  </div>
</template>

<style scoped lang="scss">
.chat-view {
  display: flex;
  height: 100%;
}

.chat-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-items: center;
  position: relative; /* 弹窗绝对定位锚点 */
}

.dialog-anchor {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  /* pointer-events 不拦截，让弹窗内部可交互 */
  pointer-events: none;
}

.dialog-anchor > * {
  pointer-events: auto;
}

.dialog-anchor :deep(.el-overlay) {
  position: absolute;
}

.chat-center-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}
</style>
