<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { Cpu, Moon, Sunny } from '@element-plus/icons-vue'

const router = useRouter()
const themeStore = useThemeStore()

function toggleTheme() {
  themeStore.toggle()
}

function goHome() {
  router.push('/chat')
}
</script>

<template>
  <header class="top-nav">
    <div class="nav-left">
      <el-tooltip content="返回首页" placement="bottom">
        <button class="brand-icon-btn" @click="goHome">
          <el-icon :size="24" class="brand-icon">
            <Cpu />
          </el-icon>
        </button>
      </el-tooltip>
      <div class="brand-text">
        <span class="brand-name text-glow-cyan">越群山</span>
        <span class="brand-sub">智能生活助手</span>
      </div>
    </div>
    <div class="nav-right">
      <el-tooltip
        :content="themeStore.mode === 'dark' ? '切换浅色模式' : '切换深色模式'"
        placement="bottom"
      >
        <button class="theme-toggle-btn" @click="toggleTheme">
          <el-icon :size="20">
            <Moon v-if="themeStore.mode === 'dark'" />
            <Sunny v-else />
          </el-icon>
        </button>
      </el-tooltip>
    </div>
  </header>
</template>

<style scoped lang="scss">
.top-nav {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(9, 8, 24, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  z-index: 10;
  flex-shrink: 0;
  transition: background 0.4s, border-color 0.4s;

  .theme-light & {
    background: rgba(255, 255, 255, 0.9);
  }
}

// ============ 品牌 Logo ============
.nav-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  color: var(--color-primary);
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px var(--color-primary-glow));
  transition: filter 0.3s;
}

.brand-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.2s;

  &:hover {
    background: var(--menu-hover-bg);

    .brand-icon {
      filter: drop-shadow(0 0 12px var(--color-primary-glow));
    }
  }
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.brand-name {
  font-family: 'Orbitron', 'DS-Digital', monospace;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
}

.brand-sub {
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

// ============ 右侧 ============
.nav-right {
  display: flex;
  align-items: center;
  gap: 30px;
}

.theme-toggle-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--menu-icon-color);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    box-shadow: var(--neon-shadow) var(--color-primary-glow);
  }
}
</style>
