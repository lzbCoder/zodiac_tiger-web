<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatStore } from '@/stores/chat'

const store = useChatStore()
const visible = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

interface QuestionItem {
  msgIndex: number
  text: string
}

const questions = computed<QuestionItem[]>(() => {
  const items: QuestionItem[] = []
  store.messages.forEach((msg, idx) => {
    if (msg.role === 'user' && msg.content) {
      items.push({ msgIndex: idx, text: msg.content })
    }
  })
  return items
})

const emit = defineEmits<{
  jump: [msgIndex: number]
}>()

function show() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  visible.value = true
}

function hide() {
  hideTimer = setTimeout(() => { visible.value = false }, 200)
}

function onPopupEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function onJump(q: QuestionItem) {
  emit('jump', q.msgIndex)
  visible.value = false
}
</script>

<template>
  <div
    v-if="questions.length > 0"
    class="question-nav"
    @mouseenter="show"
    @mouseleave="hide"
  >
    <!-- 默认：多条细横杠 -->
    <div class="bar-list">
      <div
        v-for="(q, idx) in questions"
        :key="idx"
        class="bar-row"
        :title="q.text"
        @click="onJump(q)"
      >
        <span class="bar-mark" />
      </div>
    </div>

    <!-- hover 弹窗 -->
    <transition name="popup">
      <div
        v-if="visible"
        class="nav-popup"
        @mouseenter="onPopupEnter"
        @mouseleave="hide"
      >
        <div class="popup-header">历史提问</div>
        <div class="popup-list">
          <div
            v-for="(q, idx) in questions"
            :key="idx"
            class="popup-item"
            :title="q.text"
            @click="onJump(q)"
          >
            <span class="item-index">{{ idx + 1 }}</span>
            <span class="item-text">{{ q.text.slice(0, 15) }}{{ q.text.length > 15 ? '...' : '' }}</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.question-nav {
  position: absolute;
  left: -14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  max-height: calc(100% - 160px);
  z-index: 6;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.bar-list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  overflow-y: auto;
  max-height: 100%;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.bar-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  cursor: pointer;
  flex-shrink: 0;
  padding: 2px 0;
}

.bar-mark {
  display: block;
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.06);
  transition: width 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.bar-row:hover .bar-mark {
  width: 18px;
  background: rgba(0, 238, 255, 0.4);
  box-shadow: 0 0 4px rgba(0, 238, 255, 0.3);
}

// 弹窗（与之前一致）
.nav-popup {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 200px;
  max-height: 360px;
  background: rgba(10, 14, 23, 0.94);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 238, 255, 0.25);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 238, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.popup-header {
  padding: 10px 14px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neon-cyan);
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(0, 238, 255, 0.1);
  flex-shrink: 0;
}

.popup-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.popup-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(0, 238, 255, 0.08);
  }
}

.item-index {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  min-width: 16px;
  flex-shrink: 0;
}

.item-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;

  .popup-item:hover & {
    color: var(--neon-cyan);
  }
}

.popup-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.popup-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.popup-enter-from { opacity: 0; transform: translateY(-50%) translateX(8px); }
.popup-leave-to   { opacity: 0; transform: translateY(-50%) translateX(8px); }
</style>
