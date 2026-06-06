<script setup lang="ts">
defineProps<{ text?: string }>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">
      <el-icon :size="48"><FolderOpened /></el-icon>
    </div>
    <p>{{ text || '暂无数据' }}</p>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--text-secondary);
}

.empty-icon {
  opacity: 0.4;
  margin-bottom: 16px;
}

p {
  font-size: 14px;
  letter-spacing: 1px;
}
</style>
