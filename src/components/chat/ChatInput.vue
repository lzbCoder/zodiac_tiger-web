<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Promotion, Connection } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'
import { useIntentDisplayStore } from '@/stores/intent_display'

const emit = defineEmits<{
  send: [text: string, enableSearch: boolean]
}>()

const chatStore = useChatStore()
const intentStore = useIntentDisplayStore()

const inputText = ref('')
const enableSearch = ref(false)
const canSend = computed(() => inputText.value.trim().length > 0)

/** 动态占位：拼接三个能力名称 */
const placeholderText = computed(() => {
  const names = intentStore.list
    .filter(i => i.enable)
    .map(i => i.show_name.replace(/^[^\s]+\s/, ''))
  if (names.length > 0) {
    return `可发起「${names.join('」「')}」等需求，点击上方快捷按钮快速体验`
  }
  return '输入您的问题，Enter 发送，Shift+Enter 换行'
})

/** 监听 prefillText：快捷按钮/弹窗填入的示例提问 */
watch(() => chatStore.prefillText, (val) => {
  if (val) {
    inputText.value = val
    chatStore.setPrefill('')  // 消费后清空
    nextTick(() => {
      // 聚焦到输入框
      const textarea = document.querySelector('.chat-textarea') as HTMLTextAreaElement
      textarea?.focus()
    })
  }
})

function toggleSearch() {
  enableSearch.value = !enableSearch.value
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  emit('send', text, enableSearch.value)
  inputText.value = ''
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
        <button
          class="send-btn"
          :class="{ disabled: !canSend }"
          :disabled="!canSend"
          @click="handleSend"
        >
          <el-icon :size="20"><Promotion /></el-icon>
        </button>
      </div>
      <div class="input-toolbar">
        <button class="search-toggle" :class="{ active: enableSearch }" @click="toggleSearch">
          <el-icon :size="14"><Connection /></el-icon>
          <span>联网搜索</span>
        </button>
      </div>
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
  display: flex;
  flex-direction: column;
  background: rgba(18, 16, 37, 0.8);
  border: 1px solid rgba(0, 238, 255, 0.15);
  border-radius: 12px;
  padding: 12px 16px 10px;
  transition: all 0.3s;

  &:focus-within {
    border-color: rgba(0, 238, 255, 0.4);
    box-shadow: 0 0 20px rgba(0, 238, 255, 0.1);
  }
}

.input-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.search-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 12px;
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

.chat-textarea {
  flex: 1;
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

.send-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-purple));
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;

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
</style>
