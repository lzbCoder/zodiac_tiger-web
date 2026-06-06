<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getFileList, getFileTypes, getFileDownloadUrl, deleteFile } from '@/api/file'
import { ElMessageBox } from 'element-plus'
import {
  Search, Download, Delete,
  FolderOpened, Picture, Document, Grid,
  Tickets, DataAnalysis, Monitor, Files, MagicStick,
} from '@element-plus/icons-vue'

const files = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(15)

// 分类 + 搜索
const typeItems = ref<{ file_type: string; count: number }[]>([])
const activeType = ref<string>('全部')
const keyword = ref('')

const typeIcons: Record<string, any> = {
  '全部': FolderOpened,
  'PDF':  Document,
  '表格': Grid,
  '图片': Picture,
  '代码': Files,
  'PPT':  DataAnalysis,
  'HTML': Monitor,
  '文档': Tickets,
  '其他': MagicStick,
}

function formatSize(size: number | null): string {
  if (size == null) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

async function fetchTypes() {
  try {
    const res = await getFileTypes()
    typeItems.value = (res as any).data || []
  } catch { /* ignore */ }
}

async function fetchList() {
  loading.value = true
  try {
    const params: any = { page: page.value, page_size: pageSize.value }
    if (activeType.value !== '全部') params.file_type = activeType.value
    if (keyword.value) params.keyword = keyword.value
    const res = await getFileList(params)
    files.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function onTypeClick(t: string) {
  activeType.value = t
  page.value = 1
  fetchList()
}

function onSearch() {
  page.value = 1
  fetchList()
}

function onPageChange(p: number) {
  page.value = p
  fetchList()
}

function downloadFile(fileId: number) {
  window.open(getFileDownloadUrl(fileId), '_blank')
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件「${row.file_name}」吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteFile(row.id)
    fetchTypes()
    fetchList()
  } catch { /* 取消 */ }
}

onMounted(() => {
  fetchTypes()
  fetchList()
})
</script>

<template>
  <div class="file-view">
    <!-- 左侧分类 -->
    <aside class="file-sidebar">
      <h3 class="sidebar-title text-glow-cyan">文件分类</h3>
      <div
        v-for="t in typeItems"
        :key="t.file_type"
        class="type-item"
        :class="{ active: activeType === t.file_type }"
        @click="onTypeClick(t.file_type)"
      >
        <el-icon :size="16" class="type-icon">
          <component :is="typeIcons[t.file_type] || typeIcons['其他']" />
        </el-icon>
        <span class="type-label">{{ t.file_type }}</span>
        <span class="type-count">{{ t.count }}</span>
      </div>
    </aside>

    <!-- 右侧列表 -->
    <main class="file-main">
      <div class="main-header">
        <el-input
          v-model="keyword"
          placeholder="搜索文件名..."
          :prefix-icon="Search"
          class="search-input"
          clearable
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
      </div>

      <el-table
        :data="files"
        v-loading="loading"
        style="width: 100%"
        :header-cell-style="{ background: 'rgba(0,238,255,0.04)', color: 'var(--neon-cyan)' }"
        row-class-name="file-row"
      >
        <el-table-column label="文件名" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="file-name-cell">{{ row.file_name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="100" align="center">
          <template #default="{ row }">
            <span class="cell-secondary">{{ formatSize(row.file_size) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <span class="cell-type">{{ row.file_type || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="110" align="center">
          <template #default="{ row }">
            <span class="cell-secondary">{{ row.created_by || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160" align="center">
          <template #default="{ row }">
            <span class="cell-secondary">{{ row.created_at || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="downloadFile(row.id)">
              <el-icon><Download /></el-icon>
            </el-button>
            <el-button size="small" text type="danger" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && files.length === 0" class="empty-hint">暂无文件</div>

      <el-pagination
        v-if="total > pageSize"
        class="file-pagination"
        background
        layout="prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPageChange"
      />
    </main>
  </div>
</template>

<style scoped lang="scss">
.file-view {
  display: flex;
  height: 100%;
  gap: 0;
}

// ---- 左侧分类 ----
.file-sidebar {
  width: 160px;
  flex-shrink: 0;
  padding: 24px 0;
  border-right: 1px solid rgba(0, 238, 255, 0.08);
  overflow-y: auto;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  margin-bottom: 12px;
  padding: 0 16px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border-right: 2px solid transparent;

  &:hover {
    background: rgba(0, 238, 255, 0.04);
    color: var(--text-primary);

    .type-icon { color: rgba(0, 238, 255, 0.7); }
  }

  &.active {
    color: var(--neon-cyan);
    background: rgba(0, 238, 255, 0.06);
    border-right-color: var(--neon-cyan);

    .type-icon { color: var(--neon-cyan); }
  }
}

.type-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.type-label {
  flex: 1;
}

.type-count {
  font-size: 11px;
  opacity: 0.6;
  min-width: 24px;
  text-align: right;
  flex-shrink: 0;
}

// ---- 右侧主区域 ----
.file-main {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-header {
  margin-bottom: 16px;
}

.search-input {
  width: 280px;
}

// ---- 表格 ----
.file-name-cell {
  color: var(--text-primary);
}

.cell-secondary {
  color: var(--text-secondary);
  font-size: 13px;
}

.cell-type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 238, 255, 0.08);
  color: var(--neon-cyan);
}

.empty-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.file-pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>

<style>
/* 全局表格行样式 */
.file-row {
  background: transparent !important;
  transition: background 0.15s;
}
.file-row:hover > td {
  background: rgba(0, 238, 255, 0.03) !important;
}
</style>
