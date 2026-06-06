<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import type { AgentStep } from '@/stores/chat'
import QuestionNav from '@/components/chat/QuestionNav.vue'
import {
  ArrowLeftBold,
  ArrowRightBold,
  ArrowDown, ArrowUp,
  Loading,
  CircleCheckFilled,
  CircleCloseFilled,
} from '@element-plus/icons-vue'

const store = useChatStore()
const expanded = ref(true)
const panelWidth = ref(Number(localStorage.getItem('agent_panel_width')) || 240)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(240)

function toggle() {
  expanded.value = !expanded.value
}

function startResize(e: MouseEvent) {
  if (!expanded.value) return
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = panelWidth.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  const diff = startX.value - e.clientX
  panelWidth.value = Math.max(44, Math.min(600, startWidth.value + diff))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  localStorage.setItem('agent_panel_width', String(panelWidth.value))
}

const selectedIndex = computed(() => store.selectedMsgIndex)

const currentSteps = computed<AgentStep[]>(() => {
  if (selectedIndex.value !== null) {
    const msg = store.messages[selectedIndex.value]
    if (msg && msg.role === 'ai' && msg.steps && msg.steps.length > 0) {
      return msg.steps
    }
  }
  for (let i = store.messages.length - 1; i >= 0; i--) {
    const msg = store.messages[i]
    if (msg.role === 'ai' && msg.steps && msg.steps.length > 0) {
      return msg.steps
    }
  }
  return []
})

function backToLatest() {
  store.clearSelection()
}

function onQuestionJump(msgIndex: number) {
  store.triggerJump(msgIndex)
}

const hasSteps = computed(() => currentSteps.value.length > 0)

const lastStep = computed<AgentStep | null>(() => {
  if (currentSteps.value.length > 0) {
    return currentSteps.value[currentSteps.value.length - 1]
  }
  return null
})

const runningCount = computed(() =>
  currentSteps.value.filter((s) => s.status === 'running').length
)
const completedCount = computed(() =>
  currentSteps.value.filter((s) => s.status === 'completed').length
)
const failCount = computed(() =>
  currentSteps.value.filter((s) => s.status === 'fail').length
)

// Auto-expand when streaming starts
watch(
  () => store.isStreaming,
  (val) => {
    if (val) expanded.value = true
  }
)
</script>

<template>
  <div class="right-panel" :class="{ expanded, resizing: isResizing }" :style="{ width: panelWidth + 'px' }">
    <div class="drag-handle" @mousedown="startResize" />
    <QuestionNav class="panel-question-nav" @jump="onQuestionJump" />
    <!-- 折叠态：竖排标签 + 状态指示灯 -->
    <div v-if="!expanded" class="panel-collapsed" @click="toggle">
      <el-icon :size="18"><ArrowLeftBold /></el-icon>
      <div class="collapsed-label">
        <span>A</span>
        <span>G</span>
        <span>E</span>
        <span>N</span>
        <span>T</span>
      </div>
      <div class="status-dot" :class="{ running: store.isStreaming, fail: failCount > 0 && !store.isStreaming }" />
    </div>

    <!-- 展开态：完整 Agent 面板 -->
    <div v-else class="panel-expanded">
      <div class="panel-header">
        <span class="panel-title">Agent 执行面板</span>
        <el-icon :size="16" class="collapse-icon" @click="toggle"><ArrowRightBold /></el-icon>
      </div>

      <!-- 钉住提示 -->
      <div v-if="selectedIndex !== null" class="pinned-bar">
        <span>当前鼠标选中消息</span>
        <button class="back-latest-btn" @click="backToLatest">回到最新</button>
      </div>

      <!-- 统计条 -->
      <div v-if="hasSteps" class="stats-bar">
        <span class="stat running">运行 {{ runningCount }}</span>
        <span class="stat completed">完成 {{ completedCount }}</span>
        <span v-if="failCount > 0" class="stat fail">失败 {{ failCount }}</span>
      </div>

      <!-- 步骤列表 -->
      <div v-if="hasSteps" class="step-list">
        <div
          v-for="(step, idx) in currentSteps"
          :key="idx"
          class="step-item"
          :class="`step-${step.status}`"
        >
          <div v-if="idx < currentSteps.length - 1" class="step-line" />
          <div class="step-dot">
            <el-icon v-if="step.status === 'running'" class="is-loading"><Loading /></el-icon>
            <el-icon v-else-if="step.status === 'completed'"><CircleCheckFilled /></el-icon>
            <el-icon v-else><CircleCloseFilled /></el-icon>
          </div>
          <div class="step-info">
            <span class="step-name">
              {{ step.step || step.name }}
              <span v-if="step.cost_ms && step.status === 'completed'" class="step-cost">{{ (step.cost_ms / 1000).toFixed(1) }}s</span>
            </span>
            <span v-if="step.intent" class="step-detail">意图: <em>{{ step.intent }}</em></span>
            <!-- 节点详情折叠 -->
            <div v-if="step.detail" class="step-detail-fold">
              <div class="detail-toggle" @click="step._showDetail = !step._showDetail">
                📋 详情
                <el-icon :size="12"><ArrowDown v-if="!step._showDetail"/><ArrowUp v-else/></el-icon>
              </div>
              <div v-if="step._showDetail" class="detail-content">{{ step.detail }}</div>
            </div>
            <!-- 子步骤折叠 -->
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
                        <span class="tci-status">{{ rc.status === 'completed' ? '✅' : '⏳' }}</span>
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
                    <span class="tci-status">{{ t.status === 'completed' ? '✅' : '⏳' }}</span>
                    <span class="tci-name">{{ t.name || t.step }}</span>
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

      <!-- 空状态 -->
      <div v-else class="panel-empty">
        <div class="empty-icon">
          <el-icon :size="32"><Loading /></el-icon>
        </div>
        <p>暂无执行步骤</p>
        <p class="empty-sub">发送消息后将在此展示 Agent 执行流程</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.right-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  backdrop-filter: blur(8px);
  border-left: 1px solid var(--border-color);
  flex-shrink: 0;
  width: 44px;
  position: relative;
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible;
  z-index: 5;

  &.expanded {
    width: 240px;
  }

  &.resizing {
    transition: none;
  }
}

