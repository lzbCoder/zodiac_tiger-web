<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Promotion, Connection, Cpu, ArrowDown } from '@element-plus/icons-vue'
import { useChatStore, REPLY_MODELS, DEFAULT_REPLY_MODEL } from '@/stores/chat'
import { useIntentDisplayStore } from '@/stores/intent_display'

const emit = defineEmits<{
  send: [text: string, enableSearch: boolean]
  stop: []
}>()

const chatStore = useChatStore()
const intentStore = useIntentDisplayStore()

const inputText = ref('')
const enableSearch = ref(false)
// 兜底：store 异常时也始终展示一个模型名，避免触发器空白
const currentModel = computed(() => chatStore.replyModel || DEFAULT_REPLY_MODEL)
const canSend = computed(() => inputText.value.trim().length > 0 && !chatStore.isStreaming)

const placeholderText = computed(() => {
  const names = intentStore.list
    .filter(i => i.enable)
    .map(i => i.show_name.replace(/^[^\s]+\s/, ''))
  if (names.length > 0) {
    return `可发起「${names.join('」「')}」等需求，点击上方快捷按钮快速体验`
  }
  return '输入您的问题，Enter 发送，Shift+Enter 换行'
})

watch(() => chatStore.prefillText, (val) => {
  if (val) {
    inputText.value = val
    chatStore.setPrefill('')
    nextTick(() => {
      const textarea = document.querySelector('.chat-textarea') as HTMLTextAreaElement
      textarea?.focus()
    })
  }
})

function toggleSearch() {
  enableSearch.value = !enableSearch.value
}

function onSelectModel(model: string) {
  chatStore.setReplyModel(model)
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text || chatStore.isStreaming) return
  emit('send', text, enableSearch.value)
  inputText.value = ''
}

function handleStop() {
  emit('stop')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (canSend.value) handleSend()
  }
}
</script>

<template>
  <div class="chat-input-wrapper">
    <div class="chat-input-inner">
      <div class="chat-input-box">
        <div class="input-row">
          <textarea
            v-model="inputText"
            class="chat-textarea"
            :placeholder="placeholderText"
            rows="3"
            @keydown="handleKeydown"
          />
        </div>
        <div class="input-toolbar">
          <button class="search-toggle" :class="{ active: enableSearch }" @click="toggleSearch">
            <el-icon :size="14"><Connection /></el-icon>
            <span>联网搜索</span>
          </button>

          <!-- 模型选择：仅切换最终 AI 回复使用的模型 -->
          <el-dropdown trigger="click" placement="top-start" popper-class="model-dropdown-popper" @command="onSelectModel">
            <span class="search-toggle model-select">
              <el-icon :size="14"><Cpu /></el-icon>
              <span>模型</span>
              <span class="model-name">{{ currentModel }}</span>
              <el-icon :size="12" class="model-arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="m in REPLY_MODELS"
                  :key="m"
                  :command="m"
                  :class="{ 'is-active': m === currentModel }"
                >
                  {{ m }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 任务执行中：红色终止按钮 -->
        <button
          v-if="chatStore.isStreaming"
          class="action-btn stop-btn"
          title="终止任务"
          @click="handleStop"
        >
          <span class="stop-square" />
        </button>

        <!-- 空闲：发送按钮 -->
        <button
          v-else
          class="action-btn send-btn"
          :class="{ disabled: !canSend }"
          :disabled="!canSend"
          @click="handleSend"
        >
          <el-icon :size="20"><Promotion /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-input-wrapper {
  padding: 16px 20px;
  border-top: 1px solid rgba(0, 238, 255, 0.08);
  background: rgba(9, 8, 24, 0.6);
  display: flex;
  justify-content: center;
}

.chat-input-inner {
  width: 100%;
  max-width: 960px;
}

.chat-input-box {
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(18, 16, 37, 0.8);
  border: 1px solid rgba(0, 238, 255, 0.15);
  border-radius: 12px;
  padding: 12px 68px 10px 16px;
  transition: all 0.3s;

  &:focus-within {
    border-color: rgba(0, 238, 255, 0.4);
    box-shadow: 0 0 20px rgba(0, 238, 255, 0.1);
  }
}

.input-row {
  display: flex;
}

.input-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.chat-textarea {
  flex: 1;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;

  &::placeholder {
    color: var(--text-secondary);
  }
}

.search-toggle {
  box-sizing: border-box;
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.4);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    border-color: rgba(0, 238, 255, 0.3);
    color: rgba(255, 255, 255, 0.7);
  }

  &.active {
    background: rgba(0, 238, 255, 0.15);
    border-color: var(--neon-cyan);
    color: var(--neon-cyan);
  }
}

// 模型选择按钮：复用 .search-toggle 的胶囊基样式，保证与联网搜索框完全等大，
// 这里只补充模型选择特有的细节
.model-select {
  outline: none;
  user-select: none;

  .model-name {
    font-family: 'Consolas', 'Monaco', monospace;
    color: var(--neon-cyan);
  }

  .model-arrow {
    opacity: 0.6;
  }
}

// 发送 / 终止按钮共用基础
.action-btn {
  position: absolute;
  right: 14px;
  bottom: 10px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s;
  flex-shrink: 0;
}

// 发送按钮
.send-btn {
  background: linear-gradient(135deg, var(--color-primary), var(--color-purple));
  color: #fff;

  &:hover:not(.disabled) {
    box-shadow: 0 0 20px rgba(0, 238, 255, 0.4);
    transform: scale(1.05);
  }

  &:active:not(.disabled) {
    transform: scale(0.95);
  }

  &.disabled {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.3);
    cursor: not-allowed;
    pointer-events: none;
  }
}

// 终止按钮
.stop-btn {
  background: rgba(255, 50, 50, 0.12);
  border: 1.5px solid rgba(255, 50, 50, 0.45);
  color: #ff3737;

  &:hover {
    background: rgba(255, 50, 50, 0.22);
    border-color: rgba(255, 50, 50, 0.7);
    box-shadow: 0 0 16px rgba(255, 50, 50, 0.28);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

// 终止方块图形
.stop-square {
  width: 14px;
  height: 14px;
  background: currentColor;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>

<!-- 模型下拉菜单为 teleport 渲染，需非 scoped 样式；用 popper-class 限定仅作用于本下拉 -->
<style>
.model-dropdown-popper .el-dropdown-menu__item {
  color: var(--text-primary);
}

/* 去掉 Element 默认的浅色高亮，改用暗色主题的青色高亮 */
.model-dropdown-popper .el-dropdown-menu__item:not(.is-disabled):hover,
.model-dropdown-popper .el-dropdown-menu__item:not(.is-disabled):focus {
  background-color: rgba(0, 238, 255, 0.12);
  color: var(--neon-cyan);
}

.model-dropdown-popper .el-dropdown-menu__item.is-active {
  color: var(--neon-cyan);
  font-weight: 600;
}
</style>
