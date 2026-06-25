<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Refresh, Tools, Connection, Delete } from '@element-plus/icons-vue'
import GlassCard from '@/components/common/GlassCard.vue'
import NeonButton from '@/components/common/NeonButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  getMcpServerList, saveMcpServer, deleteMcpServer, toggleMcpStatus,
  testMcpConnect, syncMcpTools, getMcpTools, toggleToolAllow,
  getMcpAgentBind, updateMcpAgentBind,
  type McpServer, type McpTool,
} from '@/api/mcp_server'
import { AGENT_BIND_OPTIONS as AGENT_OPTIONS } from '@/constants/agents'

// ==================== 主列表 ====================
const servers = ref<McpServer[]>([])
const loading = ref(false)

const stats = computed(() => ({
  total: servers.value.length,
  online: servers.value.filter((s) => s.connect_status === 1).length,
  enabled: servers.value.filter((s) => s.enable_status === 1).length,
}))

async function fetchList() {
  loading.value = true
  try {
    const res: any = await getMcpServerList()
    servers.value = res.data || []
  } finally {
    loading.value = false
  }
}

// ==================== 弹窗 1：新增 / 编辑 ====================
const editVisible = ref(false)
const editLoading = ref(false)
const testResult = ref<{ ok: boolean; message: string; tool_count: number } | null>(null)
const isEditMode = ref(false)

const editForm = ref({
  mcp_key: '',
  display_name: '',
  endpoint_url: '',
  transport_type: 'streamable_http' as 'streamable_http' | 'sse',
  auth_type: 'none' as 'none' | 'bearer',
  bearer_token: '',
  remark: '',
})

// 根据表单构建实际请求头
function buildAuthHeaders(): Record<string, string> {
  if (editForm.value.auth_type === 'bearer' && editForm.value.bearer_token.trim()) {
    return { Authorization: `Bearer ${editForm.value.bearer_token.trim()}` }
  }
  return {}
}

// 测试连接按钮是否可用
const canTest = computed(() => {
  const f = editForm.value
  if (!f.mcp_key.trim() || !f.display_name.trim() || !f.endpoint_url.trim()) return false
  if (f.auth_type === 'bearer' && !f.bearer_token.trim()) return false
  return true
})

function handleNew() {
  isEditMode.value = false
  editForm.value = { mcp_key: '', display_name: '', endpoint_url: '', transport_type: 'streamable_http', auth_type: 'none', bearer_token: '', remark: '' }
  testResult.value = null
  editVisible.value = true
}

function handleEdit(row: McpServer) {
  isEditMode.value = true
  // 从已存储的 auth_headers 中反推 auth_type / bearer_token
  const headers = row.auth_headers || {}
  let auth_type: 'none' | 'bearer' = 'none'
  let bearer_token = ''
  if (typeof headers.Authorization === 'string' && headers.Authorization.startsWith('Bearer ')) {
    auth_type = 'bearer'
    bearer_token = headers.Authorization.slice(7)
  }
  editForm.value = {
    mcp_key: row.mcp_key,
    display_name: row.display_name,
    endpoint_url: row.endpoint_url,
    transport_type: (row.transport_type as 'streamable_http' | 'sse') || 'streamable_http',
    auth_type,
    bearer_token,
    remark: row.remark || '',
  }
  testResult.value = null
  editVisible.value = true
}

async function handleTestConnect() {
  if (!canTest.value) return
  editLoading.value = true
  const isSSE = editForm.value.transport_type === 'sse'
  if (isSSE) {
    ElMessage.info('SSE 协议初始化可能需要 1~3 分钟，请耐心等待…')
  }
  try {
    // SSE 端点冷启动耗时较长（实测约 154 秒），需要更长的请求超时
    const res: any = await testMcpConnect(
      {
        endpoint_url: editForm.value.endpoint_url,
        auth_headers: buildAuthHeaders(),
        transport_type: editForm.value.transport_type,
        mcp_key: editForm.value.mcp_key,  // 已存服务传 key 复用预热连接；新服务为空串
      },
      { timeout: isSSE ? 420000 : 60000 },
    )
    testResult.value = res.data
    if (res.data.ok) {
      ElMessage.success(`连接成功，发现 ${res.data.tool_count} 个工具`)
    } else {
      ElMessage.error(`连接失败：${res.data.message}`)
    }
  } finally {
    editLoading.value = false
  }
}

