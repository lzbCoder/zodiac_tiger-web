<script setup lang="ts">
import type { ChatMessage } from '@/stores/chat'
import { useChatStore } from '@/stores/chat'
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { ElMessage } from 'element-plus'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import AgentFlow from './AgentFlow.vue'

const store = useChatStore()

const props = defineProps<{
  message: ChatMessage
  msgIndex: number
}>()

const isUser = computed(() => props.message.role === 'user')
const isAi = computed(() => props.message.role === 'ai')
const hasSteps = computed(() => isAi.value && props.message.steps && props.message.steps.length > 0)
const isSelected = computed(() => store.selectedMsgIndex === props.msgIndex)
const showTools = ref(false)
// ---- 图表渲染 ----
watch(() => props.message.charts, async (charts) => {
  if (!charts || charts.length === 0 || !aiContentRef.value) return
  await nextTick()
  const html = aiContentRef.value.innerHTML
  let chartIdx = 0
  const finalHtml = html.replace(
    /(<h[23][^>]*>[\s]*(?:图表展示|图表建议|Chart)[\s]*<\/h[23]>)/gi,
    (match) => {
      let inserts = ''
      for (let i = 0; i < charts.length; i++) {
        inserts += `<div class="chart-box" data-chart-idx="${chartIdx++}" style="height:280px;margin:12px 0"></div>`
      }
      return match + inserts
    }
  )
  aiContentRef.value.innerHTML = finalHtml
  const boxes = aiContentRef.value.querySelectorAll('.chart-box')
  boxes.forEach((el) => {
    const idx = parseInt(el.getAttribute('data-chart-idx') || '0')
    if (charts[idx]) {
      const chart = echarts.init(el as HTMLElement)
      chart.setOption(charts[idx])
      const ro = new ResizeObserver(() => chart.resize())
      ro.observe(el as HTMLElement)
    }
  })
}, { immediate: true })

const toolSteps = computed(() => {
  return (props.message.steps || []).filter(s => s.status === 'running' || s.status === 'completed')
    .filter(s => (s as any).tool_args !== undefined || s.name?.startsWith('web_search') || s.name?.startsWith('tavily'))
})

function handleSelect() {
  if (hasSteps.value) {
    store.selectMsgIndex(props.msgIndex)
  }
}

// ---- Markdown 渲染 ----
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const renderedHtml = computed(() => {
  if (isUser.value) return ''
  return md.render(props.message.content || '')
})

// ---- 代码块复制 ----
const aiContentRef = ref<HTMLElement>()

function attachCopyButtons() {
  if (!aiContentRef.value) return
  const blocks = aiContentRef.value.querySelectorAll('pre code')
  blocks.forEach((block) => {
    const pre = block.parentElement
    if (!pre || pre.querySelector('.code-copy-btn')) return
    const btn = document.createElement('button')
    btn.className = 'code-copy-btn'
    btn.textContent = '复制'
    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(block.textContent || '')
        btn.textContent = '已复制'
        setTimeout(() => { btn.textContent = '复制' }, 2000)
      } catch {
        btn.textContent = '失败'
        setTimeout(() => { btn.textContent = '复制' }, 2000)
      }
    }
    pre.style.position = 'relative'
    pre.appendChild(btn)
  })
}

function onMarkdownClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('/api/file/download/')) {
    e.preventDefault()
    const href = target.getAttribute('href')!
    fetch(href)
      .then(res => {
        if (res.headers.get('content-type')?.includes('application/json')) {
          return res.json().then(data => {
            if ((data as any).code !== 0) {
              ElMessage.warning((data as any).message || '该文件已被删除，请检查后重试')
            }
          })
        }
        // 文件存在 → 触发浏览器下载
        return res.blob().then(blob => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = target.textContent || 'download'
          a.click()
          URL.revokeObjectURL(url)
        })
      })
      .catch(() => {
        ElMessage.warning('该文件已被删除，请检查后重试')
      })
  }
}

onMounted(() => { nextTick(attachCopyButtons) })
watch(() => props.message.content, () => { nextTick(attachCopyButtons) })
</script>

<template>
  <div class="message-row" :class="{ 'is-user': isUser, 'is-ai': isAi }">
    <!-- 用户消息：保留气泡框 -->
    <div v-if="isUser" class="user-bubble">
      {{ message.content }}
    </div>

    <!-- AI 消息：纯 Markdown 文本流 -->
    <div
      v-else-if="isAi"
      class="ai-content"
      :class="{ selectable: hasSteps, selected: isSelected }"
      @click="handleSelect"
    >
      <AgentFlow
        v-if="hasSteps"
        :steps="message.steps!"
      />
      <!-- 工具调用折叠栏 -->
      <div v-if="toolSteps.length > 0" class="tool-calls-section">
        <div class="tool-toggle" @click="showTools = !showTools">
          <span>🔧 调用工具 ({{ toolSteps.length }})</span>
          <el-icon :size="14"><ArrowDown v-if="!showTools"/><ArrowUp v-else/></el-icon>
        </div>
        <div v-if="showTools" class="tool-details">
          <div v-for="(t, i) in toolSteps" :key="i" class="tool-item">
            <span class="tool-status">{{ t.status === 'completed' ? '✅' : '⏳' }}</span>
            <span class="tool-name">{{ t.name || t.step }}</span>
            <span v-if="t.cost_ms" class="tool-cost">{{ (t.cost_ms / 1000).toFixed(1) }}s</span>
            <div v-if="t.tool_args" class="tool-args" :title="t.tool_args">
              入参：{{ t.tool_args.slice(0, 120) }}{{ t.tool_args.length > 120 ? '...' : '' }}
            </div>
          </div>
        </div>
      </div>
      <div
        ref="aiContentRef"
        class="markdown-body"
        @click="onMarkdownClick"
        v-html="renderedHtml"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.message-row {
  display: flex;
  margin-bottom: 20px;

  &.is-user {
    justify-content: flex-end;
  }

  &.is-ai {
    justify-content: flex-start;
  }
}

