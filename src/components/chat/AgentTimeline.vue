<script setup lang="ts">
import type { AgentStep } from '@/stores/chat'
import { Loading, CircleCheckFilled, CircleCloseFilled, Clock, Remove, ArrowDown, ArrowUp } from '@element-plus/icons-vue'

const props = defineProps<{
  steps: AgentStep[]
}>()

function fmtCost(ms?: number): string {
  return ms ? `${(ms / 1000).toFixed(1)}s` : ''
}

// 判断 stage 节点后面是否紧跟 substep（决定是否显示折叠箭头）
function stageHasSubsteps(idx: number): boolean {
  for (let i = idx + 1; i < props.steps.length; i++) {
    if (props.steps[i].kind === 'stage') break
    if (props.steps[i].kind === 'substep') return true
  }
  return false
}

// 某个 substep 是否因其上级 stage 折叠而被隐藏
function isHidden(idx: number): boolean {
  if (props.steps[idx].kind !== 'substep') return false
  for (let i = idx - 1; i >= 0; i--) {
    if (props.steps[i].kind === 'stage') {
      return props.steps[i]._collapsed === true
    }
  }
  return false
}

function toggleStage(step: AgentStep) {
  step._collapsed = !step._collapsed
}

function toggleThinking(step: AgentStep) {
  if (!step.thinking) return
  // undefined 视为 true（展开），首次点击变为 false（折叠）
  step.thinking._show = step.thinking._show !== false ? false : true
}
</script>

