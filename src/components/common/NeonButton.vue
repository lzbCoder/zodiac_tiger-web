<script setup lang="ts">
defineProps<{
  type?: 'primary' | 'purple' | 'pink'
  loading?: boolean
}>()
defineEmits(['click'])
</script>

<template>
  <button
    class="neon-btn"
    :class="[type || 'primary', { loading }]"
    @click="$emit('click')"
  >
    <span v-if="loading" class="spin-icon" />
    <slot />
  </button>
</template>

<style scoped lang="scss">
.neon-btn {
  padding: 10px 24px;
  border: 1px solid var(--neon-cyan);
  border-radius: 8px;
  background: rgba(0, 238, 255, 0.05);
  color: var(--neon-cyan);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 1px;
  position: relative;
  overflow: hidden;

  &:hover {
    background: rgba(0, 238, 255, 0.15);
    box-shadow: 0 0 20px rgba(0, 238, 255, 0.3);
    transform: scale(1.02);
  }

  &.purple {
    border-color: var(--neon-purple);
    color: var(--neon-purple);
    background: rgba(123, 97, 255, 0.05);

    &:hover {
      background: rgba(123, 97, 255, 0.15);
      box-shadow: 0 0 20px rgba(123, 97, 255, 0.3);
    }
  }

  &.pink {
    border-color: var(--neon-pink);
    color: var(--neon-pink);
    background: rgba(255, 68, 153, 0.05);

    &:hover {
      background: rgba(255, 68, 153, 0.15);
      box-shadow: 0 0 20px rgba(255, 68, 153, 0.3);
    }
  }

  &.loading {
    opacity: 0.7;
    pointer-events: none;
  }
}

.spin-icon {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin-glow 0.8s linear infinite;
  margin-right: 8px;
}
</style>
