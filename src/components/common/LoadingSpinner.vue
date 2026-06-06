<script setup lang="ts">
defineProps<{ size?: number }>()
</script>

<template>
  <div class="loading-spinner" :style="{ width: (size || 40) + 'px', height: (size || 40) + 'px' }">
    <div class="ring" />
    <div class="ring ring2" />
    <div class="ring ring3" />
  </div>
</template>

<style scoped lang="scss">
.loading-spinner {
  position: relative;
  display: inline-block;
}

.ring {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: var(--neon-cyan);
  border-radius: 50%;
  animation: spin-glow 1s linear infinite;
}

.ring2 {
  inset: 4px;
  border-top-color: var(--neon-purple);
  animation-duration: 0.7s;
  animation-direction: reverse;
}

.ring3 {
  inset: 8px;
  border-top-color: var(--neon-pink);
  animation-duration: 0.5s;
}
</style>
