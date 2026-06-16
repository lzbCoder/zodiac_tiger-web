<script setup lang="ts">
import { ref } from 'vue'
import type { AgentStep } from '@/stores/chat'
import { ArrowDown, ArrowUp, Loading, CircleCheckFilled, CircleCloseFilled, Clock, Remove } from '@element-plus/icons-vue'

defineProps<{
  steps: AgentStep[]
}>()

const collapsed = ref(false)

function toggle() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div v-if="steps.length > 0" class="agent-flow">
    <!-- 折叠提示条 -->
    <div
      v-if="collapsed"
      class="flow-toggle"
      @click="toggle"
    >
      <span>Agent 执行流程 ({{ steps.length }} 步)</span>
      <el-icon :size="14"><ArrowDown /></el-icon>
    </div>

    <!-- 展开完整流程 -->
    <div v-else class="flow-body">
      <div class="flow-header" @click="toggle">
        <span>Agent 执行流程 ({{ steps.length }} 步)</span>
        <el-icon :size="14" class="flow-collapse-icon"><ArrowUp /></el-icon>
      </div>
      <div class="step-list" :class="{ 'has-scroll': steps.length > 5 }">
        <div
          v-for="(step, idx) in steps"
          :key="idx"
          class="step-item"
          :class="`step-${step.status}`"
        >
          <div class="step-line" v-if="idx < steps.length - 1" />
          <div class="step-dot">
            <el-icon v-if="step.status === 'running' || step.status === 'in_progress'" class="is-loading"><Loading /></el-icon>
            <el-icon v-else-if="step.status === 'completed'"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="step.status === 'pending'"><Clock /></el-icon>
            <el-icon v-else-if="step.status === 'terminated'"><Remove /></el-icon>
            <el-icon v-else><CircleCloseFilled /></el-icon>
          </div>
          <div class="step-info">
            <span class="step-name">
              {{ step.step || step.name }}
              <span v-if="step.cost_ms && step.status === 'completed'" class="step-cost">{{ (step.cost_ms / 1000).toFixed(1) }}s</span>
            </span>
            <span v-if="step.intent" class="step-detail">
              意图: <em>{{ step.intent }}</em>
            </span>
            <!-- 节点详情折叠 -->
            <div v-if="step.detail" class="step-detail-fold">
              <div class="detail-toggle" @click="step._showDetail = !step._showDetail">
                📋 详情
                <el-icon :size="12"><ArrowDown v-if="!step._showDetail"/><ArrowUp v-else/></el-icon>
              </div>
              <div v-if="step._showDetail" class="detail-content">{{ step.detail }}</div>
            </div>
            <!-- 工具子项折叠 -->
            <div v-if="step.children && step.children.length > 0" class="tool-children">
              <div class="tool-child-toggle" @click="step._showTools = !step._showTools">
                ⚡ 执行流程 ({{ step.children.length }})
                <el-icon :size="12"><ArrowDown v-if="!step._showTools"/><ArrowUp v-else/></el-icon>
              </div>
              <div v-if="step._showTools" class="tool-child-list">
                <template v-for="(t, i) in step.children" :key="i">
                  <!-- 轮次组节点：包含子 children -->
                  <div v-if="t.children && t.children.length > 0" class="tool-round-group">
                    <div class="tool-round-toggle" @click="t._showTools = !t._showTools">
                      🔄 {{ t.name || t.step }} ({{ t.children.length }})
                      <el-icon :size="12"><ArrowDown v-if="!t._showTools"/><ArrowUp v-else/></el-icon>
                    </div>
                    <div v-if="t._showTools" class="tool-round-list">
                      <div v-for="(rc, ri) in t.children" :key="ri" class="tool-child-item">
                        <span class="tci-status">{{ rc.status === 'completed' ? '✅' : rc.status === 'in_progress' ? '⚙️' : '⏳' }}</span>
                        <span class="tci-name">{{ rc.name || rc.step }}</span>
                        <span v-if="rc.cost_ms" class="tci-cost">{{ (rc.cost_ms / 1000).toFixed(1) }}s</span>
                        <div v-if="rc.detail" class="tci-detail-fold">
                          <div class="detail-toggle" @click="rc._showDetail = !rc._showDetail">
                            📋 详情
                            <el-icon :size="12"><ArrowDown v-if="!rc._showDetail"/><ArrowUp v-else/></el-icon>
                          </div>
                          <div v-if="rc._showDetail" class="detail-content">{{ rc.detail }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- 普通子项 -->
                  <div v-else class="tool-child-item">
                    <span class="tci-status">
                      <el-icon v-if="t.status === 'in_progress'" class="is-loading" :size="12"><Loading /></el-icon>
                      <span v-else>{{ t.status === 'completed' ? '✅' : '⏳' }}</span>
                    </span>
                    <span class="tci-name" :class="{ 'highlight': t.status === 'in_progress' }">{{ t.step || t.name }}</span>
                    <span v-if="t.cost_ms" class="tci-cost">{{ (t.cost_ms / 1000).toFixed(1) }}s</span>
                    <div v-if="t.detail" class="tci-detail-fold">
                      <div class="detail-toggle" @click="t._showDetail = !t._showDetail">
                        📋 详情
                        <el-icon :size="12"><ArrowDown v-if="!t._showDetail"/><ArrowUp v-else/></el-icon>
                      </div>
                      <div v-if="t._showDetail" class="detail-content">{{ t.detail }}</div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
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

.step-list {
  &.has-scroll {
    max-height: none;
    overflow-y: visible;
  }
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  position: relative;

  &.step-running {
    .step-dot { color: var(--neon-cyan); }
    .step-name { color: var(--neon-cyan); }
  }

  &.step-completed {
    .step-dot { color: #00ff88; }
  }

  &.step-in_progress {
    .step-dot { color: var(--neon-cyan); }
    .step-name { color: var(--neon-cyan); }
  }

  &.step-pending {
    .step-dot { color: rgba(255, 255, 255, 0.35); }
    .step-name { color: rgba(255, 255, 255, 0.5); }
  }

  &.step-fail {
    .step-dot { color: #ff4444; }
    .step-name { color: #ff4444; }
  }

  &.step-terminated {
    .step-dot { color: #ff9500; }
    .step-name { color: rgba(255, 255, 255, 0.38); text-decoration: line-through; }
  }
}

.step-line {
  position: absolute;
  left: 7px;
  top: 21px;
  width: 1px;
  height: calc(100% - 8px);
  background: rgba(0, 238, 255, 0.1);
}

.step-dot {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.step-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.step-cost {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  margin-left: 6px;

  .step-running & { display: none; }
}

.step-detail {
  font-size: 11px;
  color: var(--text-secondary);

  em {
    font-style: normal;
    color: var(--neon-cyan);
  }
}

// ---- 节点详情折叠 ----
.step-detail-fold { margin-top: 4px; }

.detail-toggle {
  font-size: 11px; color: rgba(255, 255, 255, 0.4);
  cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 2px 0;
  &:hover { color: var(--neon-cyan); }
}

.detail-content {
  font-size: 11px; color: rgba(255, 255, 255, 0.5);
  background: rgba(0, 238, 255, 0.03);
  padding: 6px 8px; border-radius: 4px;
  margin-top: 2px; max-height: 120px; overflow-y: auto;
  white-space: pre-wrap; line-height: 1.5;
}

// ---- 工具子项折叠（RightPanel 同款） ----
.tool-children { margin-top: 4px; }

.tool-child-toggle {
  font-size: 11px; color: rgba(255, 255, 255, 0.4);
  cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 2px 0;
  &:hover { color: var(--neon-cyan); }
}

.tool-child-list {
  padding-left: 8px;
  border-left: 1px solid rgba(0, 238, 255, 0.1);
  margin: 2px 0;
}

.tool-child-item {
  font-size: 11px; padding: 2px 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
}

.tci-status { flex-shrink: 0; }
.tci-name { color: rgba(255, 255, 255, 0.6); }
.tci-cost { color: rgba(255, 255, 255, 0.3); font-size: 10px; margin-left: auto; }
.tci-name.highlight { color: var(--neon-cyan); }

.tci-detail-fold {
  width: 100%;
  margin-top: 2px;
}

// ---- 轮次组嵌套 ----
.tool-round-group {
  margin: 2px 0;
}

.tool-round-toggle {
  font-size: 11px; color: rgba(0, 238, 255, 0.55);
  cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 2px 0;
  &:hover { color: var(--neon-cyan); }
}

.tool-round-list {
  padding-left: 12px;
  border-left: 1px solid rgba(0, 238, 255, 0.15);
  margin: 2px 0 4px 4px;
}
</style>
