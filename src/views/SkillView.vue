<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getSkillList, saveSkill, toggleSkillStatus, deleteSkill } from '@/api/skill'
import GlassCard from '@/components/common/GlassCard.vue'
import NeonButton from '@/components/common/NeonButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const skills = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingData = ref<any>(null)

const form = ref({
  id: null as number | null,
  name: '',
  desc: '',
  skill_type: 'custom',
  mcp_id: null as number | null,
  timeout: 30,
  status: 1,
})

const stats = computed(() => ({
  total: skills.value.length,
  enabled: skills.value.filter((s) => s.status === 1).length,
  mcpBound: skills.value.filter((s) => s.mcp_id).length,
}))

async function fetchList() {
  loading.value = true
  try {
    const res = await getSkillList()
    skills.value = res.data
  } finally {
    loading.value = false
  }
}

function handleNew() {
  editingData.value = null
  form.value = { id: null, name: '', desc: '', skill_type: 'custom', mcp_id: null, timeout: 30, status: 1 }
  dialogVisible.value = true
}

function handleEdit(skill: any) {
  if (skill.status === 0) return
  editingData.value = skill
  form.value = { ...skill }
  dialogVisible.value = true
}

async function handleSave() {
  await saveSkill(form.value)
  ElMessage.success(form.value.id ? '已更新' : '已创建')
  dialogVisible.value = false
  fetchList()
}

async function handleToggle(id: number, status: number) {
  await toggleSkillStatus(id, status)
  const item = skills.value.find((s) => s.id === id)
  if (item) item.status = status
}

async function handleDelete(skill: any) {
  if (skill.status === 0) return
  try {
    await ElMessageBox.confirm(
      `确定要删除技能「${skill.name}」吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteSkill(skill.id)
    ElMessage.success('已删除')
    fetchList()
  } catch {
    // cancelled
  }
}

const typeLabel = (skill_type: string) => {
  const map: Record<string, string> = { builtin: '内置', mcp: 'MCP绑定', custom: '自定义' }
  return map[skill_type] || skill_type
}

onMounted(fetchList)
</script>

<template>
  <div class="skill-view">
    <GlassCard>
      <div class="view-header">
        <h2 class="text-glow-cyan">技能管理</h2>
        <NeonButton @click="handleNew">+ 新增技能</NeonButton>
      </div>
    </GlassCard>

    <div class="stats-row">
      <div class="stat-item glass-card">
        <span class="stat-num text-glow-cyan">{{ stats.total }}</span>
        <span class="stat-label">总技能数</span>
      </div>
      <div class="stat-item glass-card">
        <span class="stat-num" style="color:#00ff88">{{ stats.enabled }}</span>
        <span class="stat-label">已启用</span>
      </div>
      <div class="stat-item glass-card">
        <span class="stat-num text-glow-purple">{{ stats.mcpBound }}</span>
        <span class="stat-label">MCP 绑定</span>
      </div>
    </div>

    <div v-loading="loading" class="skill-grid">
      <div
        v-for="skill in skills"
        :key="skill.id"
        class="skill-card glass-card"
        :class="{ disabled: skill.status === 0 }"
      >
        <div class="card-header">
          <span class="card-name">{{ skill.name }}</span>
          <span class="card-category" :class="skill.skill_type">
            {{ typeLabel(skill.skill_type) }}
          </span>
        </div>
        <div class="card-body">
          <p class="card-desc">{{ skill.desc || '暂无描述' }}</p>
          <span class="card-info">超时: {{ skill.timeout }}s</span>
        </div>
        <div class="card-footer">
          <el-switch
            :model-value="skill.status === 1"
            @change="(val: boolean) => handleToggle(skill.id, val ? 1 : 0)"
          />
          <div class="card-actions">
            <el-button size="small" text @click="handleEdit(skill)">编辑</el-button>
            <el-button size="small" text type="danger" @click="handleDelete(skill)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!loading && skills.length === 0" text="暂无技能配置" />

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      :model-value="dialogVisible"
      :title="form.id ? '编辑技能' : '新增技能'"
      width="500px"
      @close="dialogVisible = false"
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="技能名称">
          <el-input v-model="form.name" placeholder="输入技能名称" />
        </el-form-item>
        <el-form-item label="功能描述">
          <el-input v-model="form.desc" type="textarea" rows="3" />
        </el-form-item>
        <el-form-item label="技能类型">
          <el-select v-model="form.skill_type" style="width:100%">
            <el-option label="自定义" value="custom" />
            <el-option label="MCP 绑定" value="mcp" />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定 MCP 服务 ID">
          <el-input-number v-model="form.mcp_id" :min="0" style="width:100%" />
        </el-form-item>
        <el-form-item label="调用超时(秒)">
          <el-input-number v-model="form.timeout" :min="1" :max="300" style="width:100%" />
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
.skill-view {
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
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

// ============ 卡片样式（与 TemplateCard 统一）============
.skill-card {
  padding: 16px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(0, 238, 255, 0.3);
  }

  &.disabled {
    opacity: 0.5;

    .card-actions {
      pointer-events: none;

      .el-button {
        color: rgba(255, 255, 255, 0.3) !important;
      }
    }
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-category {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 4px;

  &.builtin {
    color: var(--neon-cyan);
    border-color: var(--neon-cyan);
  }
  &.custom {
    color: var(--neon-purple);
    border-color: var(--neon-purple);
  }
  &.mcp {
    color: var(--neon-pink);
    border-color: var(--neon-pink);
  }
}

.card-body {
  margin-bottom: 12px;
}

.card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 4px;
  min-height: 40px;
}

.card-info {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-actions {
  display: flex;
  gap: 4px;
}
</style>