async function handleSave() {
  const f = editForm.value
  if (!f.mcp_key.trim()) { ElMessage.warning('请填写【服务唯一编码】'); return }
  if (!f.display_name.trim()) { ElMessage.warning('请填写【展示名称】'); return }
  if (!f.endpoint_url.trim()) { ElMessage.warning('请填写【HTTP 地址】'); return }
  if (f.auth_type === 'bearer' && !f.bearer_token.trim()) { ElMessage.warning('请输入 Bearer Token'); return }

  editLoading.value = true
  try {
    await saveMcpServer({
      mcp_key: f.mcp_key.trim(),
      display_name: f.display_name.trim(),
      endpoint_url: f.endpoint_url.trim(),
      auth_headers: buildAuthHeaders(),
      transport_type: f.transport_type,
      remark: f.remark.trim() || undefined,
    })
    ElMessage.success('保存成功，工具已自动同步')
    editVisible.value = false
    fetchList()
  } finally {
    editLoading.value = false
  }
}

async function handleDelete(mcp_key: string) {
  await ElMessageBox.confirm('删除将同时清除工具列表和 Agent 绑定关系，确认删除？', '提示', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })
  await deleteMcpServer(mcp_key)
  ElMessage.success('已删除')
  fetchList()
}

async function handleToggleStatus(row: McpServer) {
  const newStatus = row.enable_status === 1 ? 0 : 1
  await toggleMcpStatus({ mcp_key: row.mcp_key, enable_status: newStatus })
  fetchList()
}

async function handleTestRow(row: McpServer) {
  loading.value = true
  const isSSE = row.transport_type === 'sse'
  if (isSSE) {
    ElMessage.info('SSE 协议初始化可能需要 1~3 分钟，请耐心等待…')
  }
  try {
    const res: any = await testMcpConnect(
      {
        endpoint_url: row.endpoint_url,
        auth_headers: row.auth_headers || {},
        transport_type: row.transport_type || 'streamable_http',
        mcp_key: row.mcp_key,  // 传 key：后端回写 connect_status / last_check_time
      },
      { timeout: isSSE ? 200000 : 60000 },
    )
    if (res.data.ok) {
      ElMessage.success(`连接正常，${res.data.tool_count} 个工具`)
    } else {
      ElMessage.error(`连接异常：${res.data.message}`)
    }
    fetchList()
  } finally {
    loading.value = false
  }
}

// ==================== 弹窗 2：查看工具 ====================
const toolVisible = ref(false)
const toolLoading = ref(false)
const currentMcpKey = ref('')
const tools = ref<McpTool[]>([])
const expandedSchemas = ref<Set<string>>(new Set())

async function handleViewTools(row: McpServer) {
  currentMcpKey.value = row.mcp_key
  toolVisible.value = true
  toolLoading.value = true
  try {
    const res: any = await getMcpTools(row.mcp_key)
    tools.value = res.data || []
  } finally {
    toolLoading.value = false
  }
}

async function handleSyncTools() {
  toolLoading.value = true
  try {
    const res: any = await syncMcpTools(currentMcpKey.value)
    ElMessage.success(res.message || '同步完成')
    const res2: any = await getMcpTools(currentMcpKey.value)
    tools.value = res2.data || []
    fetchList()
  } finally {
    toolLoading.value = false
  }
}

async function handleToolAllow(tool: McpTool, val: boolean) {
  await toggleToolAllow({ mcp_key: tool.mcp_key, tool_name: tool.tool_name, is_allow: val ? 1 : 0 })
  tool.is_allow = val ? 1 : 0
}

function toggleSchema(toolName: string) {
  if (expandedSchemas.value.has(toolName)) {
    expandedSchemas.value.delete(toolName)
  } else {
    expandedSchemas.value.add(toolName)
  }
}

// ==================== 弹窗 3：绑定 Agent ====================
const bindVisible = ref(false)
const bindLoading = ref(false)
const bindMcpKey = ref('')
const selectedAgents = ref<string[]>([])

async function handleBindAgent(row: McpServer) {
  bindMcpKey.value = row.mcp_key
  bindVisible.value = true
  bindLoading.value = true
  try {
    const res: any = await getMcpAgentBind(row.mcp_key)
    selectedAgents.value = res.data || []
  } finally {
    bindLoading.value = false
  }
}

