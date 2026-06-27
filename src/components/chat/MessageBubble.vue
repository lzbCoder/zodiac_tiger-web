<script setup lang="ts">
import type { ChatMessage } from '@/stores/chat'
import { useChatStore, REPLY_NODE_NAMES } from '@/stores/chat'
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { ElMessage } from 'element-plus'
import { CopyDocument, Check, Loading, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { copyText } from '@/utils'
import * as echarts from 'echarts'
import AgentFlow from './AgentFlow.vue'
import ChatAlert from './ChatAlert.vue'

const store = useChatStore()

const props = defineProps<{
  message: ChatMessage
  msgIndex: number
}>()

const isUser = computed(() => props.message.role === 'user')
const isAi = computed(() => props.message.role === 'ai')
const hasSteps = computed(() => isAi.value && props.message.steps && props.message.steps.length > 0)

// ---- 最终回复思维链（展示在主页面，独立于执行流程时间线）----
const REPLY_NODE_SET = new Set<string>(REPLY_NODE_NAMES as readonly string[])
const replyThinking = computed(() => {
  const steps = props.message.steps
  if (!isAi.value || !steps) return null
  for (const s of steps) {
    if (s.thinking && s.thinking.content && REPLY_NODE_SET.has(s.name || s.step)) return s.thinking
  }
  return null
})
// 主页面思考块的折叠状态：默认展开，用户可手动折叠
const reasoningCollapsed = ref(false)

// 终止/异常提示：命中后用 ChatAlert 替代 Markdown 渲染
const ALERT_TEXTS = ['（任务已被手动终止）', '任务执行异常，请检查错误日志，稍后重试！']
const isAlert = computed(() => isAi.value && ALERT_TEXTS.includes((props.message.content || '').trim()))
const isSelected = computed(() => store.selectedMsgIndex === props.msgIndex)

function handleSelect() {
  if (hasSteps.value) {
    store.selectMsgIndex(props.msgIndex)
  }
}

// ---- 整条消息复制 ----
const copied = ref(false)

async function copyMessage() {
  const ok = await copyText(props.message.content || '')
  if (ok) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } else {
    ElMessage.error('复制失败')
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
      const ok = await copyText(block.textContent || '')
      if (ok) {
        btn.textContent = '已复制'
        setTimeout(() => { btn.textContent = '复制' }, 2000)
      } else {
        btn.textContent = '失败'
        setTimeout(() => { btn.textContent = '复制' }, 2000)
      }
    }
    pre.style.position = 'relative'
    pre.appendChild(btn)
  })
}

// ---- 表格 → 图表增强 ----
function parseTableData(tableEl: HTMLTableElement): { headers: string[]; rows: string[][] } | null {
  const headers: string[] = []
  const rows: string[][] = []
  const ths = tableEl.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td')
  ths.forEach(th => headers.push(th.textContent?.trim() || ''))
  const bodyRows = tableEl.querySelectorAll('tr')
  bodyRows.forEach((tr, idx) => {
    if (idx === 0 && tableEl.querySelector('thead')) return
    const cells: string[] = []
    tr.querySelectorAll('td, th').forEach(td => cells.push(td.textContent?.trim() || ''))
    if (cells.length > 0 && cells.some(c => c !== '')) rows.push(cells)
  })
  if (headers.length === 0 || rows.length === 0) return null
  return { headers, rows }
}

function isNumericColumn(rows: string[][], colIdx: number): boolean {
  return rows.every(r => {
    const raw = r[colIdx]
    if (raw === undefined || raw === '' || raw === '-' || raw === '—') return false
    // 去除逗号、百分号、加号、货币符号、中文数量单位（万、亿、千）、汉字
    let cleaned = raw
      .replace(/,/g, '')
      .replace(/%/g, '')
      .replace(/¥|￥|\$|€|£/g, '')
      .replace(/[万亿千]/g, '')
      .replace(/[元个件套台]/g, '')
      .replace(/[＋＋＋]/g, '')
      .trim()
    // 去掉前导 + 号（"-3" keep, "+15" → "15"）
    if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)
    return cleaned !== '' && !isNaN(Number(cleaned))
  })
}

