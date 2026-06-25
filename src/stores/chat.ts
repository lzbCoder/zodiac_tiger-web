import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue'
import {
  getSessionList,
  deleteSession as deleteSessionApi,
  renameSession as renameSessionApi,
  pinSession as pinSessionApi,
} from '@/api/chat'

/** 工具调用附属条目（🔧），挂在子步骤下，可折叠展开看入参/返回 JSON */
export interface ToolItem {
  tool_name?: string
  tool_run_id?: string   // 每次调用唯一，支持同名工具并行各占一条
  tool_args?: string
  tool_result?: string
  status: string
  cost_ms?: number
  _show?: boolean
}

/** LLM 思考附属条目（🧠），挂在子步骤下，支持折叠 */
export interface ThinkingItem {
  content: string
  status: string
  cost_ms?: number
  _show?: boolean   // undefined / true = 展开；false = 折叠
}

/**
 * 扁平时间线步骤：主阶段(stage) 与子步骤(substep) 共享同一左边界，仅靠图标区分。
 * 工具调用 / LLM 思考 / 详情 作为附属子项挂在步骤下方。
 */
export interface AgentStep {
  step: string
  name?: string
  kind?: 'stage' | 'substep'
  status: 'running' | 'completed' | 'fail' | 'error' | 'pending' | 'in_progress' | 'terminated'
  intent?: string
  cost_ms?: number
  detail?: string
  attempt?: number              // 节点执行次数（含首次），>1 表示发生过重试
  react_round?: number          // 仅用于去重区分 ReAct 各轮，不展示
  thinking?: ThinkingItem
  tools?: ToolItem[]
  _key?: string
  _showDetail?: boolean
  _collapsed?: boolean          // stage 节点折叠状态；undefined / false = 展开
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
  pinned: boolean
}

/** 前端内置的"最终 AI 回复"可选模型（均为阿里百炼模型，仅切换名称） */
export const REPLY_MODELS = ['qwen3.7-max', 'qwen3.6-flash', 'deepseek-v4-pro'] as const
export const DEFAULT_REPLY_MODEL = 'qwen3.7-max'

/** 推理型模型：思考恒开、无法关闭，必须展示思维链 */
export const REASONING_MODELS = ['deepseek-v4-pro'] as const
const REPLY_MODEL_STORAGE_KEY = 'reply-model'
const SHOW_REASONING_STORAGE_KEY = 'show-reasoning'

/** 最终回复节点的显示名集合：其思维链只展示在主页面气泡，不在执行流程时间线重复 */
export const REPLY_NODE_NAMES = ['回答生成', '对话聊天', '行程生成', '行程精修'] as const

// ---- 扁平时间线：事件 → 步骤 的统一应用逻辑（流式 + 历史回显共用）----

function _normStatus(st: string): AgentStep['status'] {
  return (st === 'done' ? 'completed' : st) as AgentStep['status']
}

function _stepKey(name: string, reactRound?: number): string {
  return `${name}|${reactRound ?? ''}`
}

function _findStep(steps: AgentStep[], name: string, reactRound?: number): AgentStep | undefined {
  const key = _stepKey(name, reactRound)
  return steps.find((s) => s._key === key)
}

/** 找到附属项应挂载的步骤，缺失时按 substep 兜底创建 */
function _ensureStep(steps: AgentStep[], name: string, reactRound?: number): AgentStep {
  let s = _findStep(steps, name, reactRound)
  if (!s) {
    s = { step: name, name, kind: 'substep', status: 'running', react_round: reactRound, _key: _stepKey(name, reactRound) }
    steps.push(s)
  }
  return s
}

/**
 * 把一个事件（SSE 的 type 或历史的 event_type）应用到扁平 steps 数组上。
 * 直接 mutate steps，保证 Vue 响应式（对象引用稳定）。
 */