async function handleSaveBind() {
  bindLoading.value = true
  try {
    await updateMcpAgentBind({ mcp_key: bindMcpKey.value, agent_codes: selectedAgents.value })
    ElMessage.success('绑定关系已更新')
    bindVisible.value = false
  } finally {
    bindLoading.value = false
  }
}

// 连接状态映射
const STATUS_KEY: Record<number, string> = { 0: 'pending', 1: 'online', 2: 'error' }
const STATUS_SHORT: Record<number, string> = { 0: '未检测', 1: '在线', 2: '异常' }
const STATUS_COLOR: Record<number, string> = { 0: '#666', 1: '#00ff88', 2: '#ff4d4f' }
const STATUS_TIP: Record<number, string> = {
  0: '尚未执行连通性检测',
  1: '服务连接正常，可正常调用工具',
  2: '连接失败，可点击「测试连接」重新检测',
}
function connectStatusKey(status: number) { return STATUS_KEY[status] ?? 'pending' }
function connectStatusShort(status: number) { return STATUS_SHORT[status] ?? '未知' }
function connectStatusColor(status: number) { return STATUS_COLOR[status] ?? '#666' }
function connectStatusTip(status: number) { return STATUS_TIP[status] ?? '' }

onMounted(fetchList)
</script>

<template>
  <div class="mcp-view">
    <!-- 顶部标题 + 操作栏 -->
    <GlassCard>
      <div class="view-header">
        <h2 class="text-glow-cyan">MCP 服务管理</h2>
        <NeonButton @click="handleNew">+ 新增 MCP 服务</NeonButton>
      </div>
    </GlassCard>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item glass-card">
        <span class="stat-num text-glow-cyan">{{ stats.total }}</span>
        <span class="stat-label">总服务数</span>
      </div>
      <div class="stat-item glass-card">
        <span class="stat-num" style="color: #00ff88">{{ stats.online }}</span>
        <span class="stat-label">在线正常</span>
      </div>
      <div class="stat-item glass-card">
        <span class="stat-num text-glow-purple">{{ stats.enabled }}</span>
        <span class="stat-label">已启用</span>
      </div>
    </div>

    <!-- 主列表 -->
    <GlassCard>
      <el-table v-loading="loading" :data="servers" class="mcp-table">
        <el-table-column prop="mcp_key" label="服务编码" width="150" />
        <el-table-column prop="display_name" label="展示名称" width="160" />
        <el-table-column label="接入地址" width="520">
          <template #default="{ row }">
            <el-tooltip :content="row.endpoint_url" placement="top" :show-after="400" popper-class="desc-tooltip">
              <span class="url-cell">{{ row.endpoint_url }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="连接状态" width="150">
          <template #default="{ row }">
            <el-tooltip :content="connectStatusTip(row.connect_status)" placement="top" :show-after="200" popper-class="desc-tooltip">
              <div class="status-cell" :class="{ 'is-disabled': row.enable_status === 0 }">
                <span class="status-dot" :class="`status-dot--${connectStatusKey(row.connect_status)}`" />
                <span class="status-text" :style="{ color: connectStatusColor(row.connect_status) }">
                  {{ connectStatusShort(row.connect_status) }}
                </span>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="100" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enable_status === 1" @change="handleToggleStatus(row)" />
          </template>
        </el-table-column>
        <el-table-column label="最后检测" width="255" align="center">
          <template #default="{ row }">
            <span class="time-cell">{{ row.last_check_time ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="150" align="center">
          <template #default="{ row }">
            <div class="action-icons">
              <el-tooltip content="编辑配置" placement="top" :show-after="300">
                <el-button size="small" text :icon="Edit" @click="handleEdit(row)" />
              </el-tooltip>
              <el-tooltip content="测试连接" placement="top" :show-after="300">
                <el-button size="small" text :icon="Refresh" @click="handleTestRow(row)" />
              </el-tooltip>
              <el-tooltip content="查看工具列表" placement="top" :show-after="300">
                <el-button size="small" text :icon="Tools" @click="handleViewTools(row)" />
              </el-tooltip>
              <el-tooltip content="绑定到 Agent" placement="top" :show-after="300">
                <el-button size="small" text :icon="Connection" @click="handleBindAgent(row)" />
              </el-tooltip>
              <el-tooltip content="删除" placement="top" :show-after="300">
                <el-button size="small" text type="danger" :icon="Delete" @click="handleDelete(row.mcp_key)" />
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <EmptyState v-if="!loading && servers.length === 0" text="暂无 MCP 服务，点击「新增 MCP 服务」开始接入" />
    </GlassCard>

    <!-- 弹窗 1：新增 / 编辑 MCP 服务 -->
    <el-dialog
      :model-value="editVisible"
      :title="isEditMode ? '编辑 MCP 服务' : '新增 MCP 服务'"
      width="580px"
      @close="editVisible = false"
    >
      <el-form label-position="top" :model="editForm" class="edit-form">
        <el-form-item>
          <template #label>
            <span class="form-label">服务唯一编码 <span class="required-mark">*</span></span>
          </template>
          <el-input
            v-model="editForm.mcp_key"
            placeholder="如：amap-mcp（英文，全局唯一）"
            :disabled="isEditMode"
          />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="form-label">展示名称 <span class="required-mark">*</span></span>
          </template>
          <el-input v-model="editForm.display_name" placeholder="如：高德地图 MCP" />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="form-label">传输协议 <span class="required-mark">*</span></span>
          </template>
          <el-select v-model="editForm.transport_type" style="width: 100%">
            <el-option label="Streamable HTTP" value="streamable_http" />
            <el-option label="SSE（Server-Sent Events）" value="sse" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="form-label">服务地址 <span class="required-mark">*</span></span>
            <span class="form-label-hint">{{ editForm.transport_type === 'sse' ? 'SSE 协议' : 'Streamable HTTP 协议' }}</span>
          </template>
          <el-input v-model="editForm.endpoint_url" placeholder="https://mcp.example.com/mcp" />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="form-label">鉴权方式 <span class="required-mark">*</span></span>
          </template>
          <el-select v-model="editForm.auth_type" style="width: 100%">
            <el-option label="无需鉴权" value="none" />
            <el-option label="Bearer Token" value="bearer" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="editForm.auth_type === 'bearer'" class="token-item">
          <template #label>
            <span class="form-label">Token <span class="required-mark">*</span></span>
            <span class="form-label-hint">无需手动加 Bearer 前缀，系统自动拼接</span>
          </template>
          <el-input
            v-model="editForm.bearer_token"
            type="password"
            show-password
            placeholder="请输入 Bearer Token"
          />
        </el-form-item>

        <el-form-item>
          <template #label><span class="form-label">备注</span></template>
          <el-input v-model="editForm.remark" placeholder="可选" />
        </el-form-item>

        <div v-if="testResult" class="test-result" :class="testResult.ok ? 'result-ok' : 'result-fail'">
          <span>{{ testResult.ok ? `✓ 连接成功，发现 ${testResult.tool_count} 个工具` : `✗ ${testResult.message}` }}</span>
        </div>
      </el-form>

      <template #footer>
        <el-button
          :loading="editLoading"
          :disabled="!canTest"
          @click="handleTestConnect"
        >
          测试连接
        </el-button>
        <el-button type="primary" :loading="editLoading" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 2：查看工具 -->
    <el-dialog
      :model-value="toolVisible"
      :title="`工具列表 — ${currentMcpKey}`"
      width="800px"
      @close="toolVisible = false"
    >
      <div class="tool-header">
        <span class="tool-count">共 {{ tools.length }} 个工具</span>
        <el-button size="small" :loading="toolLoading" @click="handleSyncTools">刷新工具</el-button>
      </div>
      <el-table v-loading="toolLoading" :data="tools" size="small">
        <el-table-column prop="tool_name" label="工具名称" width="180" />
        <el-table-column label="描述" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.tool_desc || ''" placement="top" :show-after="200" popper-class="desc-tooltip" :disabled="!row.tool_desc">
              <span class="desc-cell">{{ row.tool_desc || '—' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="入参 Schema" min-width="160">
          <template #default="{ row }">
            <template v-if="row.input_schema">
              <el-button size="small" text @click="toggleSchema(row.tool_name)">
                {{ expandedSchemas.has(row.tool_name) ? '收起' : '展开' }}
              </el-button>
              <pre v-if="expandedSchemas.has(row.tool_name)" class="schema-pre">{{ row.input_schema }}</pre>
            </template>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-switch
              :model-value="row.is_allow === 1"
              @change="(val: boolean) => handleToolAllow(row, val)"
            />
          </template>
        </el-table-column>
      </el-table>
      <EmptyState v-if="!toolLoading && tools.length === 0" text="暂无工具，请点击「刷新工具」同步" />
    </el-dialog>

    <!-- 弹窗 3：绑定 Agent -->
    <el-dialog
      :model-value="bindVisible"
      :title="`绑定 Agent — ${bindMcpKey}`"
      width="480px"
      @close="bindVisible = false"
    >
      <div class="bind-desc">勾选允许使用该 MCP 服务工具的 Agent（仅综合助手支持；通用闲聊、旅游规划不支持）</div>
      <div v-loading="bindLoading" class="agent-list">
        <div v-for="opt in AGENT_OPTIONS" :key="opt.code" class="agent-item">
          <el-checkbox
            v-model="selectedAgents"
            :value="opt.code"
            :disabled="opt.disabled"
            :label="opt.label"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :loading="bindLoading" @click="handleSaveBind">保存绑定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mcp-view {
  height: 100%;
  overflow-y: auto;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    font-size: 20px;  }
}

.stats-row {
  display: flex;
  gap: 16px;
  margin: 16px 0;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 20px;
}

.stat-num {
  font-size: 32px;
  font-weight: 700;
  font-family: 'Orbitron', monospace;
  display: block;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.mcp-table {
  background: transparent;
  :deep(.el-table__header-wrapper th) {
    background: rgba(var(--color-primary-rgb), 0.05);
  }
}

.time-cell {
  white-space: nowrap;
  color: var(--text-secondary);
}

.url-cell {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  cursor: default;
}

.status-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.2s;

  &.is-disabled {
    opacity: 0.35;
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--online {
    background: #00ff88;
    box-shadow: 0 0 6px rgba(0, 255, 136, 0.55);
  }

  &--error {
    background: #ff4d4f;
    box-shadow: 0 0 6px rgba(255, 77, 79, 0.55);
  }

  &--pending {
    background: #555;
  }
}

.status-text {
  font-size: 14px;
  font-weight: 500;
}

.action-icons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;

  .el-button {
    padding: 4px;
    font-size: 15px;
  }
}

.edit-form {
  :deep(.el-form-item__label) {
    padding-bottom: 6px;
    line-height: 1;
  }
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }
}

.form-label {
  font-size: 14px;
  color: #ccc;
}

.form-label-hint {
  font-size: 12px;
  color: #666;
  margin-left: 6px;
}

.required-mark {
  color: #ff4d4f;
  margin-left: 2px;
}

.token-item {
  :deep(.el-form-item__label) {
    padding-bottom: 4px;
  }
}

.test-result {
  margin-top: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;

  &.result-ok {
    background: rgba(0, 255, 136, 0.08);
    border: 1px solid rgba(0, 255, 136, 0.25);
    color: #00ff88;
  }

  &.result-fail {
    background: rgba(255, 77, 79, 0.08);
    border: 1px solid rgba(255, 77, 79, 0.25);
    color: #ff4d4f;
  }
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tool-count {
  font-size: 14px;
  color: #888;
}

.schema-pre {
  font-size: 12px;
  background: var(--bg-code);
  border: 1px solid rgba(var(--color-primary-rgb), 0.15);
  border-radius: 4px;
  padding: 8px;
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  color: #ccc;
}

.text-muted {
  color: #555;
}

.desc-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bind-desc {
  font-size: 14px;
  color: #888;
  margin-bottom: 16px;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 80px;
}

.agent-item {
  padding: 8px 12px;
  background: rgba(var(--color-primary-rgb), 0.04);
  border: 1px solid rgba(var(--color-primary-rgb), 0.1);
  border-radius: 6px;
}
</style>

<style lang="scss">
.desc-tooltip.el-popper {
  max-width: 320px !important;
  background: var(--bg-dialog) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-glow) !important;
  white-space: normal !important;
  word-break: break-word !important;
  line-height: 1.7 !important;
  font-size: 14px !important;

  .el-popper__arrow::before {
    background: var(--bg-dialog) !important;
    border-color: var(--border-glow) !important;
  }
}
</style>
