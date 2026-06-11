<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTemplateList, saveTemplate, deleteTemplate, toggleTemplateStatus } from '@/api/template'
import GlassCard from '@/components/common/GlassCard.vue'
import NeonButton from '@/components/common/NeonButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import TemplateCard from '@/components/template/TemplateCard.vue'
import TemplateEditor from '@/components/template/TemplateEditor.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const templates = ref<any[]>([])
const total = ref(0)
const category = ref('')
const loading = ref(false)
const editorVisible = ref(false)
const editingData = ref<any>(null)

const categories = [
  { label: '全部', value: '' },
  { label: '通用对话', value: 'common' },
  { label: '数据报表', value: 'report' },
  { label: '旅游规划', value: 'travel' },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await getTemplateList({ category: category.value || undefined })
    templates.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handleNew() {
  editingData.value = null
  editorVisible.value = true
}

function handleEdit(id: number) {
  editingData.value = templates.value.find((t) => t.id === id)
  editorVisible.value = true
}

async function handleDelete(id: number) {
  const tpl = templates.value.find((t: any) => t.id === id)
  const name = tpl?.name || `ID: ${id}`
  try {
    await ElMessageBox.confirm(
      `确定要删除模板「${name}」吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteTemplate(id)
    ElMessage.success('已删除')
    fetchList()
  } catch {
    // 取消
  }
}

async function handleToggle(id: number, status: number) {
  await toggleTemplateStatus(id, status)
  const item = templates.value.find((t) => t.id === id)
  if (item) item.status = status
}

async function handleSave(data: Record<string, any>) {
  await saveTemplate(data)
  ElMessage.success(data.id ? '已更新' : '已创建')
  editorVisible.value = false
  fetchList()
}

function handleUse(content: string) {
  // 复制内容到剪贴板，提示用户粘贴到聊天框
  navigator.clipboard.writeText(content)
  ElMessage.success('模板内容已复制，请粘贴到聊天输入框')
}

function switchCategory(val: string) {
  category.value = val
  fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="template-view">
    <GlassCard>
      <div class="view-header">
        <h2 class="text-glow-cyan">提示词模板管理</h2>
        <NeonButton @click="handleNew">+ 新建模板</NeonButton>
      </div>
    </GlassCard>

    <div class="category-tabs">
      <span
        v-for="cat in categories"
        :key="cat.value"
        class="cat-tab"
        :class="{ active: category === cat.value }"
        @click="switchCategory(cat.value)"
      >{{ cat.label }}</span>
    </div>

    <div v-loading="loading" class="template-grid">
      <TemplateCard
        v-for="t in templates"
        :key="t.id"
        :template="t"
        @edit="handleEdit"
        @delete="handleDelete"
        @toggle="handleToggle"
        @use="handleUse"
      />
    </div>

    <EmptyState v-if="!loading && templates.length === 0" text="暂无模板，点击上方按钮创建" />

    <TemplateEditor
      :visible="editorVisible"
      :data="editingData"
      @close="editorVisible = false"
      @save="handleSave"
    />
  </div>
</template>

<style scoped lang="scss">
.template-view {
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

.category-tabs {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

.cat-tab {
  padding: 8px 20px;
  border: 1px solid rgba(0, 238, 255, 0.2);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: rgba(0, 238, 255, 0.4);
    color: var(--text-primary);
  }

  &.active {
    background: rgba(0, 238, 255, 0.1);
    border-color: var(--neon-cyan);
    color: var(--neon-cyan);
  }
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
