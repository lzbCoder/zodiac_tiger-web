<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIntentDisplayStore } from '@/stores/intent_display'
import { useChatStore } from '@/stores/chat'

const expanded = ref(false)
const intentStore = useIntentDisplayStore()
const chatStore = useChatStore()

onMounted(() => {
  if (intentStore.list.length === 0) {
    intentStore.fetchList()
  }
})

function handleUseDemo(demo: string) {
  chatStore.setPrefill(demo)
  expanded.value = false
}

function handleToggle() {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="help-floating">
    <Transition name="slide-up">
      <div v-if="expanded" class="help-panel">
        <div class="help-header">
          <span>✨ 能力清单</span>
          <button class="close-btn" @click="expanded = false">✕</button>
        </div>
        <div class="help-body">
          <div
            v-for="item in intentStore.list"
            :key="item.intent_key"
            v-show="item.enable"
            class="help-item"
          >
          
            <div class="help-item-body">
              <div class="help-item-title">{{ item.show_name }}</div>
              <div class="help-item-desc">{{ item.intent_desc }}</div>
              <div class="help-item-demo">
                <span class="demo-label">示例：</span>
                <span class="demo-text">{{ item.demo_input }}</span>
              </div>
              <button class="demo-btn" @click="handleUseDemo(item.demo_input)">点击填入</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <button class="help-trigger" @click="handleToggle" :title="expanded ? '关闭' : '查看能力'">
      能力
    </button>
  </div>
</template>

<style scoped>
.help-floating {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.help-trigger {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(var(--color-primary-rgb), 0.2);
  background: var(--bg-dialog);
  color: var(--neon-cyan);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.2s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.help-trigger:hover {
  border-color: var(--neon-cyan);
  background: rgba(var(--color-primary-rgb), 0.1);
  transform: scale(1.05);
}

.help-panel {
  width: 360px;
  max-height: 480px;
  overflow-y: auto;
  background: var(--bg-dialog);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--color-primary-rgb), 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(var(--color-primary-rgb), 0.08);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-placeholder);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.close-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-muted);
}

.help-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(var(--color-primary-rgb), 0.08);
  transition: border-color 0.15s;
}

.help-item:hover {
  border-color: rgba(var(--color-primary-rgb), 0.2);
}

.help-item-icon {
  font-size: 24px;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-item-body {
  flex: 1;
  min-width: 0;
}

.help-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.help-item-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
  margin-bottom: 6px;
}

.help-item-demo {
  font-size: 12px;
  color: var(--text-placeholder);
  line-height: 1.4;
  margin-bottom: 8px;
}

.demo-label {
  color: var(--text-placeholder);
}

.demo-text {
  color: var(--text-tertiary);
}

.demo-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid rgba(var(--color-primary-rgb), 0.15);
  border-radius: 4px;
  background: transparent;
  color: var(--neon-cyan);
  cursor: pointer;
  transition: all 0.15s;
}

.demo-btn:hover {
  background: rgba(var(--color-primary-rgb), 0.08);
  border-color: var(--neon-cyan);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
