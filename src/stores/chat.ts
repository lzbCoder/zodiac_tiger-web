import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSessionList, deleteSession as deleteSessionApi } from '@/api/chat'

export interface AgentStep {
  step: string
  name?: string
  status: 'running' | 'completed' | 'fail' | 'error' | 'pending' | 'in_progress' | 'terminated'
  intent?: string
  skills_count?: number
  cost_ms?: number
  detail?: string
  tool_args?: string
  cost_sec?: number
  children?: AgentStep[]
  _showTools?: boolean
  _showDetail?: boolean
}

export interface ChatMessage {
  role: 'user' | 'ai' | 'system'
  content: string
  charts?: any[]
  chatId?: string
  steps?: AgentStep[]
}

export interface Session {
  id: string
  title: string
  lastTime: string
  createTime: string
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<Session[]>([])
  const currentSessionId = ref('')
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const jumpToMsgIndex = ref<number | null>(null)
  /** 预填输入框文本（快捷按钮/能力弹窗设置，ChatInput watch 并消费） */
  const prefillText = ref('')
  /** 新建会话能力选择弹窗 */
  const showNewSessionDialog = ref(false)

  function setPrefill(text: string) {
    prefillText.value = text
  }

  /** 用户手动选中的消息索引，null 表示自动跟随最新 */
  const selectedMsgIndex = ref<number | null>(null)

  function triggerJump(msgIndex: number) {
    jumpToMsgIndex.value = msgIndex
  }

  function selectMsgIndex(idx: number) {
    selectedMsgIndex.value = idx
  }

  function clearSelection() {
    selectedMsgIndex.value = null
  }

  async function fetchSessions() {
    try {
      const res = await getSessionList()
      sessions.value = ((res as any).data || []).map((s: any) => ({
        id: s.session_id,
        title: s.title,
        lastTime: s.last_time,
        createTime: s.create_time,
      }))
    } catch {
      // silently fail if backend unreachable
    }
  }

  async function removeSession(id: string) {
    try {
      await deleteSessionApi(id)
      sessions.value = sessions.value.filter((s) => s.id !== id)
      if (currentSessionId.value === id) {
        currentSessionId.value = ''
        messages.value = []
      }
    } catch {
      // silently fail
    }
  }

  function setSessionId(id: string) {
    currentSessionId.value = id
  }

  function addSession(session: Session) {
    sessions.value.unshift(session)
  }

  function updateSessionTitle(id: string, title: string) {
    const s = sessions.value.find((x) => x.id === id)
    if (s) s.title = title
  }

  /** plan 步骤（pending/in_progress/done）→ AgentStep 子项 */
  const PLAN_KEY = '📋 执行计划'
  function _makePlanChildren(rawSteps: any[]): AgentStep[] {
    return rawSteps.map((s: any) => {
      const idx = s.index ?? 0
      const label = s.description || s.step || `步骤 ${idx + 1}`
      const child: AgentStep = {
        step: `${idx + 1}. ${label}`,
        name: `${idx + 1}. ${label}`,
        _planIndex: idx,
        status: s.status === 'done' ? 'completed' : s.status, // pending | in_progress | completed
      }
      if (s.detail) {
        child.detail = s.detail
        child._showDetail = true  // 有详情即展开，状态切换后保留
      }
      // 执行中的步骤默认展开详情（即使 detail 还没来）
      if (s.status === 'in_progress' && !child._showDetail) {
        child._showDetail = true
      }
      return child
    }) as AgentStep[]
  }

  /** 将一份计划清单 upsert 进给定 steps 数组（流式与历史还原共用） */
  function _upsertPlanInto(stepsArr: AgentStep[], rawSteps: any[], parentName?: string, allSteps?: AgentStep[]) {
    // 如果有父节点名，将计划挂到父节点的 children 下
    if (parentName && allSteps) {
      const parent = _findStep(allSteps, parentName)
      if (parent) {
        if (!parent.children) parent.children = []
        // 执行期间自动展开父节点（如"智能助手"）的子流程
        if (!parent._showTools) parent._showTools = true
        stepsArr = parent.children
      }
    }
    const allDone = rawSteps.every((s: any) => s.status === 'done')
    const planStep: any = {
      step: PLAN_KEY, name: PLAN_KEY,
      status: allDone ? 'completed' : 'running',
      children: _makePlanChildren(rawSteps),
      _showTools: true,
    }
    const idx = stepsArr.findIndex((s) => (s.name || s.step) === PLAN_KEY)
    if (idx >= 0) stepsArr[idx] = { ...stepsArr[idx], ...planStep }
    else stepsArr.push(planStep)
  }

