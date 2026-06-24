<script setup lang="ts">
// 品牌图标：两座山，与浏览器 favicon (public/favicon.svg) 保持统一
// 使用 currentColor 以继承 el-icon / 主题色与发光效果
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <!-- 左次峰 -->
    <path d="M2 26 L10 10 L18 26" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
    <!-- 右主峰 -->
    <path d="M14 26 L22 6 L30 26" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
    <!-- 底部科技横线 -->
    <line x1="2" y1="26" x2="30" y2="26" stroke="currentColor" stroke-width="2" />
    <!-- 山顶发光点 -->
    <circle cx="22" cy="6" r="2" fill="currentColor" opacity="0.8" />
  </svg>
</template>