<template>
  <div class="agent-timeline">
    <template v-for="(step, idx) in steps" :key="step._key || idx">
      <div
        v-if="!isHidden(idx)"
        class="tl-item"
        :class="[`tl-${step.status}`, step.kind === 'substep' ? 'is-substep' : 'is-stage']"
      >
        <!-- 图标/绿点 — 吸附在左侧竖线上 -->
        <div class="tl-icon">
          <template v-if="step.kind === 'substep'">
            <span class="tl-dot" />
          </template>
          <template v-else>
            <el-icon v-if="step.status === 'running' || step.status === 'in_progress'" class="is-loading"><Loading /></el-icon>
            <el-icon v-else-if="step.status === 'completed'"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="step.status === 'pending'"><Clock /></el-icon>
            <el-icon v-else-if="step.status === 'terminated'"><Remove /></el-icon>
            <el-icon v-else><CircleCloseFilled /></el-icon>
          </template>
        </div>

        <div class="tl-body">
          <!-- 标题行：名称 + 耗时 + stage 折叠箭头 -->
          <div
            class="tl-head"
            :class="{ clickable: step.kind !== 'substep' && stageHasSubsteps(idx) }"
            @click="step.kind !== 'substep' && stageHasSubsteps(idx) && toggleStage(step)"
          >
            <span class="tl-name">{{ step.step || step.name }}</span>
            <span v-if="step.cost_ms && step.status === 'completed'" class="tl-cost">{{ fmtCost(step.cost_ms) }}</span>
            <span v-if="step.attempt && step.attempt > 1" class="tl-retry">重试 {{ step.attempt - 1 }} 次</span>
            <!-- 优化2：有子步骤的 stage 节点显示折叠箭头，紧贴文字右侧 -->
            <el-icon
              v-if="step.kind !== 'substep' && stageHasSubsteps(idx)"
              :size="12"
              class="tl-stage-fold"
            >
              <ArrowDown v-if="step._collapsed" /><ArrowUp v-else />
            </el-icon>
          </div>

          <!-- 优化1：意图识别独立子行 -->
          <div v-if="step.intent" class="tl-intent-row">
            意图: <em>{{ step.intent }}</em>
          </div>

          <!-- 子步骤折叠时不显示附属项 -->
          <template v-if="!step._collapsed">
            <!-- 附属：LLM 思考（🧠，支持折叠，默认展开） -->
            <div v-if="step.thinking" class="tl-attach tl-thinking">
              <div class="tl-attach-head clickable" @click="toggleThinking(step)">
                <span class="tl-attach-ic">🧠</span>
                <span class="tl-attach-title">思考</span>
                <span v-if="step.thinking.cost_ms" class="tl-cost">{{ fmtCost(step.thinking.cost_ms) }}</span>
                <el-icon v-if="step.thinking.status === 'running'" class="is-loading thinking-spin" :size="11"><Loading /></el-icon>
                <!-- 优化1：思考区折叠箭头，紧贴文字右侧 -->
                <el-icon :size="12" class="tl-fold-ic">
                  <ArrowDown v-if="step.thinking._show === false" /><ArrowUp v-else />
                </el-icon>
              </div>
              <!-- _show 为 undefined 或 true 时展开 -->
              <div v-if="step.thinking.content && step.thinking._show !== false" class="tl-thinking-text">
                {{ step.thinking.content }}
              </div>
            </div>

            <!-- 附属：工具调用（🔧，绿点吸附左侧细分竖线，折叠箭头内缩） -->
            <div v-for="(tool, ti) in step.tools" :key="'tool-' + ti" class="tl-attach tl-tool">
              <div class="tl-tool-head clickable" @click="tool._show = !tool._show">
                <span class="tl-ts-dot" :class="`ts-${tool.status}`">
                  <el-icon v-if="tool.status === 'running'" class="is-loading" :size="8"><Loading /></el-icon>
                  <span v-else class="ts-dot-inner" />
                </span>
                <span class="tl-attach-ic">🔧</span>
                <span class="tl-attach-title">工具调用</span>
                <span v-if="tool.cost_ms" class="tl-cost">{{ fmtCost(tool.cost_ms) }}</span>
                <el-icon :size="12" class="tl-fold-ic"><ArrowDown v-if="!tool._show" /><ArrowUp v-else /></el-icon>
              </div>
              <div v-if="tool._show" class="tl-tool-detail">
                <div class="tl-kv"><span class="tl-k">工具：</span>{{ tool.tool_name }}</div>
                <div v-if="tool.tool_args" class="tl-kv"><span class="tl-k">入参：</span><pre>{{ tool.tool_args }}</pre></div>
                <div v-if="tool.tool_result" class="tl-kv"><span class="tl-k">返回：</span><pre>{{ tool.tool_result }}</pre></div>
              </div>
            </div>

            <!-- 附属：详情（📋，任务收集 / 数据观察） -->
            <div v-if="step.detail" class="tl-attach tl-detail">
              <div class="tl-attach-head clickable" @click="step._showDetail = !step._showDetail">
                <span class="tl-attach-ic">📋</span>
                <span class="tl-attach-title">详情</span>
                <el-icon :size="12" class="tl-fold-ic"><ArrowDown v-if="!step._showDetail" /><ArrowUp v-else /></el-icon>
              </div>
              <div v-if="step._showDetail" class="tl-detail-text">{{ step.detail }}</div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.agent-timeline {
  display: flex;
  flex-direction: column;
}

// ===== 节点行 =====
.tl-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  position: relative;
}

// ------ 优化2：一级节点垂直竖线 ------
.is-stage {
  &::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--neon-cyan);
    opacity: 0.3;
    pointer-events: none;
  }

  &:first-child:not(:only-child)::before { top: 8px; }
  &:last-child:not(:only-child)::before  { bottom: calc(100% - 8px); }
  &:only-child::before                   { display: none; }
}

// ------ 优化3：二级节点缩进(12px) + 配套细分竖线 ------
.is-substep {
  padding-left: 12px;

  &::before {
    content: '';
    position: absolute;
    left: 19px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--neon-cyan);
    opacity: 0.12;
    pointer-events: none;
  }
}

.tl-icon {
  width: 16px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 14px;
  position: relative;
  z-index: 1;
}

.tl-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #00ff88;
  margin-top: 5px;
  flex-shrink: 0;
}

.tl-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tl-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;

  &.clickable {
    cursor: pointer;
    user-select: none;
    &:hover .tl-name { color: var(--neon-cyan); }
  }
}

.tl-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.78);
}

.is-substep .tl-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.62);
}

