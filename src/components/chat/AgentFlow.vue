<script setup lang="ts">
import { ref } from 'vue'
import type { AgentStep } from '@/stores/chat'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import AgentTimeline from './AgentTimeline.vue'

defineProps<{
  steps: AgentStep[]
}>()

const collapsed = ref(true)

function toggle() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div v-if="steps.length > 0" class="agent-flow">
    <!-- 折叠提示条 -->
    <div v-if="collapsed" class="flow-toggle" @click="toggle">
      <span class="flow-ic">🔄</span>
      <span>Agent 执行流程 ({{ steps.length }} 步)</span>
      <el-icon :size="14"><ArrowDown /></el-icon>
    </div>

    <!-- 展开完整流程 -->
    <div v-else class="flow-body">
      <div class="flow-header" @click="toggle">
        <span class="flow-ic">🔄</span>
        <span>Agent 执行流程 ({{ steps.length }} 步)</span>
        <el-icon :size="14" class="flow-collapse-icon"><ArrowUp /></el-icon>
      </div>
      <div class="step-list" :class="{ 'has-scroll': steps.length > 8 }">
        <AgentTimeline :steps="steps" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-flow {
  margin-bottom: 8px;
  font-size: 12px;
  width: 100%;
}

.flow-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.2s, text-shadow 0.2s;
  user-select: none;

  &:hover {
    color: var(--neon-cyan);
    text-shadow: 0 0 8px rgba(0, 238, 255, 0.3);
  }
}

.flow-body {
  padding: 6px 0;
  transition: opacity 0.3s ease;
}

.flow-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;

  &:hover {
    color: var(--neon-cyan);
  }
}

.flow-collapse-icon {
  color: inherit;
  transition: color 0.2s;
  flex-shrink: 0;
}

.flow-ic {
  font-size: 13px;
  flex-shrink: 0;
}

.step-list {
  &.has-scroll {
    max-height: 360px;
    overflow-y: auto;
  }
}
</style>
