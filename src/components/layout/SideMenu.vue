<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import {
  ChatDotRound,
  Tickets,
  SetUp,
  Monitor,
  Folder,
  Setting,
  Cpu,
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const menuItems = [
  { path: '/chat',     label: '智能聊天',   icon: ChatDotRound },
  { path: '/template', label: '提示词模板', icon: Tickets },
  { path: '/skill',    label: '技能管理',   icon: SetUp },
  { path: '/mcp',      label: 'MCP 服务',   icon: Monitor },
  { path: '/file',     label: '文件资源',   icon: Folder },
  { path: '/setting',  label: '系统设置',   icon: Setting },
]

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <aside class="side-menu">
    <!-- 菜单导航 -->
    <nav class="menu-nav">
      <div
        v-for="item in menuItems"
        :key="item.path"
        class="menu-item"
        :class="{ active: route.path === item.path }"
        @click="navigate(item.path)"
      >
        <el-icon :size="20" class="menu-icon">
          <component :is="item.icon" />
        </el-icon>
        <span class="menu-label">{{ item.label }}</span>
      </div>
    </nav>
  </aside>
</template>

<style scoped lang="scss">
.side-menu {
  width: 140px;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  backdrop-filter: blur(8px);
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
  overflow: hidden;
  z-index: 5;
  transition: background 0.4s, border-color 0.4s;
}

// ---- 品牌区 ----
.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 8px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 238, 255, 0.1);
  transition: opacity 0.3s;

  &:hover {
    .brand-icon {
      filter: drop-shadow(0 0 12px rgba(0, 238, 255, 0.5));
    }
  }
}

.brand-icon {
  color: var(--color-primary);
  margin-bottom: 6px;
  transition: filter 0.3s;
}

.brand-title {
  font-family: 'Orbitron', monospace;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 3px;
  text-shadow: 0 0 10px rgba(0, 238, 255, 0.3);
}

.brand-sub {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 4px;
  letter-spacing: 1px;
}

// ---- 菜单导航 ----
.menu-nav {
  flex: 1;
  padding: 10px 8px 12px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  margin-bottom: 2px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.25s ease;
  border-left: 2px solid transparent;
  position: relative;

  &:hover {
    background: var(--menu-hover-bg);
    color: var(--text-primary);

    .menu-icon {
      color: var(--color-primary);
      filter: drop-shadow(0 0 4px var(--color-primary-glow));
    }
  }

  &.active {
    background: linear-gradient(90deg, var(--menu-active-bg), transparent);
    color: var(--color-primary);
    border-left-color: var(--color-primary);

    .menu-icon {
      color: var(--color-primary);
      filter: drop-shadow(0 0 6px var(--color-primary-glow));
    }
  }
}

.menu-icon {
  flex-shrink: 0;
  color: var(--menu-icon-color);
  transition: color 0.25s, filter 0.25s;
}

.menu-label {
  font-size: 11px;
  white-space: nowrap;
}
</style>
