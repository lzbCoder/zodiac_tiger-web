<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue'
import { useChatStore, type Session } from '@/stores/chat'
import { getHistory, newSession } from '@/api/chat'
import { Plus, ChatDotRound, MoreFilled, Top } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useChatStore()
const listRef = ref<HTMLElement>()

// ---- 重命名弹窗 ----
const renameVisible = ref(false)
const renameId = ref('')
const renameTitle = ref('')
let renameTarget: Session | null = null

function openRename(s: Session) {
  renameTarget = s
  renameId.value = s.id
  renameTitle.value = s.title
  renameVisible.value = true
}

async function confirmRename() {
  const title = renameTitle.value.trim()
  if (title && renameId.value) {
    try {
      await store.renameSession(renameId.value, title)
      ElMessage.success('重命名成功')
    } catch {
      ElMessage.error('重命名失败')
      return
    }
  }
  renameVisible.value = false
}

function cancelRename() {
  renameVisible.value = false
}

onMounted(() => {
  store.fetchSessions()
})

// ---- 时间分类 ----
const timeGroups = computed(() => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000)
  const monthStart = new Date(todayStart.getTime() - 29 * 86400000)

  const pinnedGroup: { label: string; pinned: boolean; items: Session[] } = {
    label: '置顶', pinned: true, items: [],
  }
  const groups: { label: string; pinned?: boolean; items: Session[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '7 天内', items: [] },
    { label: '30 天内', items: [] },
  ]

  for (const s of store.sessions) {
    // 置顶会话单独成组，不再进入时间分组
    if (s.pinned) {
      pinnedGroup.items.push(s)
      continue
    }

    const d = new Date(s.createTime.replace(' ', 'T'))
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    if (dayStart.getTime() >= todayStart.getTime()) {
      groups[0].items.push(s)
    } else if (dayStart.getTime() >= yesterdayStart.getTime()) {
      groups[1].items.push(s)
    } else if (dayStart.getTime() >= weekStart.getTime()) {
      groups[2].items.push(s)
    } else if (dayStart.getTime() >= monthStart.getTime()) {
      groups[3].items.push(s)
    }
  }

  const ordered = pinnedGroup.items.length > 0 ? [pinnedGroup, ...groups] : groups
  return ordered.filter((g) => g.items.length > 0)
})

// ---- 新建会话 ----
async function handleNewSession() {
  const guideOff = localStorage.getItem('newSessionGuide') === 'off'
  if (guideOff) {
    // 直接创建
    await createNewSession()
  } else {
    // 弹出能力选择弹窗
    store.showNewSessionDialog = true
  }
}

async function createNewSession() {
  try {
    const res = await newSession()
    const sid = res.data.session_id
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ct = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    store.addSession({ id: sid, title: '新会话', lastTime: '刚刚', createTime: ct, pinned: false })
    store.setSessionId(sid)
    store.resetChat()
    await nextTick()
    listRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    // handled by interceptor
  }
}

// ---- 选择会话（加载历史） ----
async function selectSession(s: Session) {
  store.setSessionId(s.id)
  store.resetChat()
  try {
    const res = await getHistory(s.id)
    const items = res.data || []
    const msgs = items.map((m: any) => ({
      role: m.role, content: m.content, chatId: m.chat_id,
      steps: m.steps || [], execution_events: m.execution_events,
    })) as any[]
    store.setMessages(msgs)
  } catch {
    // silently fail
  }
}

// ---- 置顶 ----
async function handlePin(s: Session) {
  try {
    await store.togglePin(s.id)
  } catch {
    ElMessage.error('操作失败')
  }
}

