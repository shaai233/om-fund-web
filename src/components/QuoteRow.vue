<template>
  <div class="quote-row">
    <div class="quote-main" role="button" tabindex="0" @click="openDetail">
      <div class="quote-identity">
        <div class="quote-name">
          <strong>{{ quote?.name ?? code }}</strong>
          <span v-if="quote?.kind === 'index'">指数</span>
        </div>
        <small>{{ code }}</small>
      </div>

      <div class="latest-value">
        <strong>{{ displayPrice }}</strong>
        <small>{{ displayTime }}</small>
      </div>

      <div :class="['change-value', changeClass]">
        {{ displayChange }}
      </div>
    </div>

    <div v-if="editing" class="edit-actions">
      <div
        :class="['order-action', { disabled: index === 0 }]"
        role="button"
        tabindex="0"
        aria-label="上移"
        @click="emit('reorder', { from: index, to: index - 1 })"
      >↑</div>
      <div
        :class="['order-action', { disabled: index === total - 1 }]"
        role="button"
        tabindex="0"
        aria-label="下移"
        @click="emit('reorder', { from: index, to: index + 1 })"
      >↓</div>
      <select aria-label="移动到分组" :value="group" @change="moveToGroup">
        <option v-for="name in groups" :key="name" :value="name">{{ name }}</option>
      </select>
      <div class="remove-action" role="button" tabindex="0" @click="emit('remove')">删除</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { FundQuote } from '@/types/fund'

const props = defineProps<{
  code: string
  quote?: FundQuote
  group: string
  groups: string[]
  editing: boolean
  index: number
  total: number
}>()

const emit = defineEmits<{
  move: [target: string]
  remove: []
  reorder: [positions: { from: number, to: number }]
}>()

const router = useRouter()

const displayPrice = computed(function () {
  if (!props.quote) return '--'
  return props.quote.gsz || props.quote.dwjz || '--'
})

const displayTime = computed(function () {
  if (!props.quote?.gztime) return ''
  return props.quote.gztime.split(' ').at(-1) ?? ''
})

const changeValue = computed(function () {
  return Number(props.quote?.gszzl ?? 0)
})

const displayChange = computed(function () {
  if (!props.quote) return '--'
  return `${changeValue.value >= 0 ? '+' : ''}${changeValue.value.toFixed(2)}%`
})

const changeClass = computed(function () {
  if (!props.quote) return 'flat'
  return changeValue.value >= 0 ? 'up' : 'down'
})

function openDetail () {
  if (props.editing || !props.quote) return
  void router.push({
    name: props.quote.kind === 'index' ? 'index-detail' : 'fund-detail',
    params: { code: props.code },
    query: { name: props.quote.name }
  })
}

function moveToGroup (event: Event) {
  emit('move', (event.target as HTMLSelectElement).value)
}
</script>

<style lang="less" scoped>
.quote-row {
  padding: 0 16px;
  background: #fff;
}

.quote-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px 78px;
  gap: 8px;
  align-items: center;
  min-height: 62px;
  border-bottom: 1px solid #eef0f2;
  cursor: pointer;
}

.quote-identity {
  min-width: 0;
}

.quote-name {
  display: flex;
  align-items: center;
  gap: 5px;
}

.quote-name strong {
  overflow: hidden;
  color: #22252a;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-name span {
  flex: none;
  padding: 1px 3px;
  color: #8a8e94;
  font-size: 8px;
  border: 1px solid #cfd2d6;
  border-radius: 2px;
}

.quote-identity small,
.latest-value small {
  display: block;
  margin-top: 4px;
  color: #a0a3a8;
  font-size: 10px;
}

.latest-value {
  min-width: 0;
  text-align: right;
}

.latest-value strong {
  color: #25282d;
  font-size: 14px;
  font-weight: 500;
}

.change-value {
  font-size: 14px;
  font-weight: 500;
  text-align: right;
}

.up { color: #e14b52; }
.down { color: #22a06b; }
.flat { color: #8e9298; }

.edit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #eef0f2;
}

.order-action,
.remove-action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  cursor: pointer;
  border-radius: 3px;
}

.order-action {
  width: 30px;
  color: #555960;
  background: #f0f1f3;
}

.order-action.disabled {
  opacity: 0.35;
  pointer-events: none;
}

.edit-actions select {
  min-width: 0;
  height: 28px;
  flex: 1;
  padding: 0 6px;
  color: #555960;
  font-size: 11px;
  background: #f7f8f9;
  border: 1px solid #dde0e4;
  border-radius: 3px;
}

.remove-action {
  padding: 0 9px;
  color: #e14b52;
  font-size: 11px;
  background: #fff1f1;
}

.quote-row { padding: 0 14px; }
.quote-main { min-height: 58px; grid-template-columns: minmax(0, 1fr) 88px 78px; }
.quote-name strong { color: #202a38; font-size: 14px; font-weight: 650; }
.quote-identity small, .latest-value small { margin-top: 2px; color: #9aa5b4; font-size: 10px; }
.latest-value strong { color: #202a38; font-size: 15px; font-weight: 650; }
.change-value { justify-self: end; min-width: 64px; padding: 7px 8px; font-size: 14px; font-weight: 650; text-align: center; border-radius: 4px; }
.change-value.up { color: #f0444d; background: #ffe0e0; }
.change-value.down { color: #249467; background: #c9f3df; }
.change-value.flat { background: #eef1f4; }
</style>