.tl-cost {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

// 重试次数徽标
.tl-retry {
  font-size: 10px;
  color: #ff9500;
  border: 1px solid rgba(255, 149, 0, 0.4);
  border-radius: 8px;
  padding: 0 6px;
  line-height: 14px;
  flex-shrink: 0;
}

// stage 节点折叠箭头：紧贴名称右侧 8px，不撑到边缘
.tl-stage-fold {
  margin-left: 2px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.35);
  transition: color 0.15s;

  .tl-head.clickable:hover & {
    color: var(--neon-cyan);
  }
}

// ------ 优化1：意图识别独立子行 ------
.tl-intent-row {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 4px;

  em {
    font-style: normal;
    color: var(--neon-cyan);
  }
}

// ---- 状态配色 ----
.tl-running, .tl-in_progress {
  .tl-icon { color: var(--neon-cyan); }
  .tl-name { color: var(--neon-cyan); }
  .tl-dot { background: var(--neon-cyan); }
}
.tl-completed .tl-icon { color: #00ff88; }
.tl-pending {
  .tl-icon { color: rgba(255, 255, 255, 0.35); }
  .tl-name { color: rgba(255, 255, 255, 0.5); }
  .tl-dot { background: rgba(255, 255, 255, 0.35); }
}
.tl-fail, .tl-error {
  .tl-icon { color: #ff4444; }
  .tl-name { color: #ff4444; }
  .tl-dot { background: #ff4444; }
}
.tl-terminated {
  .tl-icon { color: #ff9500; }
  .tl-name { color: rgba(255, 255, 255, 0.4); text-decoration: line-through; }
  .tl-dot { background: #ff9500; }
}

.is-loading { animation: tl-spin 1.4s linear infinite; }
@keyframes tl-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

// ===== 附属子项 =====
.tl-attach {
  margin-left: 10px;
  padding-left: 8px;
  border-left: 1px solid rgba(0, 238, 255, 0.12);
  margin-top: 2px;
}

.tl-attach-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 1px 0;

  &.clickable { cursor: pointer; user-select: none; &:hover { color: var(--neon-cyan); } }
}

.tl-attach-ic { font-size: 11px; }
.tl-attach-title { font-weight: 500; }

// 折叠箭头：紧贴文字右侧 8px，不贴面板边缘
.tl-fold-ic {
  margin-left: 8px;
  flex-shrink: 0;
}

// ------ 优化4：工具调用绿点吸附细分竖线 ------
.tl-tool {
  display: flex;
  flex-direction: column;
  border-left: none;
  padding-left: 0;
  margin-left: 6px;
  position: relative;
}

.tl-tool::before {
  content: '';
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--neon-cyan);
  opacity: 0.12;
  pointer-events: none;
}

.tl-tool-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 1px 0;
  padding-left: 10px;

  &.clickable { cursor: pointer; user-select: none; &:hover { color: var(--neon-cyan); } }
}

.tl-ts-dot {
  position: absolute;
  left: -3px;
  top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 6px;
  z-index: 1;
}

.ts-dot-inner {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  background: rgba(255, 255, 255, 0.4);
}

.ts-completed .ts-dot-inner { background: #00ff88; }
.ts-error .ts-dot-inner, .ts-fail .ts-dot-inner { background: #ff4444; }
.ts-running .ts-dot-inner { border: 1px solid var(--neon-cyan); background: transparent; }

// 思考文本
.tl-thinking-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(0, 238, 255, 0.03);
  padding: 5px 8px;
  border-radius: 4px;
  margin-top: 2px;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.5;

  // 自定义细滚动条：配色走主题变量，适配深色主题（仅作用于思考块）
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;
    &:hover { background: var(--scrollbar-thumb-hover); }
  }
}

// 工具展开详情
.tl-tool-detail {
  margin-top: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-left: 10px;
}
.tl-kv { margin: 2px 0; }
.tl-k { color: rgba(255, 255, 255, 0.4); }
.tl-tool-detail pre {
  margin: 2px 0 0;
  padding: 5px 8px;
  background: rgba(0, 238, 255, 0.03);
  border-radius: 4px;
  max-height: 160px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 10px;
  color: var(--neon-cyan);
}

.tl-detail-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(0, 238, 255, 0.03);
  padding: 5px 8px;
  border-radius: 4px;
  margin-top: 2px;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.5;
}
</style>
