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
  background: rgba(18, 16, 37, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 238, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 0 20px rgba(0, 238, 255, 0.05);
  padding: 20px;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(0, 238, 255, 0.25);
    box-shadow: 0 0 30px rgba(0, 238, 255, 0.1);
  }
}

.glass-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--neon-cyan);
  margin-bottom: 16px;
  letter-spacing: 2px;
}
</style>
