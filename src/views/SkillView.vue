<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Edit, Connection, Delete, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import GlassCard from '@/components/common/GlassCard.vue'
import NeonButton from '@/components/common/NeonButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  type SkillInfo,
  getSkillList,
  uploadSkill,
  editSkill,
  toggleSkillStatus,
  deleteSkill,
  getSkillAgentBind,
  updateSkillAgentBind,
} from '@/api/skill'

// ---- 列表 ----
const skills = ref<SkillInfo[]>([])
const loading = ref(false)

const stats = computed(() => ({
  total: skills.value.length,
  enabled: skills.value.filter((s) => s.enable_status === 1).length,
  bound: 0, // 简化：不实时统计
}))

async function fetchList() {
  loading.value = true
  try {
    const res: any = await getSkillList()
    skills.value = res.data ?? []
  } finally {
    loading.value = false
  }
}

// ---- 启用/禁用 ----
async function handleToggle(skill: SkillInfo, val: boolean) {
  try {
    await toggleSkillStatus({ skill_key: skill.skill_key, enable_status: val ? 1 : 0 })
    skill.enable_status = val ? 1 : 0
    ElMessage.success(val ? '已启用' : '已禁用')
  } catch {
    ElMessage.error('操作失败')
    skill.enable_status = val ? 0 : 1
  }
}