function detectChartType(headers: string[], rows: string[][]): 'bar' | 'line' | 'pie' {
  const firstCol = headers[0]?.toLowerCase() || ''
  const timeKeywords = ['年', '月', '日', '季度', 'week', 'month', 'year', 'date', 'time']
  const isTimeSeries = timeKeywords.some(k => firstCol.includes(k))
  if (isTimeSeries) return 'line'
  // 检查数值列中是否有 % 号，或值之和接近 100 → 饼图
  for (let c = 1; c < headers.length; c++) {
    if (!isNumericColumn(rows, c)) continue
    let hasPercent = false
    let sum = 0
    rows.forEach(r => {
      const valStr = r[c] || ''
      if (valStr.includes('%')) hasPercent = true
      sum += parseFloat(valStr.replace(/,/g, '')) || 0
    })
    if (hasPercent || (sum > 90 && sum < 110)) return 'pie'
  }
  return 'bar'
}

let chartInstances: Map<HTMLElement, echarts.ECharts> = new Map()

function enhanceTables() {
  const container = aiContentRef.value
  if (!container) { console.warn('enhanceTables: aiContentRef is null'); return }

  const tables = container.querySelectorAll('table:not([data-enhanced])')
  console.log('enhanceTables: found', tables.length, 'unenhanced tables')
  tables.forEach(tableEl => {
    try {
      const parsed = parseTableData(tableEl as HTMLTableElement)
      if (!parsed) { console.log('enhanceTables: parseTableData returned null'); return }
      const { headers, rows } = parsed
      console.log('enhanceTables: headers=', headers, 'rows=', rows.length)

      // 找到数值列和标签列
      const numericCols: number[] = []
      for (let c = 1; c < headers.length; c++) {
        if (isNumericColumn(rows, c)) numericCols.push(c)
      }
      console.log('enhanceTables: numericCols=', numericCols)
      if (numericCols.length === 0) {
        (tableEl as HTMLTableElement).setAttribute('data-enhanced', 'skip')
        return
      }

    tableEl.setAttribute('data-enhanced', 'true')
    const labelCol = 0

    // 构建 wrapper 并替换 table（replaceChild 一步到位，避免 insertBefore 链式问题）
    const wrapper = document.createElement('div')
    wrapper.className = 'data-table-wrap'
    wrapper.innerHTML = `
      <div class="dt-toggle-bar">
        <button class="dt-btn active" data-view="table">📋 表格</button>
        <button class="dt-btn" data-view="chart">📊 图表</button>
      </div>
      <div class="dt-chart-area" style="display:none;"></div>
      <div class="dt-table-area"></div>
    `
    tableEl.parentNode?.replaceChild(wrapper, tableEl)
    const tableArea = wrapper.querySelector('.dt-table-area') as HTMLDivElement
    tableArea.appendChild(tableEl as HTMLElement)
    const toggleBar = wrapper.querySelector('.dt-toggle-bar') as HTMLDivElement
    const btnTable = toggleBar.querySelector('[data-view="table"]') as HTMLButtonElement
    const btnChart = toggleBar.querySelector('[data-view="chart"]') as HTMLButtonElement
    const chartArea = wrapper.querySelector('.dt-chart-area') as HTMLDivElement

    // toggle logic
    const showTable = () => {
      chartInstances.get(chartArea)?.dispose()
      chartInstances.delete(chartArea)
      chartArea.style.display = 'none'
      tableArea.style.display = ''
      btnTable.classList.add('active')
      btnChart.classList.remove('active')
    }
    const showChart = () => {
      tableArea.style.display = 'none'
      chartArea.style.display = ''
      btnChart.classList.add('active')
      btnTable.classList.remove('active')

      if (!chartInstances.has(chartArea)) {
        const chart = echarts.init(chartArea)
        chartInstances.set(chartArea, chart)

        const chartType = detectChartType(headers, rows)
        const labels = rows.map(r => r[labelCol] || '')
        const seriesData: any[] = []
        const series: any[] = []

        numericCols.forEach((c, si) => {
          const values = rows.map(r => parseFloat(r[c]?.replace(/,/g, '')) || 0)
          if (chartType === 'pie') {
            // 饼图：取第一个数值列
            if (si === 0) {
              labels.forEach((name, i) => {
                seriesData.push({ name, value: values[i] })
              })
              series.push({
                name: headers[c],
                type: 'pie',
                data: seriesData,
                label: { show: true, formatter: '{b}: {d}%' },
              })
            }
          } else {
            seriesData.push({ name: headers[c], type: chartType, data: values })
          }
        })

        const option: any = {
          tooltip: { trigger: chartType === 'pie' ? 'item' : 'axis' },
          grid: { left: 50, right: 20, top: 40, bottom: 40 },
        }
        if (chartType === 'pie') {
          option.series = series
        } else {
          option.xAxis = { type: 'category', data: labels, axisLabel: { rotate: labels.length > 6 ? 45 : 0 } }
          option.yAxis = { type: 'value' }
          option.series = seriesData
        }

        chart.setOption(option)
        const ro = new ResizeObserver(() => chart.resize())
        ro.observe(chartArea)
        ;(chart as any)._resizeObserver = ro
      }
    }

    btnTable.onclick = showTable
    btnChart.onclick = showChart
    } catch (e) { console.error('enhanceTables table error:', e) }
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

onMounted(() => { nextTick(() => { attachCopyButtons(); if (!store.isStreaming) enhanceTables() }) })
// 流式期间只做复制按钮（v-html 每次 patch 会摧毁 DOM 修改）
// 流结束后触发表格增强
watch(() => props.message.content, () => { nextTick(attachCopyButtons) })
watch(() => store.isStreaming, (val) => {
  if (!val) nextTick(() => enhanceTables())
})
</script>

<template>
  <div class="message-row" :class="{ 'is-user': isUser, 'is-ai': isAi }">
    <!-- 用户消息：保留气泡框 -->
    <div v-if="isUser" class="msg-col">
      <div class="user-bubble">
        {{ message.content }}
      </div>
      <div class="msg-actions">
        <button class="msg-copy-btn" :title="copied ? '已复制' : '复制'" @click="copyMessage">
          <el-icon :size="14"><Check v-if="copied" /><CopyDocument v-else /></el-icon>
        </button>
      </div>
    </div>

    <!-- AI 消息：纯 Markdown 文本流 -->
    <div v-else-if="isAi" class="msg-col">
      <div
        class="ai-content"
        :class="{ selectable: hasSteps, selected: isSelected }"
        @click="handleSelect"
      >
        <AgentFlow
          v-if="hasSteps"
          :steps="message.steps!"
        />

        <!-- 最终回复思维链：主页面展示，默认展开，可手动折叠 -->
        <div v-if="replyThinking" class="reply-reasoning" @click.stop>
          <div class="rr-head" @click="reasoningCollapsed = !reasoningCollapsed">
            <span class="rr-ic">💭</span>
            <span class="rr-title">思考过程</span>
            <span v-if="replyThinking.cost_ms" class="rr-cost">{{ (replyThinking.cost_ms / 1000).toFixed(1) }}s</span>
            <el-icon v-if="replyThinking.status === 'running'" class="is-loading rr-spin" :size="12"><Loading /></el-icon>
            <el-icon :size="13" class="rr-fold"><ArrowDown v-if="reasoningCollapsed" /><ArrowUp v-else /></el-icon>
          </div>
          <div v-if="!reasoningCollapsed" class="rr-text">{{ replyThinking.content }}</div>
        </div>

        <!-- 终止/异常：统一提示框（替代 Markdown） -->
        <ChatAlert
          v-if="isAlert"
          :content="message.content"
          :chat-id="message.chatId"
        />
        <div
          v-else
          ref="aiContentRef"
          class="markdown-body"
          @click="onMarkdownClick"
          v-html="renderedHtml"
        />
      </div>
      <div v-if="!store.isStreaming && message.content" class="msg-actions">
        <button class="msg-copy-btn" :title="copied ? '已复制' : '复制'" @click="copyMessage">
          <el-icon :size="14"><Check v-if="copied" /><CopyDocument v-else /></el-icon>
        </button>
      </div>
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

// ---- 消息列（气泡/正文 + 操作栏） ----
.msg-col {
  display: flex;
  flex-direction: column;

  .is-user & {
    max-width: 75%;
    align-items: flex-end;
  }

  .is-ai & {
    width: 100%;
    align-items: flex-start;
  }
}

// ---- 复制等操作栏 ----
.msg-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  height: 22px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-row:hover .msg-actions {
  opacity: 1;
}

.msg-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px 6px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--neon-cyan);
    border-color: rgba(var(--color-primary-rgb), 0.3);
    background: rgba(var(--color-primary-rgb), 0.06);
  }
}

