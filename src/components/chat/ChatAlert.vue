<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { WarningFilled } from '@element-plus/icons-vue'
import { getErrorLog, diagnoseError } from '@/api/chat'

const props = defineProps<{
  content: string
  chatId?: string
}>()

// 文案常量（与后端/ChatView 兜底文案保持一致）
const ABORT_TEXT = '（任务已被手动终止）'
const ERROR_TEXT = '任务执行异常，请检查错误日志，稍后重试！'

const kind = computed<'abort' | 'error' | null>(() => {
  if (props.content === ABORT_TEXT) return 'abort'
  if (props.content === ERROR_TEXT) return 'error'
  return null
})

// 错误详情（来自 execution_error_log）
interface ErrInfo {
  id: number
  error_node_display_name: string
  exception_type: string
  exception_info: string
  exception_stack: string
  ai_diagnosis: string | null
}
const errInfo = ref<ErrInfo | null>(null)
const dialogVisible = ref(false)

// AI 诊断状态
const diagnosing = ref(false)        // 诊断进行中（按钮加载动画）
const diagnosis = ref('')            // 诊断结果 markdown 文本

async function loadError() {
  if (kind.value !== 'error' || !props.chatId) return
  try {
    const res = await getErrorLog(props.chatId)
    const list = (res as any).data || []
    // 取最后一条（最贴近本轮失败节点）
    if (list.length > 0) {
      errInfo.value = list[list.length - 1]
      // 回显：已有诊断结果则直接展示，按钮初始即为「已诊断」
      diagnosis.value = errInfo.value?.ai_diagnosis || ''
    }
  } catch {
    // 静默：详情查询失败不影响主提示展示
  }
}

onMounted(loadError)

// 触发/重新触发 AI 诊断：首次与「已诊断」态重复点击共用此逻辑
async function runDiagnose() {
  if (!errInfo.value?.id || diagnosing.value) return
  diagnosing.value = true
  try {
    const res = await diagnoseError(errInfo.value.id)
    diagnosis.value = (res as any).data?.diagnosis || ''
  } catch {
    // 失败由全局拦截器提示，保留旧结果不清空
  } finally {
    diagnosing.value = false
  }
}

// 诊断结果 markdown 渲染
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const diagnosisHtml = computed(() => (diagnosis.value ? md.render(diagnosis.value) : ''))

// 行内小字：type / info
const inlineSubtext = computed(() => {
  if (!errInfo.value) return ''
  const t = errInfo.value.exception_type || ''
  const i = errInfo.value.exception_info || ''
  return [t, i].filter(Boolean).join(' / ')
})

function openDetail() {
  if (kind.value !== 'error') return
  dialogVisible.value = true
}
</script>