// ---- 更多操作 ----
async function handleDelete(s: Session) {
  try {
    await ElMessageBox.confirm(
      `确定要删除会话「${s.title}」吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
    )
    store.removeSession(s.id)
  } catch {
    // 取消
  }
}
</script>

<template>
  <div class="session-list">
    <!-- 开启新对话按钮 -->
    <div class="new-chat-area">
      <button class="new-chat-btn" @click="handleNewSession">
        <el-icon :size="16"><Plus /></el-icon>
        <span>开启新对话</span>
      </button>
    </div>

    <!-- 会话列表 -->
    <div ref="listRef" class="session-items">
      <template v-if="store.sessions.length > 0">
        <div v-for="group in timeGroups" :key="group.label" class="time-group">
          <div class="group-label" :class="{ 'pinned-label': group.pinned }">
            <el-icon v-if="group.pinned" :size="12"><Top /></el-icon>
            <span>{{ group.label }}</span>
          </div>
          <div
            v-for="s in group.items"
            :key="s.id"
            class="session-item"
            :class="{ active: s.id === store.currentSessionId, 'is-pinned': s.pinned }"
            @click="selectSession(s)"
          >
            <el-icon :size="14" class="session-icon"><ChatDotRound /></el-icon>
            <span class="session-title">{{ s.title }}</span>
            <!-- 置顶会话：默认显示置顶图标，hover 时切换为三个点菜单 -->
            <el-icon v-if="s.pinned" :size="14" class="pin-indicator"><Top /></el-icon>
            <el-dropdown
              trigger="click"
              placement="bottom-end"
              class="more-dropdown"
              @command="(cmd: string) => {
                if (cmd === 'rename') openRename(s)
                else if (cmd === 'pin') handlePin(s)
                else if (cmd === 'delete') handleDelete(s)
              }"
            >
              <button class="more-btn" @click.stop>
                <el-icon :size="17"><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pin">{{ s.pinned ? '取消置顶' : '置顶' }}</el-dropdown-item>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
      <div v-else class="empty-state">暂无历史会话</div>
    </div>

    <!-- 重命名弹窗 -->
    <el-dialog
      v-model="renameVisible"
      title="重命名会话"
      width="360px"
      :close-on-click-modal="true"
      :append-to-body="true"
      class="rename-dialog"
    >
      <el-input
        v-model="renameTitle"
        placeholder="请输入新名称"
        maxlength="30"
        @keydown.enter="confirmRename"
      />
      <template #footer>
        <el-button @click="cancelRename">取消</el-button>
        <el-button type="primary" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.session-list {
  width: 260px;
  background: var(--bg-sidebar);
  backdrop-filter: blur(8px);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
}

// ---- 新对话按钮 ----
.new-chat-area {
  padding: 16px 14px 8px;
  flex-shrink: 0;
}

.new-chat-btn {
  width: 100%;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 238, 255, 0.08);
  border: 1px solid rgba(0, 238, 255, 0.25);
  border-radius: 8px;
  color: var(--color-primary);
  font-size: 14px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(0, 238, 255, 0.14);
    border-color: var(--color-primary);
    box-shadow: 0 0 16px rgba(0, 238, 255, 0.2);
  }
}


// ---- 滚动区 ----
.session-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 16px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;
  }
}

// ---- 时间分组 ----
.time-group {
  margin-bottom: 4px;
}

.group-label {
  font-size: 11px;
  color: var(--text-secondary);
  padding: 12px 8px 6px;
  letter-spacing: 1px;

  &.pinned-label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-primary);
  }
}

// ---- 会话项 ----
.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    background: var(--menu-hover-bg);

    .more-btn {
      opacity: 1;
    }
  }

  &.active {
    background: var(--menu-active-bg);
    border-left: 2px solid var(--color-primary);
    padding-left: 8px;
  }
}

.session-icon {
  color: var(--menu-icon-color);
  flex-shrink: 0;
}

.session-title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-btn {
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  opacity: 0.3;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s, opacity 0.2s;

  &:hover {
    color: var(--color-primary);
    background: rgba(0, 238, 255, 0.12);
    opacity: 1;
  }
}

.more-dropdown {
  flex-shrink: 0;
  line-height: 0;
}

// ---- 置顶图标：默认显示，hover 时让位给三个点菜单 ----
.pin-indicator {
  width: 25px;
  height: 25px;
  flex-shrink: 0;
  color: var(--color-primary);
}

.session-item.is-pinned {
  // 默认隐藏菜单，仅显示置顶图标
  .more-dropdown {
    display: none;
  }

  &:hover {
    .pin-indicator {
      display: none;
    }
    .more-dropdown {
      display: inline-flex;
    }
  }
}

// ---- 空状态 ----
.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
