<template>
  <section :class="['search-panel', { fullscreen: hideInput }]">
    <div v-if="hideInput" class="fullscreen-head">
      <div class="back-action" role="button" tabindex="0" aria-label="关闭搜索" @click="emit('close')"><ArrowLeft :size="20" stroke-width="2" /></div>
      <div class="search-box">
        <Search :size="17" aria-hidden="true" />
        <input ref="inputRef" v-model="query" type="search" inputmode="search" placeholder="输入基金名称/代码/简称" aria-label="搜索基金或指数" />
        <div v-if="query" class="clear-action" role="button" tabindex="0" aria-label="清空搜索" @click="clear"><X :size="15" stroke-width="2" /></div>
      </div>
    </div>
    <div v-if="!hideInput" class="search-line">
      <div class="search-box">
        <Search :size="17" aria-hidden="true" />
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          inputmode="search"
          placeholder="输入基金、指数名称或代码"
          aria-label="搜索基金或指数"
        />
        <div v-if="query" class="clear-action" role="button" tabindex="0" aria-label="清空搜索" @click="clear"><X :size="15" stroke-width="2" /></div>
      </div>
      <div class="cancel-action" role="button" tabindex="0" @click="emit('close')">取消</div>
    </div>

    <div v-if="query.trim()" class="search-results">
      <div class="result-status">
        <span>{{ loading ? '搜索中…' : `搜索结果 ${results.length}` }}</span>
      </div>

      <div v-if="error" class="result-empty">{{ error }}</div>
      <div v-else-if="!loading && !results.length" class="result-empty">未找到匹配结果</div>

      <div v-for="result in results" :key="`${result.kind}-${result.code}`" class="result-row">
        <div class="result-main" role="button" tabindex="0" @click="openResult(result)">
          <strong>{{ result.name }}</strong>
          <span>{{ result.code }} · {{ result.kind === 'index' ? '指数' : '基金' }}</span>
        </div>
        <div
          :class="['add-action', { added: addedCodes.has(result.code) }]"
          role="button"
          tabindex="0"
          @click="emit('add', result.code)"
        >
          <Check v-if="addedCodes.has(result.code)" :size="14" stroke-width="2.2" />
          <Plus v-else :size="17" stroke-width="2" />
          <span v-if="addedCodes.has(result.code)">已添加</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, Plus, Search, X } from 'lucide-vue-next'
import { searchIndices } from '@/constants/indices'
import { searchFunds } from '@/services/fund'
import type { FundSearchResult } from '@/types/fund'

const props = defineProps<{
  addedCodes: Set<string>
  modelValue?: string
  hideInput?: boolean
}>()

const emit = defineEmits<{
  add: [code: string]
  close: []
  'update:modelValue': [value: string]
}>()

const router = useRouter()
const inputRef = ref<HTMLInputElement>()
const query = computed({
  get: function () { return props.modelValue ?? '' },
  set: function (value: string) { emit('update:modelValue', value) }
})
const results = ref<FundSearchResult[]>([])
const loading = ref(false)
const error = ref('')
let debounceTimer: number | undefined
let controller: AbortController | undefined

watch(query, function (value) {
  window.clearTimeout(debounceTimer)
  controller?.abort()
  const keyword = value.trim()
  if (!keyword) {
    results.value = []
    loading.value = false
    error.value = ''
    return
  }

  debounceTimer = window.setTimeout(function () {
    void runSearch(keyword)
  }, 300)
})

async function runSearch (keyword: string) {
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const remote = await searchFunds(keyword, controller.signal)
    const merged = [...searchIndices(keyword), ...remote]
    const seen = new Set<string>()
    results.value = merged.filter(function (item) {
      if (seen.has(item.code)) return false
      seen.add(item.code)
      return true
    }).slice(0, 30)
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return
    results.value = searchIndices(keyword)
    error.value = results.value.length ? '' : '搜索服务暂时不可用'
  } finally {
    loading.value = false
  }
}

function clear () {
  query.value = ''
  inputRef.value?.focus({ preventScroll: true })
}

function openResult (result: FundSearchResult) {
  void router.push({
    name: result.kind === 'index' ? 'index-detail' : 'fund-detail',
    params: { code: result.code },
    query: { name: result.name }
  })
}

onMounted(function () {
  inputRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(function () {
  window.clearTimeout(debounceTimer)
  controller?.abort()
})
</script>

<style lang="less" scoped>
.search-panel {
  margin-bottom: 10px;
  background: #fff;
  border-top: 1px solid #eceef1;
  border-bottom: 1px solid #eceef1;
}

.search-panel.fullscreen { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 60; margin: 0; overflow-y: auto; background: #fff; }
.fullscreen-head { display: flex; align-items: center; gap: 8px; height: 60px; padding: 8px 16px; background: #fff; border-bottom: 1px solid #e5eaf0; }
.back-action { display: flex; align-items: center; justify-content: center; width: 32px; height: 34px; color: #273346; cursor: pointer; }
.fullscreen-head .search-box { height: 40px; background: #eef2f7; border-radius: 21px; }
.fullscreen-head .search-box input { font-size: 16px; }

.search-line {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
}

.search-box {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 34px;
  flex: 1;
  gap: 6px;
  padding: 0 10px;
  background: #f1f2f4;
  border-radius: 4px;
}

.search-icon {
  position: relative;
  display: block;
  width: 15px;
  height: 15px;
  flex: none;
  color: #92969c;
}

.search-icon::before {
  position: absolute;
  top: 1px;
  left: 1px;
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  border: 2px solid currentcolor;
  border-radius: 50%;
  content: '';
}

.search-icon::after {
  position: absolute;
  right: 0;
  bottom: 2px;
  width: 6px;
  height: 2px;
  background: currentcolor;
  border-radius: 1px;
  content: '';
  transform: rotate(45deg);
}

.search-box input {
  min-width: 0;
  flex: 1;
  padding: 0;
  color: #25282d;
  font-size: 16px;
  background: transparent;
  border: 0;
  outline: 0;
}

.search-box input::-webkit-search-cancel-button {
  display: none;
}

.clear-action {
  color: #9a9da3;
  cursor: pointer;
}

.cancel-action {
  flex: none;
  color: #2878d0;
  font-size: 13px;
  cursor: pointer;
}

.result-status {
  height: 28px;
  padding: 0 16px;
  color: #9a9da3;
  font-size: 10px;
  line-height: 28px;
  background: #fff;
  border-top: 1px solid #eef0f2;
  border-bottom: 1px solid #eef0f2;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 8px 16px;
  border-bottom: 1px solid #eef0f2;
}

.result-main {
  min-width: 0;
  flex: 1;
  cursor: pointer;
}

.result-main strong,
.result-main span {
  display: block;
}

.result-main strong {
  overflow: hidden;
  color: #25282d;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-main span {
  margin-top: 4px;
  color: #9a9da3;
  font-size: 10px;
}

.add-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  color: #fff;
  background: #2767e8;
  border: 1px solid #2767e8;
  border-radius: 50%;
  cursor: pointer;
}

.add-action.added {
  width: auto;
  gap: 3px;
  padding: 0 8px;
  color: #2767e8;
  font-size: 10px;
  background: #edf3ff;
  border-color: #d7e4ff;
  border-radius: 16px;
}

.add-action.added span { font-size: 10px; }

.result-empty {
  padding: 28px 16px;
  color: #9a9da3;
  font-size: 12px;
  text-align: center;
}

@media (min-width: 720px) {
  .search-panel {
    border: 1px solid #e7e9ec;
    border-radius: 6px;
  }
}
</style>