  /** execution_events → steps */
  function _eventsToSteps(execEvents: any[]): AgentStep[] {
    const steps: AgentStep[] = []
    for (const ev of execEvents) {
      if (ev.event_type === 'plan' && Array.isArray(ev.steps)) {
        _upsertPlanInto(steps, ev.steps, ev.parent_node, steps)
        continue
      }
      if (ev.event_type !== 'progress' && ev.event_type !== 'step' && ev.event_type !== 'tool' && ev.event_type !== 'thought' && ev.event_type !== 'retrieval') continue
      let st: string = ev.status
      if (st === 'done') st = 'completed'

      // 子步骤/tool/thought 归入父节点 children
      const parentName = ev.parent_node || ''
      if (parentName && (ev.event_type === 'tool' || ev.event_type === 'progress' || ev.event_type === 'thought')) {
        const parent = _findStep(steps, parentName)
        if (parent) {
          if (!parent.children) parent.children = []
          // 执行期间自动展开父节点的子流程
          if (!parent._showTools) parent._showTools = true
          const childKey = ev.name
          const childData: any = { step: ev.name, name: ev.name, status: st, cost_ms: ev.cost_ms, detail: ev.detail, tool_args: ev.tool_args, cost_sec: ev.cost_sec, react_round: ev.react_round }
          // 有详情内容的子项自动展开
          if (ev.detail) childData._showDetail = true

          // ReAct 轮次分组：插入中间节点
          const rnd = ev.react_round
          let targetChildren = parent.children
          if (rnd) {
            const roundKey = `第${rnd}轮ReAct循环`
            let roundNode = parent.children.find((c: any) => c.name === roundKey)
            if (!roundNode) {
              roundNode = { step: roundKey, name: roundKey, status: 'completed', children: [], _showTools: true }
              parent.children.push(roundNode)
            }
            if (!roundNode.children) roundNode.children = []
            targetChildren = roundNode.children
          }

          const ci = targetChildren.findIndex((c: any) => (c.name || c.step) === childKey)
          if (ci >= 0) {
            targetChildren[ci] = { ...targetChildren[ci], ...childData, cost_ms: Math.max(targetChildren[ci].cost_ms || 0, ev.cost_ms || 0) }
          } else {
            targetChildren.push(childData)
          }
          continue
        }
      }
      // tool 事件无父节点时跳过（不生成一级条目）
      if (ev.event_type === 'tool') continue

      const key = ev.name || ev.step
      const existing = steps.findIndex(s => (s.name || s.step) === key)
      const stepData: any = { step: key, name: key, status: st, cost_ms: ev.cost_ms, intent: ev.intent, detail: ev.detail }
      if (existing >= 0) {
        steps[existing] = { ...steps[existing], ...stepData, cost_ms: Math.max(steps[existing].cost_ms || 0, ev.cost_ms || 0) }
      } else {
        steps.push(stepData)
      }
    }
    return steps
  }

  function _extractCharts(execEvents: any[]): any[] {
    return execEvents
      .filter((e: any) => e.event_type === 'chart')
      .map((e: any) => { try { return JSON.parse(e.content) } catch { return null } })
      .filter(Boolean)
  }

  function addMessage(msg: ChatMessage) {
    const execEvents: any[] | undefined = (msg as any).execution_events
    if (execEvents && execEvents.length > 0) {
      const steps = _eventsToSteps(execEvents)
      if (steps.length > 0) msg.steps = steps
      const charts = _extractCharts(execEvents)
      if (charts.length > 0) msg.charts = charts
    }
    messages.value.push(msg)
  }

