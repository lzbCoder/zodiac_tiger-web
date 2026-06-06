<script setup lang="ts">
import TopNav from './TopNav.vue'
import SideMenu from './SideMenu.vue'
import ParticleBg from '../common/ParticleBg.vue'
</script>

<template>
  <div class="app-layout">
    <ParticleBg />
    <TopNav />
    <div class="app-body">
      <SideMenu />
      <main class="app-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;
  z-index: 1;
}
</style>