// ---- 用户气泡（保留） ----
.user-bubble {
  max-width: 100%;
  padding: 12px 16px;
  font-size: 15px;
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

// ---- 最终回复思维链（主页面折叠块，样式与"Agent 执行流程"一致）----
.reply-reasoning {
  margin: 4px 0 10px;
}

.rr-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--text-tertiary);
  transition: color 0.2s;

  &:hover { color: var(--neon-cyan); }
}

.rr-ic { font-size: 14px; flex-shrink: 0; }
.rr-title { font-weight: 500; }
.rr-cost { font-size: 11px; color: var(--text-placeholder); flex-shrink: 0; }
.rr-fold { flex-shrink: 0; }
.rr-spin { animation: rr-spin 1.4s linear infinite; }
@keyframes rr-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

.rr-text {
  margin-top: 4px;
  padding: 8px 10px;
  background: rgba(var(--color-primary-rgb), 0.03);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-tertiary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow-y: auto;

  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }
}

// ---- Markdown 渲染样式 ----
// ---- 工具调用折叠栏 ----
.tool-calls-section {
  margin: 8px 0;
  border: 1px solid rgba(var(--color-primary-rgb), 0.12);
  border-radius: 8px;
  overflow: hidden;
}

.tool-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-tertiary);
  user-select: none;
  transition: background 0.15s;

  &:hover { background: rgba(var(--color-primary-rgb), 0.04); }
}

