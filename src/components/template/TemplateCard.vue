<script setup lang="ts">
import { computed } from 'vue'

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
    common: '通用',
    report: '数据报表',
    travel: '旅游规划',
    code: '代码生成',
  }
  return map[props.template.category] || props.template.category
})

const categoryColor = computed(() => {
  const map: Record<string, string> = {
    common: 'var(--neon-cyan)',
    report: 'var(--neon-purple)',
    travel: '#00ff88',
    code: 'var(--neon-pink)',
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
    <div class="card-preview">{{ preview }}</div>
    <div class="card-footer">
      <el-switch
        :model-value="template.status === 1"
        @change="(val: boolean) => emit('toggle', template.id, val ? 1 : 0)"
      />
      <div class="card-actions">
        <el-button size="small" text @click="emit('use', template.content)">使用</el-button>
        <el-button size="small" text @click="emit('edit', template.id)">编辑</el-button>
        <el-button size="small" text type="danger" @click="emit('delete', template.id)">删除</el-button>
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
    border-color: rgba(0, 238, 255, 0.3);
  }

  &.disabled {
    opacity: 0.5;

      .card-actions {
        pointer-events: none;
      }
      .card-actions .el-button {
        color: rgba(255, 255, 255, 0.3) !important;
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
}

.card-preview {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
  min-height: 40px;
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