.drag-handle {
  position: absolute;
  left: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 238, 255, 0.1);
  }
}

// ---- 折叠态 ----
.panel-collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 0;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.3s;

  &:hover {
    color: var(--color-primary);
  }
}

.collapsed-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--text-secondary);
  gap: 2px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: background 0.3s;

  &.running {
    background: var(--color-primary);
    animation: pulse 1.2s infinite;
  }

  &.fail {
    background: var(--color-danger);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--color-primary); }
  50% { opacity: 0.4; box-shadow: 0 0 12px var(--color-primary); }
}

// ---- 展开态 ----
.panel-expanded {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 240px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 238, 255, 0.1);
  flex-shrink: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 1px;
}

.collapse-icon {
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: var(--color-primary);
  }
}

// ---- 统计条 ----
.stats-bar {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 238, 255, 0.06);
  flex-shrink: 0;
}

// ---- 钉住提示 ----
.pinned-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 11px;
  color: var(--color-primary);
  background: rgba(0, 238, 255, 0.06);
  border-bottom: 1px solid rgba(0, 238, 255, 0.1);
  flex-shrink: 0;
}

.back-latest-btn {
  border: 1px solid rgba(0, 238, 255, 0.3);
  background: transparent;
  color: var(--color-primary);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 238, 255, 0.12);
    border-color: var(--color-primary);
  }
}

.stat {
  font-size: 11px;
  font-weight: 500;

  &.running { color: var(--color-primary); }
  &.completed { color: var(--color-success); }
  &.fail { color: var(--color-danger); }
}

// ---- 步骤列表 ----
.step-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  position: relative;

  &.step-running {
    .step-dot { color: var(--color-primary); }
    .step-name { color: var(--color-primary); }
  }

  &.step-completed {
    .step-dot { color: var(--color-success); }
  }

  &.step-fail {
    .step-dot { color: var(--color-danger); }
    .step-name { color: var(--color-danger); }
  }
}

.step-line {
  position: absolute;
  left: 7px;
  top: 22px;
  width: 1px;
  height: calc(100% - 6px);
  background: rgba(0, 238, 255, 0.12);
}

.step-dot {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}

.is-loading {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
}

.step-cost {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  margin-left: 6px;
}

.step-detail {
  font-size: 11px;
  color: var(--text-secondary);

  em {
    font-style: normal;
    color: var(--color-primary);
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

// ---- 工具子项折叠 ----
.tool-children {
  margin-top: 4px;
}

.tool-child-toggle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  &:hover { color: var(--neon-cyan); }
}

.tool-child-list {
  padding-left: 8px;
  border-left: 1px solid rgba(0, 238, 255, 0.1);
  margin: 2px 0;
}

.tool-child-item {
  font-size: 11px;
  padding: 2px 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.tci-status { flex-shrink: 0; }
.tci-name { color: rgba(255, 255, 255, 0.6); }
.tci-cost { color: rgba(255, 255, 255, 0.3); font-size: 10px; margin-left: auto; }

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

// ---- 空状态 ----
.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;

  p {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 4px 0;
  }
}

.empty-icon {
  color: var(--text-secondary);
  margin-bottom: 8px;
  opacity: 0.5;
}

.empty-sub {
  font-size: 11px !important;
  opacity: 0.6;
}
</style>
