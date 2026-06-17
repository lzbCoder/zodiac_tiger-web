<script setup lang="ts">
import { onMounted, ref } from 'vue'
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

  const ctrl = new AbortController()
  abortCtrl.value = ctrl
  let wasAborted = false

  try {
    const resp = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
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
          } else if (event.type === 'plan') {
            store.upsertPlanForMessage(aiIdx, event.steps, event.parent_node)
          } else if (event.type === 'token') {
            if (event.name === 'assistant_answer_generator') {
              aiContent += event.content
              const msg = store.messages[aiIdx]
              if (msg) msg.content = aiContent
            }
          } else if (event.type === 'plan_step_detail') {
            // 将 planner 的思考内容实时追加到当前 in_progress 计划步骤的 detail 中
            const msg = store.messages[aiIdx]
            if (msg?.steps) {
              for (const s of msg.steps) {
                const planStep = s.children?.find(c => (c.name || c.step) === '📋 执行计划')
                if (planStep?.children) {
                  for (const pc of planStep.children) {
                    if (pc.status === 'in_progress') {
                      if (!pc.detail) pc.detail = ''
                      pc.detail += event.content
                      pc._showDetail = true  // 自动展开详情
                      break
                    }
                  }
                }
              }
            }
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
        } else if (event.type === 'plan') {
          store.upsertPlanForMessage(aiIdx, event.steps)
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
            // 实时更新左侧会话列表标题
            if (event.session_title) {
              store.updateSessionTitle(store.currentSessionId, event.session_title)
            }
          } else if (event.type === 'error') {
            store.upsertStepForMessage(aiIdx, { step: `错误: ${event.content || event.name}`, name: '错误', status: 'fail' })
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
      store.upsertStepForMessage(aiIdx, { step: `连接失败: ${e.message}`, status: 'fail' })
    }
  } finally {
    store.isStreaming = false
    abortCtrl.value = null
    const msg = store.messages[aiIdx]
    if (msg) {
      if (msg.steps) {
        for (const s of msg.steps) {
          if (s.status === 'running' || s.status === 'in_progress') {
            s.status = wasAborted ? 'terminated' : 'completed'
          }
        }
      }
      if (!msg.content) {
        msg.content = wasAborted ? '（任务已被手动终止）' : '（任务执行中，请稍后）'
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
