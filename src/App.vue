<template>
  <RouterView />

  <div v-if="needRefresh" class="update-toast">
    <span>发现新版本</span>
    <div class="text-action" role="button" tabindex="0" @click="applyUpdate">
      立即更新
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()

function applyUpdate () {
  void updateServiceWorker(true)
}
</script>

<style lang="less" scoped>
.update-toast {
  position: fixed;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  left: 16px;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  max-width: 520px;
  margin: 0 auto;
  padding: 11px 14px;
  color: #fff;
  font-size: 13px;
  background: #30343a;
  border-radius: 5px;
  box-shadow: 0 6px 20px rgb(25 28 33 / 18%);
}

.text-action {
  color: #73b3fa;
  cursor: pointer;
}
</style>