function applyEvent(steps: AgentStep[], ev: any) {
  const et: string = ev.event_type || ev.type
  if (!et) return

  // ---- 节点进度：主阶段 / 子步骤 ----
  if (et === 'progress' || et === 'step' || et === 'retrieval') {
    const name: string = ev.name || ev.step
    if (!name) return
    const rnd: number | undefined = ev.react_round
    const key = _stepKey(name, rnd)
    const patch: Partial<AgentStep> = {
      step: name, name,
      kind: ev.node_kind === 'substep' ? 'substep' : 'stage',
      status: _normStatus(ev.status),
      react_round: rnd,
      _key: key,
    }
    if (ev.cost_ms) patch.cost_ms = ev.cost_ms
    if (ev.intent) patch.intent = ev.intent
    if (ev.detail) patch.detail = ev.detail
    const existing = steps.find((s) => s._key === key)
    if (existing) {
      // 重试时同名同轮事件合并，attempt 取最大（保留重试次数）
      const attempt = Math.max(existing.attempt || 0, ev.attempt || 0)
      Object.assign(existing, patch, { cost_ms: Math.max(existing.cost_ms || 0, ev.cost_ms || 0) })
      if (attempt) existing.attempt = attempt
    } else {
      if (ev.attempt) patch.attempt = ev.attempt
      steps.push(patch as AgentStep)
    }
    return
  }

  // ---- LLM 思考条目（🧠）----
  if (et === 'thinking' || et === 'thinking_token') {
    const attach: string = ev.attach_to || ev.name
    if (!attach) return
    const target = _ensureStep(steps, attach, ev.react_round)
    if (!target.thinking) target.thinking = { content: '', status: 'running' }
    if (et === 'thinking_token') {
      target.thinking.content += ev.content || ''
      target.thinking.status = 'running'
    } else if (ev.status === 'completed' || ev.status === 'done') {
      if (ev.content) target.thinking.content = ev.content   // 完成时以完整内容为准（流式原文）
      target.thinking.status = 'completed'
      if (ev.cost_ms) target.thinking.cost_ms = ev.cost_ms
    } else {
      target.thinking.status = 'running'
    }
    return
  }

  // ---- 工具调用条目（🔧）----
  if (et === 'tool') {
    const attach: string = ev.attach_to || ev.parent_node
    const toolName: string = ev.tool_name || ev.name
    if (!attach || !toolName) return
    const target = _ensureStep(steps, attach, ev.react_round)
    if (!target.tools) target.tools = []
    // 去重键：优先 tool_run_id（同名并行各占一条），回退 tool_name
    const runId: string = ev.tool_run_id || ''
    const ti = runId
      ? target.tools.findIndex((t) => t.tool_run_id === runId)
      : target.tools.findIndex((t) => t.tool_name === toolName && !t.tool_run_id)
    const patch: Partial<ToolItem> = { tool_name: toolName, status: _normStatus(ev.status) }
    if (runId) patch.tool_run_id = runId
    if (ev.tool_args !== undefined) patch.tool_args = ev.tool_args
    if (ev.tool_result !== undefined) patch.tool_result = ev.tool_result
    if (ev.cost_ms) patch.cost_ms = ev.cost_ms
    if (ti >= 0) Object.assign(target.tools[ti], patch, { cost_ms: Math.max(target.tools[ti].cost_ms || 0, ev.cost_ms || 0) })
    else target.tools.push({ status: 'running', ...patch } as ToolItem)
    return
  }
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

  /** 用户选择的"最终 AI 回复"模型，localStorage 持久化，默认 qwen3.7-max */
  const _storedModel = localStorage.getItem(REPLY_MODEL_STORAGE_KEY)
  const replyModel = ref(
    _storedModel && (REPLY_MODELS as readonly string[]).includes(_storedModel)
      ? _storedModel
      : DEFAULT_REPLY_MODEL,
  )

  function setReplyModel(model: string) {
    replyModel.value = model
    localStorage.setItem(REPLY_MODEL_STORAGE_KEY, model)
  }

  /** 是否对最终回复显示思维链（模型推理开关 + 推理过程上屏），localStorage 持久化，默认关 */
  const showReasoning = ref(localStorage.getItem(SHOW_REASONING_STORAGE_KEY) === '1')

  function setShowReasoning(v: boolean) {
    showReasoning.value = v
    localStorage.setItem(SHOW_REASONING_STORAGE_KEY, v ? '1' : '0')
  }

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
        pinned: !!s.pinned,
      }))
    } catch {
      // silently fail if backend unreachable
    }
  }

  async function removeSession(id: string) {
    // 等待后端真正删除完成（失败时由拦截器提示并 reject，交给调用方处理）
    await deleteSessionApi(id)
    // 删除已确认成功，直接从本地列表移除该会话——确定性操作，
    // 不依赖随后的列表重拉（避免缓存/时序导致已删会话被旧快照重新灌回）。
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (currentSessionId.value === id) {
      currentSessionId.value = ''
      messages.value = []
    }
  }

  function setSessionId(id: string) {
    currentSessionId.value = id
  }

  function addSession(session: Session) {
    sessions.value.unshift(session)
  }

  /** 仅更新本地标题（流式 result 自动命名用，不落库） */
  function updateSessionTitle(id: string, title: string) {
    const s = sessions.value.find((x) => x.id === id)
    if (s) s.title = title
  }

  /** 重命名会话：持久化到后端，成功后更新本地 */
  async function renameSession(id: string, title: string) {
    await renameSessionApi(id, title)
    const s = sessions.value.find((x) => x.id === id)
    if (s) s.title = title
  }

  /** 置顶/取消置顶：持久化后重新拉取列表以应用新排序 */
  async function togglePin(id: string) {
    const s = sessions.value.find((x) => x.id === id)
    if (!s) return
    await pinSessionApi(id, !s.pinned)
    await fetchSessions()
  }

  /** execution_events → 扁平 steps（历史回显） */
  function _eventsToSteps(execEvents: any[]): AgentStep[] {
    const steps: AgentStep[] = []
    for (const ev of execEvents) {
      applyEvent(steps, ev)
    }
    return steps
  }

  function _extractCharts(execEvents: any[]): any[] {
    return execEvents
      .filter((e: any) => e.event_type === 'chart')
      .map((e: any) => { try { return JSON.parse(e.content) } catch { return null } })
      .filter(Boolean)
  }

  function _hydrate(msg: ChatMessage) {
    const execEvents: any[] | undefined = (msg as any).execution_events
    if (execEvents && execEvents.length > 0) {
      const steps = _eventsToSteps(execEvents)
      if (steps.length > 0) msg.steps = steps
      const charts = _extractCharts(execEvents)
      if (charts.length > 0) msg.charts = charts
    }
  }

  function addMessage(msg: ChatMessage) {
    _hydrate(msg)
    messages.value.push(msg)
  }

  function setMessages(msgs: ChatMessage[]) {
    for (const m of msgs) _hydrate(m)
    messages.value = msgs
  }

  /** 流式：把单个 SSE 事件应用到指定 AI 消息的扁平 steps 上 */
  function applyAgentEvent(msgIdx: number, ev: any) {
    const msg = messages.value[msgIdx]
    if (!msg || msg.role !== 'ai') return
    if (!msg.steps) msg.steps = []
    applyEvent(msg.steps, ev)
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
    replyModel,
    setReplyModel,
    showReasoning,
    setShowReasoning,
    selectedMsgIndex,
    selectMsgIndex,
    clearSelection,
    fetchSessions,
    setSessionId,
    addSession,
    updateSessionTitle,
    renameSession,
    togglePin,
    removeSession,
    addMessage,
    setMessages,
    applyAgentEvent,
    lastAiMsgIndex,
    resetChat,
  }
})

// 开发期 HMR：store 模块热更新时原地替换，避免组件持有旧实例导致状态不同步
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot))
}
