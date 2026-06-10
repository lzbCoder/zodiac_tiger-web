<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { ElMessageBox } from 'element-plus'
import { newSession } from '@/api/chat'
import SessionList from '@/components/chat/SessionList.vue'
import ChatWindow from '@/components/chat/ChatWindow.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import RightPanel from '@/components/chat/RightPanel.vue'

const store = useChatStore()
const chatWindowRef = ref<InstanceType<typeof ChatWindow>>()
const currentChatId = ref('')

onMounted(async () => {
  if (!store.currentSessionId) {
    try {
      const res = await newSession()
      store.setSessionId(res.data.session_id)
    } catch {
      // handled
    }
  }
})

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
  store.upsertStepForMessage(aiIdx, { step: '开始处理', status: 'running' })

  try {
    const resp = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: store.currentSessionId,
        message: text,
        enable_search: enableSearch,
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
          if (event.type === 'progress' || event.type === 'thought' || event.type === 'tool' || event.type === 'retrieval') {
            store.upsertStepForMessage(aiIdx, {
              step: event.name, name: event.name,
              status: event.status, cost_ms: event.cost_ms,
              intent: event.intent,
              detail: event.detail,
              tool_args: event.tool_args,
              cost_sec: event.cost_sec,
              parent_node: event.parent_node,
              react_round: event.react_round,
            } as any)
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
  try {
    const resp = await fetch('/api/chat/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params, chat_id: currentChatId.value, config: { configurable: { thread_id: `admin:${store.currentSessionId}` } } }),
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
        if (event.type === 'progress' || event.type === 'thought' || event.type === 'tool' || event.type === 'retrieval') {
          store.upsertStepForMessage(aiIdx, {
            step: event.name, name: event.name, status: event.status, cost_ms: event.cost_ms,
            intent: event.intent, detail: event.detail, parent_node: event.parent_node,
            react_round: event.react_round,
          } as any)
        } else if (event.type === 'token') {
          aiContent += event.content; const msg = store.messages[aiIdx]; if (msg) msg.content = aiContent
        } else if (event.type === 'interrupt') {
          // 递归处理下一个中断
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
  } finally {
    store.isStreaming = false
  }
}
          } else if (event.type === 'done') {
            // 流结束，finally 块统一收尾
          } else if (event.type === 'result') {
            currentChatId.value = event.chat_id || ''
          } else if (event.type === 'error') {
            store.upsertStepForMessage(aiIdx, { step: `错误: ${event.content || event.name}`, name: '错误', status: 'fail' })
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  } catch (e: any) {
    store.upsertStepForMessage(aiIdx, { step: `连接失败: ${e.message}`, status: 'fail' })
  } finally {
    store.isStreaming = false
    const msg = store.messages[aiIdx]
    if (msg) {
      // 将所有仍为 running 的步骤统一标记为 completed
      if (msg.steps) {
        for (const s of msg.steps) {
          if (s.status === 'running') s.status = 'completed'
        }
      }
      if (!msg.content) {
        msg.content = '（未收到有效回复）'
      }
    }
  }
}
</script>

<template>
  <div class="chat-view">
    <SessionList />
    <div class="chat-center">
      <div class="chat-center-inner">
        <ChatWindow ref="chatWindowRef" />
        <ChatInput @send="handleSend" />
      </div>
    </div>
    <RightPanel />
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
}

.chat-center-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}
</style>