// ---- 用户气泡（保留） ----
.user-bubble {
  max-width: 75%;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  word-break: break-word;
  background: linear-gradient(135deg, rgba(123, 97, 255, 0.3), rgba(123, 97, 255, 0.1));
  border: 1px solid rgba(123, 97, 255, 0.2);
  border-radius: 12px 4px 12px 12px;
}

// ---- AI 纯文本流 ----
.ai-content {
  width: 100%;
  padding: 0;

  &.selectable {
    cursor: pointer;
  }

  &.selected {
    box-shadow: none;
  }
}

// ---- Markdown 渲染样式 ----
// ---- 工具调用折叠栏 ----
.tool-calls-section {
  margin: 8px 0;
  border: 1px solid rgba(0, 238, 255, 0.12);
  border-radius: 8px;
  overflow: hidden;
}

.tool-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  user-select: none;
  transition: background 0.15s;

  &:hover { background: rgba(0, 238, 255, 0.04); }
}

.tool-details {
  border-top: 1px solid rgba(0, 238, 255, 0.08);
}

.tool-item {
  padding: 8px 12px;
  font-size: 12px;
  border-bottom: 1px solid rgba(0, 238, 255, 0.04);

  &:last-child { border-bottom: none; }
}

.tool-status { margin-right: 6px; }

.tool-name {
  color: rgba(255, 255, 255, 0.75);
  font-weight: 500;
}

.tool-cost {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  margin-left: 8px;
}

.tool-args {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'Consolas', monospace;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.markdown-body {
  font-size: 14px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.78);
  word-break: break-word;

  // 标题
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    color: var(--text-primary);
    margin: 20px 0 10px;
    font-weight: 600;
    line-height: 1.4;

    &:first-child { margin-top: 0; }
  }

  :deep(h1) { font-size: 20px; }
  :deep(h2) { font-size: 18px; border-bottom: 1px solid rgba(0, 238, 255, 0.12); padding-bottom: 6px; }
  :deep(h3) { font-size: 16px; }

  // 段落
  :deep(p) {
    margin: 6px 0;
    &:first-child { margin-top: 0; }
  }

  // 加粗 / 斜体 / 删除线
  :deep(strong) { color: var(--neon-cyan); font-weight: 600; }
  :deep(em) { font-style: italic; }
  :deep(del) { opacity: 0.5; }

  // 引用块
  :deep(blockquote) {
    margin: 10px 0;
    padding: 8px 14px;
    border-left: 3px solid rgba(0, 238, 255, 0.3);
    background: rgba(0, 238, 255, 0.04);
    border-radius: 0 6px 6px 0;
    color: rgba(255, 255, 255, 0.65);
    font-style: italic;

    p { margin: 0; }
  }

  // 代码块
  :deep(pre) {
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(0, 238, 255, 0.18);
    border-radius: 8px;
    padding: 14px 16px;
    margin: 10px 0;
    overflow-x: auto;
  }

  :deep(pre code) {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--neon-cyan);
    background: transparent;
    padding: 0;
  }

  // 行内代码
  :deep(code:not(pre code)) {
    background: rgba(0, 238, 255, 0.1);
    color: var(--neon-cyan);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 85%;
  }

  // 列表
  :deep(ul), :deep(ol) {
    padding-left: 24px;
    margin: 8px 0;
  }

  :deep(li) { margin: 3px 0; }

  :deep(input[type="checkbox"]) {
    margin-right: 6px;
    accent-color: var(--neon-cyan);
  }

  // 表格
  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 13px;
  }

  :deep(th), :deep(td) {
    border: 1px solid rgba(0, 238, 255, 0.12);
    padding: 8px 12px;
    text-align: left;
  }

  :deep(th) {
    background: rgba(0, 238, 255, 0.08);
    color: var(--neon-cyan);
    font-weight: 600;
  }

  :deep(tr:hover td) {
    background: rgba(0, 238, 255, 0.03);
  }

  // 链接
  :deep(a) {
    color: var(--neon-cyan);
    text-decoration: none;
    border-bottom: 1px dotted rgba(0, 238, 255, 0.3);

    &:hover {
      border-bottom-style: solid;
    }
  }

  // 分隔线
  :deep(hr) {
    border: none;
    border-top: 1px solid rgba(0, 238, 255, 0.1);
    margin: 16px 0;
  }

  // 图片
  :deep(img) {
    max-width: 100%;
    border-radius: 6px;
    margin: 8px 0;
  }
}

// 代码复制按钮（全局样式不加 scoped）
</style>

<style>
.code-copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.code-copy-btn:hover {
  color: var(--neon-cyan);
  border-color: rgba(0, 238, 255, 0.3);
  background: rgba(0, 0, 0, 0.7);
}
</style>