.tool-details {
  border-top: 1px solid rgba(var(--color-primary-rgb), 0.08);
}

.tool-item {
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid rgba(var(--color-primary-rgb), 0.04);

  &:last-child { border-bottom: none; }
}

.tool-status { margin-right: 6px; }

.tool-name {
  color: var(--text-secondary);
  font-weight: 500;
}

.tool-cost {
  color: var(--text-placeholder);
  font-size: 12px;
  margin-left: 8px;
}

.tool-args {
  font-size: 12px;
  color: var(--text-placeholder);
  font-family: 'Consolas', monospace;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.markdown-body {
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-body);
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
  :deep(h2) { font-size: 18px; border-bottom: 1px solid rgba(var(--color-primary-rgb), 0.12); padding-bottom: 6px; }
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
    border-left: 3px solid rgba(var(--color-primary-rgb), 0.3);
    background: rgba(var(--color-primary-rgb), 0.04);
    border-radius: 0 6px 6px 0;
    color: var(--text-secondary);
    font-style: italic;

    p { margin: 0; }
  }

  // 代码块
  :deep(pre) {
    background: var(--bg-code);
    border: 1px solid rgba(var(--color-primary-rgb), 0.18);
    border-radius: 8px;
    padding: 14px 16px;
    margin: 10px 0;
    overflow-x: auto;
  }

  :deep(pre code) {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: var(--neon-cyan);
    background: transparent;
    padding: 0;
  }

  // 行内代码
  :deep(code:not(pre code)) {
    background: rgba(var(--color-primary-rgb), 0.1);
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
    font-size: 14px;
  }

  :deep(th), :deep(td) {
    border: 1px solid rgba(var(--color-primary-rgb), 0.12);
    padding: 8px 12px;
    text-align: left;
  }

  :deep(th) {
    background: rgba(var(--color-primary-rgb), 0.08);
    color: var(--neon-cyan);
    font-weight: 600;
  }

  :deep(tr:hover td) {
    background: rgba(var(--color-primary-rgb), 0.03);
  }

  // 链接
  :deep(a) {
    color: var(--neon-cyan);
    text-decoration: none;
    border-bottom: 1px dotted rgba(var(--color-primary-rgb), 0.3);

    &:hover {
      border-bottom-style: solid;
    }
  }

  // 分隔线
  :deep(hr) {
    border: none;
    border-top: 1px solid rgba(var(--color-primary-rgb), 0.1);
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
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-code);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.code-copy-btn:hover {
  color: var(--neon-cyan);
  border-color: rgba(var(--color-primary-rgb), 0.3);
  background: var(--bg-muted);
}

/* ---- 表格 → 图表增强 ----
 * 这些样式不能加 scoped，因为 enhanceTables 创建的 DOM 在 markdown-body 外部
 */
.data-table-wrap {
  margin: 12px 0;
  border: 1px solid rgba(var(--color-primary-rgb), 0.15);
  border-radius: 8px;
  overflow: hidden;
  animation: fadeIn 0.3s ease;
}

.dt-toggle-bar {
  display: flex;
  gap: 0;
  background: var(--bg-muted);
  border-bottom: 1px solid rgba(var(--color-primary-rgb), 0.1);
}

.dt-btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.dt-btn:hover {
  color: var(--text-secondary);
  background: rgba(var(--color-primary-rgb), 0.05);
}

.dt-btn.active {
  color: var(--neon-cyan);
  background: rgba(var(--color-primary-rgb), 0.08);
}

.dt-chart-area {
  height: 300px;
  padding: 8px;
}

.dt-table-area {
  padding: 4px;
}

.dt-table-area table {
  margin: 0 !important;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
