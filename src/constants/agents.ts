/** Agent 绑定选项（技能管理 / MCP 管理共用）。
 *
 * 仅「综合助手 Agent」真正消费技能/MCP 绑定（其子图会读取
 * agent_skill_rel / agent_mcp_rel）；通用闲聊、旅游规划子图不读取绑定，故禁用。
 * 展示顺序：通用闲聊 → 旅游规划 → 综合助手。
 */
export interface AgentOption {
  code: string
  label: string
  disabled: boolean
}

export const AGENT_BIND_OPTIONS: AgentOption[] = [
  { code: 'chat_agent', label: '💬 通用闲聊 Agent', disabled: true },
  { code: 'travel_agent', label: '🗺️ 旅游规划 Agent', disabled: true },
  { code: 'assistant_agent', label: '🤖 综合助手 Agent', disabled: false },
]
