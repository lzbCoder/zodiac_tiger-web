<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getMcpList, saveMcp, testMcp, toggleMcpStatus, deleteMcp } from '@/api/mcp'
import GlassCard from '@/components/common/GlassCard.vue'
import NeonButton from '@/components/common/NeonButton.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const mcps = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingData = ref<any>(null)
const testing = ref<number | null>(null)

const form = ref({
  id: null as number | null,
  name: '',
  url: '',
  auth_type: 'none',
  api_key: '',
  timeout: 20,
  status: 1,
})

const stats = computed(() => ({
  total: mcps.value.length,
  online: mcps.value.filter((m) => m.status === 1).length,
  offline: mcps.value.filter((m) => m.status === 0).length,
}))

async function fetchList() {
  loading.value = true
  try {
    const res = await getMcpList()
    mcps.value = res.data
  } finally {
    loading.value = false
  }
}

function handleNew() {
  editingData.value = null
  form.value = { id: null, name: '', url: '', auth_type: 'none', api_key: '', timeout: 20, status: 1 }
  dialogVisible.value = true
}

function handleEdit(mcp: any) {
  editingData.value = mcp
  form.value = { ...mcp }
  dialogVisible.value = true
}

async function handleSave() {
  await saveMcp(form.value)
  ElMessage.success(form.value.id ? '已更新' : '已创建')
  dialogVisible.value = false
  fetchList()
}

async function handleTest(id: number) {
  testing.value = id
  try {
    const res = await testMcp(id)
    ElMessage[res.data.success ? 'success' : 'error'](res.data.message)
  } finally {
    testing.value = null
  }
}

async function handleToggle(id: number, status: number) {
  await toggleMcpStatus(id, status)
  const item = mcps.value.find((m) => m.id === id)
  if (item) item.status = status
}

async function handleDelete(id: number, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 MCP 服务「${name}」吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteMcp(id)
    ElMessage.success(`已删除 "${name}"`)
    fetchList()
  } catch {
    // handled by interceptor
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="mcp-view">
    <GlassCard>
      <div class="view-header">
        <h2 class="text-glow-cyan">MCP 服务管理</h2>
        <NeonButton @click="handleNew">+ 新增服务</NeonButton>
      </div>
    </GlassCard>

    <!-- 状态监控条 -->
    <div class="status-bar glass-card">
      <div class="status-item">
        <span class="status-dot dot-online" />
        <span>在线 {{ stats.online }}</span>
      </div>
      <div class="status-item">
        <span class="status-dot dot-offline" />
        <span>离线 {{ stats.offline }}</span>
      </div>
      <div class="status-item">
        <span>总计 {{ stats.total }}</span>
      </div>
    </div>

    <!-- MCP 服务表格 -->
    <GlassCard>
      <el-table :data="mcps" v-loading="loading" style="width:100%">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="服务名称" width="150" />
        <el-table-column prop="url" label="请求地址" min-width="200" />
        <el-table-column prop="auth_type" label="认证方式" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.auth_type === 'api_key' ? 'API Key' : row.auth_type === 'token' ? 'Token' : '无' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="timeout" label="超时(s)" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              @change="(val: boolean) => handleToggle(row.id, val ? 1 : 0)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" text @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" text @click="handleTest(row.id)" :loading="testing === row.id">测试</el-button>
            <el-button size="small" text type="danger" @click="handleDelete(row.id, row.name)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </GlassCard>

    <!-- 编辑弹窗 -->
    <el-dialog
      :model-value="dialogVisible"
      :title="form.id ? '编辑 MCP 服务' : '新增 MCP 服务'"
      width="500px"
      @close="dialogVisible = false"
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="服务名称">
          <el-input v-model="form.name" placeholder="输入服务名称" />
        </el-form-item>
        <el-form-item label="请求地址">
          <el-input v-model="form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="认证方式">
          <el-select v-model="form.auth_type" style="width:100%">
            <el-option label="无认证" value="none" />
            <el-option label="API Key" value="api_key" />
            <el-option label="Token" value="token" />
          </el-select>
        </el-form-item>
        <el-form-item label="API Key / Token">
          <el-input v-model="form.api_key" type="password" show-password placeholder="输入密钥" />
        </el-form-item>
        <el-form-item label="超时时间(秒)">
          <el-input-number v-model="form.timeout" :min="1" :max="120" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
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
    font-size: 20px;
    letter-spacing: 2px;
  }
}

.status-bar {
  display: flex;
  gap: 32px;
  margin: 16px 0;
  padding: 16px 24px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-online {
  background: #00ff88;
  animation: dot-breathe-green 2s infinite;
}

.dot-offline {
  background: #ff4444;
  animation: dot-breathe-red 2s infinite;
}
</style>
