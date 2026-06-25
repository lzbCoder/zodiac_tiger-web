<script setup lang="ts">
import { computed } from 'vue'
import { CopyDocument, Edit, Delete } from '@element-plus/icons-vue'

const props = defineProps<{
  template: {
    id: number
    name: string
    category: string
    content: string
    status: number
    create_time: string
  }
}>()

const emit = defineEmits<{
  edit: [id: number]
  delete: [id: number]
  toggle: [id: number, status: number]
  use: [content: string]
}>()

const categoryLabel = computed(() => {
  const map: Record<string, string> = {
    common: '通用对话',
    travel: '旅游规划',
    assistant: '智能助手',
  }
  return map[props.template.category] || props.template.category
})

const categoryColor = computed(() => {
  const map: Record<string, string> = {
    common: 'var(--neon-cyan)',
    travel: '#00ff88',
    assistant: '#ff9f43',
  }
  return map[props.template.category] || 'var(--neon-cyan)'
})

const preview = computed(() => {
  return props.template.content.length > 120
    ? props.template.content.slice(0, 120) + '...'
    : props.template.content
})
</script>

<template>
  <div class="template-card glass-card" :class="{ disabled: template.status === 0 }">
    <div class="card-header">
      <span class="card-name">{{ template.name }}</span>
      <span class="card-category" :style="{ color: categoryColor, borderColor: categoryColor }">
        {{ categoryLabel }}
      </span>
    </div>
    <el-tooltip
      :content="template.content"
      placement="top"
      effect="dark"
      :show-after="200"
      :disabled="template.content.length <= 120"
      popper-class="desc-tooltip"
    >
      <div class="card-preview">{{ preview }}</div>
    </el-tooltip>
    <div class="card-footer">
      <el-switch
        :model-value="template.status === 1"
        @change="(val: boolean) => emit('toggle', template.id, val ? 1 : 0)"
      />
      <div class="card-actions">
        <el-tooltip content="复制模板" placement="top">
          <el-button :icon="CopyDocument" circle size="small" @click="emit('use', template.content)" />
        </el-tooltip>
        <el-tooltip content="编辑模板" placement="top">
          <el-button :icon="Edit" circle size="small" @click="emit('edit', template.id)" />
        </el-tooltip>
        <el-tooltip content="删除模板" placement="top">
          <el-button :icon="Delete" circle size="small" type="danger" @click="emit('delete', template.id)" />
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-card {
  padding: 16px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(var(--color-primary-rgb), 0.3);
  }

  &.disabled {
    opacity: 0.5;

    .card-actions {
      pointer-events: none;
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
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 4px;
  white-space: nowrap;
}

.card-preview {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
  min-height: 40px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
