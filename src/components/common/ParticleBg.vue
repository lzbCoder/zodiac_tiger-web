<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'

const canvasRef = ref<HTMLCanvasElement>()
const themeStore = useThemeStore()

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

let animId = 0
let particles: Particle[] = []
const PARTICLE_COUNT = 80

function particleColor(): string {
  return themeStore.mode === 'dark' ? '0, 238, 255' : '14, 165, 233'
}

function lineColor(): string {
  return themeStore.mode === 'dark' ? '123, 97, 255' : '99, 102, 241'
}

function maxParticleOpacity(): number {
  return themeStore.mode === 'dark' ? 0.5 : 0.25
}

function initParticles(w: number, h: number) {
  const maxOp = maxParticleOpacity()
  particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * maxOp + 0.1,
  }))
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const pColor = particleColor()
  const lColor = lineColor()

  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy

    if (p.x < 0 || p.x > w) p.vx *= -1
    if (p.y < 0 || p.y > h) p.vy *= -1

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${pColor}, ${p.opacity})`
    ctx.fill()
  }

  // 连线
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 120) {
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(${lColor}, ${0.08 * (1 - dist / 120)})`
        ctx.stroke()
      }
    }
  }

  animId = requestAnimationFrame(animate)
}

// 主题切换时刷新粒子透明度
watch(() => themeStore.mode, () => {
  const maxOp = maxParticleOpacity()
  particles.forEach((p) => {
    p.opacity = Math.random() * maxOp + 0.1
  })
})

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  initParticles(canvas.width, canvas.height)
  animate()

  window.addEventListener('resize', () => {
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  })
})

onUnmounted(() => cancelAnimationFrame(animId))
</script>

<template>
  <canvas ref="canvasRef" class="particle-bg" />
</template>

<style scoped>
.particle-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
