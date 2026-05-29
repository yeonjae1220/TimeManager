<template>
  <div class="app-shell">
    <slot />
    <TabBar :isRunning="isRunning" />
  </div>
</template>

<script setup>
import TabBar from './TabBar.vue';

defineProps({
  isRunning: { type: Boolean, default: false },
});
</script>

<style scoped>
.app-shell {
  min-height: 100dvh;
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
}
</style>
