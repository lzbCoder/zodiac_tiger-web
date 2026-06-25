<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <div class="glass-card">
    <div v-if="title" class="glass-card-title">{{ title }}</div>
    <div class="glass-card-body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  box-shadow: var(--glass-shadow);
  padding: 20px;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(var(--color-primary-rgb), 0.25);
    box-shadow: var(--neon-shadow-lg) rgba(var(--color-primary-rgb), 0.1);
  }
}

.glass-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--neon-cyan);
  margin-bottom: 16px;}
</style>