// ---- 删除 ----
async function handleDelete(skill: SkillInfo) {
  await ElMessageBox.confirm(
    `确认删除技能「${skill.skill_name}」？将同时删除磁盘文件和绑定关系。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
  try {
    await deleteSkill(skill.skill_key)
    ElMessage.success('已删除')
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message ?? '删除失败')
  }
}

// ---- 弹窗 1：上传新技能 ----
const uploadVisible = ref(false)
const uploadLoading = ref(false)
const uploadForm = ref({ skill_name: '', skill_desc: '' })
const uploadFile = ref<File | null>(null)
const uploadRef = ref()

const canUpload = computed(() =>
  uploadForm.value.skill_name.trim() && uploadFile.value !== null,
)

function handleBeforeUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'zip') {
    ElMessage.error('仅支持 .zip 格式')
    return false
  }
  uploadFile.value = file
  return false // 手动控制上传
}

function handleRemoveFile() {
  uploadFile.value = null
}

function openUploadDialog() {
  uploadForm.value = { skill_name: '', skill_desc: '' }
  uploadFile.value = null
  uploadVisible.value = true
}

async function handleUpload() {
  if (!uploadFile.value) return ElMessage.warning('请先选择技能压缩包')
  if (!uploadForm.value.skill_name.trim()) return ElMessage.warning('请填写展示名称')

  uploadLoading.value = true
  try {
    const fd = new FormData()
    fd.append('skill_name', uploadForm.value.skill_name.trim())
    if (uploadForm.value.skill_desc.trim()) fd.append('skill_desc', uploadForm.value.skill_desc.trim())
    fd.append('file', uploadFile.value)
    await uploadSkill(fd)
    ElMessage.success('技能上传成功')
    uploadVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message ?? '上传失败')
  } finally {
    uploadLoading.value = false
  }
}

// ---- 弹窗 2：编辑 ----
const editVisible = ref(false)
const editLoading = ref(false)
const editForm = ref({ skill_key: '', skill_name: '', skill_desc: '' })

function openEditDialog(skill: SkillInfo) {
  editForm.value = {
    skill_key: skill.skill_key,
    skill_name: skill.skill_name,
    skill_desc: skill.skill_desc ?? '',
  }
  editVisible.value = true
}

async function handleSaveEdit() {
  if (!editForm.value.skill_name.trim()) return ElMessage.warning('展示名称不能为空')
  editLoading.value = true
  try {
    await editSkill({
      skill_key: editForm.value.skill_key,
      skill_name: editForm.value.skill_name.trim(),
      skill_desc: editForm.value.skill_desc.trim() || null,
    })
    ElMessage.success('保存成功')
    editVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message ?? '保存失败')
  } finally {
    editLoading.value = false
  }
}

// ---- 弹窗 3：绑定 Agent ----
const bindVisible = ref(false)
const bindLoading = ref(false)
const bindSkillKey = ref('')
const selectedAgents = ref<string[]>([])

const AGENT_OPTIONS = [
  { code: 'chat_agent', label: '💬 通用闲聊 Agent', disabled: true },
  { code: 'report_agent', label: '📊 数据分析 Agent', disabled: false },
  { code: 'travel_agent', label: '🗺️ 旅游规划 Agent', disabled: false },
  { code: 'assistant_agent', label: '🤖 综合助手 Agent', disabled: false },
]

async function openBindDialog(skill: SkillInfo) {
  bindSkillKey.value = skill.skill_key
  bindVisible.value = true
  bindLoading.value = true
  try {
    const res: any = await getSkillAgentBind(skill.skill_key)
    selectedAgents.value = res.data?.agent_codes ?? []
  } finally {
    bindLoading.value = false
  }
}

async function handleSaveBind() {
  bindLoading.value = true
  try {
    await updateSkillAgentBind({ skill_key: bindSkillKey.value, agent_codes: selectedAgents.value })
    ElMessage.success('绑定关系已更新')
    bindVisible.value = false
  } finally {
    bindLoading.value = false
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="skill-view">
    <!-- 顶部标题栏 -->
    <GlassCard>
      <div class="view-header">
        <h2 class="text-glow-cyan">技能管理</h2>
        <NeonButton @click="openUploadDialog">+ 新增技能</NeonButton>
      </div>
    </GlassCard>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item glass-card">
        <span class="stat-num text-glow-cyan">{{ stats.total }}</span>
        <span class="stat-label">总技能数</span>
      </div>
      <div class="stat-item glass-card">
        <span class="stat-num" style="color: #00ff88">{{ stats.enabled }}</span>
        <span class="stat-label">已启用</span>
      </div>
      <div class="stat-item glass-card">
        <span class="stat-num text-glow-purple">{{ skills.filter(s => s.enable_status === 1).length }}</span>
        <span class="stat-label">激活中</span>
      </div>
    </div>

    <!-- 技能卡片网格 -->
    <div v-loading="loading" class="skill-grid">
      <div v-for="skill in skills" :key="skill.skill_key" class="skill-card glass-card">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-name">{{ skill.skill_name }}</span>
            <span class="card-key">{{ skill.skill_key }}</span>
          </div>
          <el-switch
            :model-value="skill.enable_status === 1"
            @change="(val: boolean) => handleToggle(skill, val)"
            active-color="#00c8ff"
          />
        </div>
        <p class="card-desc">{{ skill.skill_desc || skill.origin_desc || '暂无描述' }}</p>
        <div class="card-footer">
          <span class="card-time">{{ skill.create_time }}</span>
          <div class="card-actions">
            <el-tooltip content="编辑信息" placement="top">
              <el-button :icon="Edit" circle size="small" @click="openEditDialog(skill)" />
            </el-tooltip>
            <el-tooltip content="绑定 Agent" placement="top">
              <el-button :icon="Connection" circle size="small" @click="openBindDialog(skill)" />
            </el-tooltip>
            <el-tooltip content="删除技能" placement="top">
              <el-button :icon="Delete" circle size="small" type="danger" @click="handleDelete(skill)" />
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!loading && skills.length === 0" text="暂无技能，请点击「新增技能」上传压缩包" />

    <!-- 弹窗 1：上传新技能 -->
    <el-dialog
      :model-value="uploadVisible"
      title="上传新技能"
      width="500px"
      @close="uploadVisible = false"
    >
      <el-form label-position="top">
        <el-form-item label="展示名称" required>
          <el-input v-model="uploadForm.skill_name" placeholder="技能的展示名称" />
        </el-form-item>
        <el-form-item label="展示描述">
          <el-input
            v-model="uploadForm.skill_desc"
            type="textarea"
            :rows="2"
            placeholder="可选，留空则使用 SKILL.md 中的 description"
          />
        </el-form-item>
        <el-form-item label="技能压缩包" required>
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :before-upload="handleBeforeUpload"
            :on-change="(f: any) => { uploadFile = f.raw }"
            :on-remove="handleRemoveFile"
            accept=".zip"
            :limit="1"
            class="skill-upload"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">拖拽文件到此处，或 <em>点击选择</em></div>
            <template #tip>
              <div class="el-upload__tip">仅支持 .zip 格式，压缩包内需包含 SKILL.md</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="uploadLoading"
          :disabled="!canUpload"
          @click="handleUpload"
        >上传</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 2：编辑信息 -->
    <el-dialog
      :model-value="editVisible"
      title="编辑技能信息"
      width="460px"
      @close="editVisible = false"
    >
      <el-form label-position="top">
        <el-form-item label="技能编码（只读）">
          <el-text class="skill-key-readonly">{{ editForm.skill_key }}</el-text>
        </el-form-item>
        <el-form-item label="展示名称" required>
          <el-input v-model="editForm.skill_name" placeholder="技能展示名称" />
        </el-form-item>
        <el-form-item label="展示描述">
          <el-input v-model="editForm.skill_desc" type="textarea" :rows="3" placeholder="技能功能描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 3：绑定 Agent -->
    <el-dialog
      :model-value="bindVisible"
      :title="`绑定 Agent — ${bindSkillKey}`"
      width="480px"
      @close="bindVisible = false"
    >
      <div class="bind-desc">勾选允许使用该技能的 Agent（chat_agent 为纯闲聊，不支持技能）</div>
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 8px;
}

.skill-card {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 0 16px rgba(0, 200, 255, 0.15);
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
}

.card-key {
  font-size: 11px;
  color: var(--text-secondary, #888);
  font-family: 'Courier New', monospace;
}

.card-desc {
  font-size: 13px;
  color: var(--text-secondary, #aaa);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.card-time {
  font-size: 11px;
  color: var(--text-secondary, #666);
}

.card-actions {
  display: flex;
  gap: 4px;
}

.skill-upload {
  width: 100%;
}

.skill-key-readonly {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--text-secondary, #888);
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 10px;
  border-radius: 4px;
  display: block;
}

.bind-desc {
  font-size: 13px;
  color: var(--text-secondary, #aaa);
  margin-bottom: 16px;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 80px;
}

.agent-item {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}
</style>
