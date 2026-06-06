import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'theme-mode'

function loadTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light') return 'light'
  return 'dark'
}

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-light')
  root.classList.add(`theme-${mode}`)
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(loadTheme())

  // 首次加载时立即应用 class（避免闪烁）
  applyThemeClass(mode.value)

  function toggle() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(m: ThemeMode) {
    mode.value = m
  }

  watch(mode, (val) => {
    localStorage.setItem(STORAGE_KEY, val)
    applyThemeClass(val)
  })

  return { mode, toggle, setTheme }
})
