<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import MessageBubble from './MessageBubble.vue'

const store = useChatStore()
const msgListRef = ref<HTMLElement>()
const showScrollBtn = ref(false)
const highlightedIndex = ref<number | null>(null)

const SCROLL_THRESHOLD = 80

function isNearBottom(): boolean {
  if (!msgListRef.value) return true
  const { scrollTop, scrollHeight, clientHeight } = msgListRef.value
  return scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD
}

function scrollToBottom() {
  if (msgListRef.value) {
    msgListRef.value.scrollTop = msgListRef.value.scrollHeight
  }
}

function scrollToMessage(msgIndex: number) {
  if (!msgListRef.value) return
  const el = msgListRef.value.querySelector(`[data-msg-index="${msgIndex}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightedIndex.value = msgIndex
    showScrollBtn.value = true
    setTimeout(() => { highlightedIndex.value = null }, 2000)
  }
}

function onScroll() {
  showScrollBtn.value = !isNearBottom()
}

defineExpose({ scrollToMessage })

onMounted(() => {
  if (store.messages.length > 0) {
    nextTick(scrollToBottom)
  }
})

watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    if (isNearBottom() || store.isStreaming || msgListRef.value?.scrollTop === 0) {
      scrollToBottom()
    }
  }
)

watch(
  () => store.isStreaming,
  async (streaming) => {
    if (!streaming) {
      await nextTick()
      if (!isNearBottom()) {
        showScrollBtn.value = true
      }
    }
  }
)

watch(
  () => store.jumpToMsgIndex,
  async (idx) => {
    if (idx !== null) {
      await nextTick()
      scrollToMessage(idx)
    }
  }
)
</script>

<template>
  <div class="chat-window" ref="msgListRef" @scroll="onScroll">
    <div class="chat-content-wrap">
      <div v-if="store.messages.length === 0" class="chat-empty">
        <div class="empty-glow text-glow-cyan">越群山智能生活助手</div>
        <p class="empty-sub">输入您的问题，开启智能对话</p>
      </div>
      <div
        v-for="(msg, idx) in store.messages"
        :key="idx"
        :data-msg-index="idx"
        :class="{ 'msg-highlight': highlightedIndex === idx }"
      >
        <MessageBubble
          :message="msg"
          :msg-index="idx"
        />
      </div>
      <div v-if="store.isStreaming" class="typing-indicator">
        <span class="dot" />
        <span class="dot" />
        <span class="dot" />
      </div>
    </div>
    <!-- 滚动到底部按钮 -->
    <transition name="fade">
      <div v-if="showScrollBtn" class="scroll-bottom-btn" @click="scrollToBottom">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.chat-window {
  flex: 1;
  overflow-y: auto;
  position: relative;

  // 自定义滚动条 — 紧贴右侧 Agent 面板
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    margin: 60px 0 100px 0;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;

    &:hover {
      background: rgba(var(--color-primary-rgb), 0.35);
    }
  }
}

.chat-content-wrap {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-glow {
  font-family: 'Orbitron', monospace;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 4px;
  margin-bottom: 12px;
}

.empty-sub {
  color: var(--text-secondary);
  font-size: 14px;
}

.typing-indicator {
  display: flex;
  gap: 6px;
  padding: 12px 16px;

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--neon-cyan);
    animation: breathe 1.4s infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

.scroll-bottom-btn {
  position: sticky;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(var(--color-primary-rgb), 0.15);
  border: 1px solid rgba(var(--color-primary-rgb), 0.25);
  color: var(--neon-cyan);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s, transform 0.2s;

  &:hover {
    background: rgba(var(--color-primary-rgb), 0.25);
    transform: translateX(-50%) scale(1.1);
  }

  &:active {
    transform: translateX(-50%) scale(0.95);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.msg-highlight {
  animation: msg-flash 2s ease-out;
  border-radius: 8px;
}

@keyframes msg-flash {
  0%   { background: rgba(var(--color-primary-rgb), 0.12); }
  50%  { background: rgba(var(--color-primary-rgb), 0.05); }
  100% { background: transparent; }
}
</style>
