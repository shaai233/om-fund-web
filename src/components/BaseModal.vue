<template>
  <div class="modal-mask" role="presentation" @click.self="emit('close')">
    <section class="modal-card" role="dialog" aria-modal="true" :aria-label="title">
      <div class="modal-header">
        <h2>{{ title }}</h2>
        <div class="close-action" role="button" tabindex="0" aria-label="关闭" @click="emit('close')">
          ×
        </div>
      </div>
      <slot />
    </section>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<style lang="less" scoped>
.modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  padding-bottom: env(safe-area-inset-bottom);
  background: rgb(20 23 28 / 35%);
}

.modal-card {
  width: 100%;
  height: 80vh;
  max-width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--color-surface);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 18px rgb(24 27 32 / 12%);
  animation: popup-up 0.22s ease-out;
}

.modal-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px 12px;
}

.modal-header::before { position: absolute; top: 7px; left: 50%; width: 34px; height: 4px; background: #dfe5ec; border-radius: 3px; content: ''; transform: translateX(-50%); }

.modal-header h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 600;
}

.close-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #74787f;
  font-size: 20px;
  line-height: 1;
  background: #f0f1f3;
  border-radius: 50%;
  cursor: pointer;
}

@keyframes popup-up {
  from { transform: translateY(18px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