<template>
  <!-- 场景1：手动终止（黄色，无详情，仅展示） -->
  <div v-if="kind === 'abort'" class="chat-alert alert-abort">
    <el-icon class="alert-icon" :size="18"><WarningFilled /></el-icon>
    <span class="alert-title">任务已被手动终止</span>
  </div>

  <!-- 场景2：任务执行异常（红色）。点击容器不拦截 → 冒泡触发右侧执行面板；
       仅「详情」按钮 @click.stop 打开弹窗，互不冲突。 -->
  <div v-else-if="kind === 'error'" class="chat-alert alert-error">
    <el-icon class="alert-icon" :size="18"><WarningFilled /></el-icon>
    <div class="alert-main">
      <div class="alert-title">任务执行异常，请检查错误日志，稍后重试！</div>
      <div v-if="inlineSubtext" class="alert-subtext">{{ inlineSubtext }}</div>
    </div>
    <span class="alert-detail-btn" @click.stop="openDetail">详情</span>
  </div>

  <!-- 错误详情弹窗 -->
  <el-dialog
    v-model="dialogVisible"
    title="错误详情"
    width="640px"
    :append-to-body="true"
    class="error-detail-dialog"
  >
    <div class="err-field">
      <label>出错步骤</label>
      <el-input :model-value="errInfo?.error_node_display_name || '—'" readonly />
    </div>
    <div class="err-field">
      <label>错误名称</label>
      <el-input :model-value="errInfo?.exception_type || '—'" readonly />
    </div>
    <div class="err-field">
      <label>错误信息</label>
      <el-input
        :model-value="errInfo?.exception_info || '—'"
        type="textarea"
        :rows="2"
        readonly
      />
    </div>
    <div class="err-field">
      <label>堆栈信息</label>
      <el-input
        :model-value="errInfo?.exception_stack || '无堆栈信息'"
        type="textarea"
        :rows="14"
        readonly
        class="err-stack"
      />
    </div>

    <!-- AI 诊断结果面板：固定置于堆栈模块下方，独立深色区域，与上方字段分层隔离 -->
    <div v-if="diagnosisHtml" class="ai-diagnosis-panel">
      <div class="ai-diagnosis-title">AI 诊断结果</div>
      <div class="ai-diagnosis-body markdown-body" v-html="diagnosisHtml"></div>
    </div>

    <!-- 右下角 AI 诊断按钮：加载态等待诊断完成；已有结果时文案变「已诊断」且可重复点击刷新 -->
    <template #footer>
      <el-button
        type="primary"
        :loading="diagnosing"
        @click="runDiagnose"
      >
        {{ diagnosing ? '诊断中' : (diagnosis ? '已诊断' : 'AI 诊断') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.chat-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  width: 100%;
}

.alert-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-main {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-weight: 500;
}

.alert-subtext {
  margin-top: 4px;
  font-size: 13px;
  color: #999999;
  word-break: break-all;
}

// 场景1：手动终止（黄）
.alert-abort {
  border: 1px solid #ffd048;
  background: rgba(255, 208, 72, 0.06);
  cursor: default;

  .alert-icon, .alert-title { color: #ffd048; }
}

// 场景2：异常（红）
.alert-error {
  border: 1px solid #ff4d4f;
  background: rgba(255, 77, 79, 0.06);

  .alert-icon, .alert-title { color: #ff4d4f; }
}

.alert-detail-btn {
  flex-shrink: 0;
  align-self: flex-end;
  font-size: 14px;
  color: #ff4d4f;
  cursor: pointer;
  text-decoration: underline;
  user-select: none;
}

// 弹窗字段
.err-field {
  margin-bottom: 14px;

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  }
}

</style>

<!-- 非 scoped：el-dialog append-to-body 后内部 DOM 在组件作用域外，
     scoped :deep 对 teleport 的 el-plus 内部元素不可靠，故用全局类锚点覆盖 -->
<style lang="scss">
.error-detail-dialog .err-stack .el-textarea__inner {
  color: #ff4d4f !important;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
}

// AI 诊断结果：独立面板，沿用系统主题色（CSS 变量，随深/浅主题自适应），
// 绿色（系统成功色）边框作为诊断结果的视觉标识，与上方错误字段分层隔离。
.error-detail-dialog .ai-diagnosis-panel {
  margin-top: 16px;
  border: 1px solid rgba(var(--color-success-rgb), 0.45);
  border-radius: 8px;
  background: rgba(var(--color-success-rgb), 0.05);
  box-shadow: 0 0 12px rgba(var(--color-success-rgb), 0.12);
  overflow: hidden;
}

.error-detail-dialog .ai-diagnosis-title {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success);
  background: rgba(var(--color-success-rgb), 0.1);
  border-bottom: 1px solid rgba(var(--color-success-rgb), 0.25);
}

.error-detail-dialog .ai-diagnosis-body {
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-body);
  max-height: 360px;
  overflow-y: auto;
  word-break: break-word;

  h2 {
    margin: 12px 0 8px;
    font-size: 15px;
    color: var(--text-primary);
  }
  h2:first-child { margin-top: 0; }

  p { margin: 6px 0; }

  ol, ul {
    margin: 6px 0;
    padding-left: 22px;
  }
  li { margin: 4px 0; }

  code {
    padding: 2px 5px;
    border-radius: 4px;
    background: var(--bg-code);
    color: var(--text-highlight);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }
}
</style>
