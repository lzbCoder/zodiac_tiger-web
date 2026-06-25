<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Document, InfoFilled } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import { getSkillDetail } from '@/api/skill'

const route = useRoute()
const router = useRouter()

const skillKey = route.params.skill_key as string
const displayName = ref('')
const rawMd = ref('')
const loading = ref(true)

// ---- Heading 解析 ----
interface Heading { id: string; text: string; level: number }

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w一-龥-]/g, '').slice(0, 60)
}

function extractHeadings(raw: string): Heading[] {
  const result: Heading[] = []
  const counter: Record<string, number> = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+)$/)
    if (!m) continue
    const level = m[1].length
    const text = m[2].trim()
    const base = slugify(text) || `heading`
    counter[base] = (counter[base] || 0) + 1
    const id = counter[base] > 1 ? `${base}-${counter[base]}` : base
    result.push({ id, text, level })
  }
  return result
}

const headings = computed<Heading[]>(() => extractHeadings(rawMd.value))

// ---- Markdown 渲染（自定义标题 ID）----
const renderedMd = computed(() => {
  if (!rawMd.value) return ''
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
  const hList = headings.value
  let hIdx = 0
  const originalHeadingOpen = md.renderer.rules.heading_open || function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const h = hList[hIdx++]
    if (h) tokens[idx].attrSet('id', h.id)
    return originalHeadingOpen(tokens, idx, options, env, self)
  }
  return md.render(rawMd.value)
})

// ---- 当前激活 heading（滚动高亮）----
const activeId = ref('')

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeId.value = id
  }
}

onMounted(async () => {
  try {
    const res: any = await getSkillDetail(skillKey)
    displayName.value = res.data?.display_name ?? skillKey
    rawMd.value = res.data?.full_md_content ?? ''
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="skill-detail-view">

    <!-- ① 顶部导航栏 -->
    <div class="detail-topbar glass-card">
      <el-button :icon="ArrowLeft" text class="back-btn" @click="router.back()">返回技能列表</el-button>
      <div class="topbar-title">
        <el-icon class="topbar-icon"><Document /></el-icon>
        <span class="topbar-name text-glow-cyan">{{ displayName }}</span>
        <span class="topbar-key">{{ skillKey }}</span>
      </div>
    </div>

    <!-- ② 内容提示横幅 -->
    <div class="notice-banner">
      <el-icon><InfoFilled /></el-icon>
      <span>以下为该技能的 <strong>SKILL.md</strong> 原始文档内容，供了解技能功能与约束使用</span>
    </div>

    <!-- ③ 主体：左侧目录 + 右侧文档 -->
    <div class="detail-body">

      <!-- 左侧目录导航 -->
      <aside class="toc-sidebar glass-card" v-if="headings.length">
        <div class="toc-header">目录</div>
        <nav class="toc-nav">
          <a
            v-for="h in headings"
            :key="h.id"
            :class="['toc-item', `toc-h${h.level}`, activeId === h.id && 'toc-active']"
            @click.prevent="scrollTo(h.id)"
          >{{ h.text }}</a>
        </nav>
      </aside>

      <!-- 右侧文档内容 -->
      <main class="detail-content glass-card" v-loading="loading">
        <div v-if="!loading && renderedMd" class="md-body" v-html="renderedMd" />
        <el-empty v-else-if="!loading" description="暂无文档内容" />
      </main>

    </div>
  </div>
</template>

<style scoped lang="scss">
.skill-detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: hidden;
}

// ── 顶部导航栏 ──
.detail-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  flex-shrink: 0;
}

.back-btn {
  flex-shrink: 0;
  color: var(--text-secondary);
  &:hover { color: var(--el-color-primary); }
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.topbar-icon {
  color: var(--el-color-primary);
  font-size: 18px;
  flex-shrink: 0;
}

.topbar-name {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-key {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  flex-shrink: 0;
}

// ── 提示横幅 ──
.notice-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(var(--color-primary-rgb), 0.06);
  border: 1px solid rgba(var(--color-primary-rgb), 0.2);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;

  .el-icon {
    color: var(--el-color-primary);
    font-size: 15px;
    flex-shrink: 0;
  }

  strong {
    color: var(--el-color-primary);
  }
}

// ── 主体布局 ──
.detail-body {
  display: flex;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

// ── 左侧目录 ──
.toc-sidebar {
  width: 220px;
  flex-shrink: 0;
  padding: 16px 12px;
  overflow-y: auto;
  align-self: flex-start;
  position: sticky;
  top: 0;
  max-height: calc(100vh - 180px);
}

.toc-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.toc-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toc-item {
  display: block;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 1.4;
  transition: all 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;

  &:hover {
    color: var(--el-color-primary);
    background: rgba(var(--color-primary-rgb), 0.08);
  }

  &.toc-active {
    color: var(--el-color-primary);
    background: rgba(var(--color-primary-rgb), 0.12);
    font-weight: 500;
  }
}

.toc-h1 { padding-left: 8px; font-weight: 600; font-size: 14px; color: var(--text-primary); }
.toc-h2 { padding-left: 16px; }
.toc-h3 { padding-left: 26px; font-size: 13px; }

// ── 右侧文档 ──
.detail-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 28px 36px;
}

// ── Markdown 正文样式 ──
.md-body {
  color: var(--text-primary);
  line-height: 1.8;
  font-size: 14px;

  :deep(h1) {
    font-size: 1.7em;
    color: var(--el-color-primary);
    margin: 0 0 16px 0;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(var(--color-primary-rgb), 0.2);
  }

  :deep(h2) {
    font-size: 1.3em;
    color: var(--el-color-primary);
    margin: 28px 0 12px 0;
    padding-left: 10px;
    border-left: 3px solid var(--el-color-primary);
  }

  :deep(h3) {
    font-size: 1.1em;
    color: var(--text-highlight, #e0e0e0);
    margin: 20px 0 8px 0;
  }

  :deep(p) {
    margin: 0 0 12px 0;
    color: var(--text-secondary);
  }

  :deep(ul),
  :deep(ol) {
    margin: 8px 0 12px 0;
    padding-left: 22px;
    color: var(--text-secondary);
  }

  :deep(li) {
    margin-bottom: 4px;
  }

  :deep(code) {
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 2px 6px;
    font-family: 'Cascadia Code', 'Fira Code', 'Courier New', monospace;
    font-size: 0.87em;
    color: var(--color-primary);
  }

  :deep(pre) {
    background: var(--bg-code);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
    margin: 12px 0 16px 0;

    code {
      background: transparent;
      border: none;
      padding: 0;
      font-size: 0.88em;
      color: var(--text-primary);
    }
  }

  :deep(blockquote) {
    border-left: 3px solid rgba(var(--color-primary-rgb), 0.4);
    margin: 12px 0;
    padding: 8px 16px;
    background: rgba(var(--color-primary-rgb), 0.04);
    border-radius: 0 6px 6px 0;
    color: var(--text-tertiary);
    font-style: italic;
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 14px;
  }

  :deep(th) {
    background: rgba(var(--color-primary-rgb), 0.1);
    border: 1px solid var(--border-color);
    padding: 8px 14px;
    text-align: left;
    color: var(--el-color-primary);
    font-weight: 600;
  }

  :deep(td) {
    border: 1px solid var(--border-color);
    padding: 7px 14px;
    color: var(--text-secondary);
  }

  :deep(tr:hover td) {
    background: var(--bg-muted);
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 20px 0;
  }

  :deep(a) {
    color: var(--el-color-primary);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  :deep(strong) { color: var(--text-primary); }
}
</style>
