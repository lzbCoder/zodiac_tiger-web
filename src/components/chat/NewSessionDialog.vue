<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useIntentDisplayStore } from '@/stores/intent_display'
import { useChatStore } from '@/stores/chat'
import { newSession } from '@/api/chat'

const visible = defineModel<boolean>({ required: true })

const intentStore = useIntentDisplayStore()
const chatStore = useChatStore()
const dontShowAgain = ref(false)

onMounted(() => {
  if (intentStore.list.length === 0) {
    intentStore.fetchList()
  }
})

function saveDontShowAgain() {
  if (dontShowAgain.value) {
    localStorage.setItem('newSessionGuide', 'off')
  }
}

async function createSession() {
  const res = await newSession()
  const sid = res.data.session_id
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ct = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  chatStore.addSession({ id: sid, title: '新会话', lastTime: '刚刚', createTime: ct })
  chatStore.setSessionId(sid)
  chatStore.resetChat()
}

async function handleUseDemo(demo: string) {
  saveDontShowAgain()
  visible.value = false
  await createSession()
  chatStore.setPrefill(demo)
  await nextTick()
  // 聚焦输入框
  const textarea = document.querySelector('.chat-textarea') as HTMLTextAreaElement
  textarea?.focus()
}

async function handleClose() {
  saveDontShowAgain()
  visible.value = false
  await createSession()
}

/** 右上角 X 关闭：仅关闭弹窗，不创建新会话 */
function handleDialogClose() {
  saveDontShowAgain()
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="✨ 选择你想做的事情"
    width="640px"
    :close-on-click-modal="false"
    :teleported="false"
    @close="handleDialogClose"
    top="15vh"
  >
    <div class="capability-list">
      <div
        v-for="item in intentStore.list"
        :key="item.intent_key"
        v-show="item.enable"
        class="capability-card"
      >
        <div class="card-icon">{{ item.icon === 'map' ? '🗺️' : item.icon === 'chart' ? '📊' : '💬' }}</div>
        <div class="card-body">
          <div class="card-title">{{ item.show_name }}</div>
          <div class="card-desc">{{ item.intent_desc }}</div>
        </div>
        <button class="card-btn" @click="handleUseDemo(item.demo_input)">一键填入提问</button>
      </div>
    </div>
    <template #footer>
      <label class="dont-show-again">
        <el-checkbox v-model="dontShowAgain" size="small" />
        <span>下次新建会话不再提示</span>
      </label>
      <el-button text @click="handleClose">直接开始</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.capability-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.capability-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 238, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.capability-card:hover {
  border-color: rgba(0, 238, 255, 0.3);
  background: rgba(0, 238, 255, 0.04);
}

.card-icon {
  font-size: 28px;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 238, 255, 0.06);
  border-radius: 10px;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.card-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
}

.card-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: 12px;
  border: 1px solid rgba(0, 238, 255, 0.2);
  border-radius: 6px;
  background: transparent;
  color: var(--neon-cyan);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.card-btn:hover {
  background: rgba(0, 238, 255, 0.1);
  border-color: var(--neon-cyan);
}

.dont-show-again {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
}
</style>