  function setMessages(msgs: ChatMessage[]) {
    for (const m of msgs) {
      const execEvents: any[] | undefined = (m as any).execution_events
      if (execEvents && execEvents.length > 0) {
        const steps = _eventsToSteps(execEvents)
        if (steps.length > 0) m.steps = steps
        const charts = _extractCharts(execEvents)
        if (charts.length > 0) m.charts = charts
      }
    }
    messages.value = msgs
  }

  /** 向指定 AI 消息追加/更新步骤（SSE 流式时使用） */
  /** 递归查找步骤（含 children） */
  function _findStep(steps: AgentStep[], name: string): AgentStep | null {
    for (const s of steps) {
      if (s.name === name) return s
      if (s.children) {
        const found = _findStep(s.children, name)
        if (found) return found
      }
    }
    return null
  }

  function upsertStepForMessage(msgIdx: number, step: AgentStep) {
    const msg = messages.value[msgIdx]
    if (!msg || msg.role !== 'ai') return
    if (!msg.steps) msg.steps = []
    // tool/子步骤归入父节点 children
    const parentNode = (step as any).parent_node
    if (parentNode) {
      const parent = _findStep(msg.steps, parentNode)
      if (parent) {
        if (!parent.children) parent.children = []
        // 执行期间自动展开父节点的子流程
        if (!parent._showTools) parent._showTools = true
        const key = step.name || step.step
        const childData: any = { step: step.step, name: step.name, status: step.status, cost_ms: (step as any).cost_ms, detail: (step as any).detail, tool_args: (step as any).tool_args, cost_sec: (step as any).cost_sec, react_round: (step as any).react_round }
        // 有详情内容的子项自动展开
        if ((step as any).detail) childData._showDetail = true

        // ReAct 轮次分组：插入中间节点
        const rnd = (step as any).react_round
        let targetChildren = parent.children
        if (rnd) {
          const roundKey = `第${rnd}轮ReAct循环`
          let roundNode = parent.children.find((c: any) => c.name === roundKey)
          if (!roundNode) {
            roundNode = { step: roundKey, name: roundKey, status: 'completed', children: [], _showTools: true }
            parent.children.push(roundNode)
          }
          if (!roundNode.children) roundNode.children = []
          targetChildren = roundNode.children
        }

        const ci = targetChildren.findIndex((c: any) => (c.name || c.step) === key)
        if (ci >= 0) {
          targetChildren[ci] = { ...targetChildren[ci], ...childData, cost_ms: Math.max(targetChildren[ci].cost_ms || 0, (step as any).cost_ms || 0) }
        } else {
          targetChildren.push(childData)
        }
        return
      }
    }
    const key = step.name || step.step
    const existing = msg.steps.findIndex((s) => (s.name || s.step) === key)
    if (existing >= 0) {
      msg.steps[existing] = { ...msg.steps[existing], ...step, cost_ms: Math.max(msg.steps[existing].cost_ms || 0, (step as any).cost_ms || 0) }
    } else {
      msg.steps.push(step)
    }
  }

  /** 写入/更新复杂任务的执行计划（SSE plan 事件 + 历史还原共用渲染结构） */
  function upsertPlanForMessage(msgIdx: number, rawSteps: any[], parentName?: string) {
    const msg = messages.value[msgIdx]
    if (!msg || msg.role !== 'ai' || !Array.isArray(rawSteps) || rawSteps.length === 0) return
    if (!msg.steps) msg.steps = []
    _upsertPlanInto(msg.steps, rawSteps, parentName, msg.steps)
  }

  /** 获取最后一条 AI 消息的 index，用于 SSE 步骤写入 */
  function lastAiMsgIndex(): number {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'ai') return i
    }
    return -1
  }

  function resetChat() {
    messages.value = []
  }

  return {
    sessions,
    currentSessionId,
    messages,
    isStreaming,
    jumpToMsgIndex,
    triggerJump,
    prefillText,
    setPrefill,
    showNewSessionDialog,
    selectedMsgIndex,
    selectMsgIndex,
    clearSelection,
    fetchSessions,
    setSessionId,
    addSession,
    updateSessionTitle,
    removeSession,
    addMessage,
    setMessages,
    upsertStepForMessage,
    upsertPlanForMessage,
    lastAiMsgIndex,
    resetChat,
  }
})
