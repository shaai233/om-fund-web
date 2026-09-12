<template>
  <main class="home-page">
    <div class="page-content">
      <div ref="searchLine" :class="['search-line', { hidden: !searchVisible }]">
        <div class="search-box">
          <Search :size="18" aria-hidden="true" />
          <input v-model="searchQuery" type="search" placeholder="输入基金名称/代码/简称" aria-label="搜索基金或指数" @focus="showSearch = true" />
          <X v-if="searchQuery" :size="16" aria-label="清空搜索" @click="searchQuery = ''" />
        </div>
      </div>

      <section ref="marketSection" :class="['market-cards', { compact: marketCompact }]" aria-label="指数行情">
        <div class="market-scroll">
          <div v-for="item in marketCards" :key="item.code" class="market-card" role="button" tabindex="0" @click="openIndex(item.code, item.name)">
            <span>{{ item.name }}</span><strong :class="item.changeClass">{{ item.price }}</strong><small :class="item.changeClass">{{ item.change }}</small>
          </div>
          <div class="market-settings" role="button" tabindex="0" aria-label="管理指数" @click="openIndexManager"><Settings :size="16" stroke-width="1.8" /></div>
        </div>
      </section>

      <nav :class="['group-tabs', { compact: marketCompact }]" aria-label="自选分组">
        <div class="group-tab-scroll">
          <div v-for="tab in groupTabs" :key="tab.value" :class="['group-tab', { active: activeGroup === tab.value }]" role="button" tabindex="0" @click="selectGroup(tab.value)">{{ tab.label }}</div>
        </div>
        <div class="group-settings" role="button" tabindex="0" aria-label="分组管理" @click="showManager = true"><Settings :size="16" stroke-width="1.8" /></div>
      </nav>

      <SearchPanel
        v-if="showSearch"
        :added-codes="addedCodes"
        v-model="searchQuery"
        hide-input
        @add="handleAddRequest"
        @close="closeSearch"
      />

      <div v-if="showGroupPicker" class="picker-mask" role="presentation" @click.self="showGroupPicker = false">
        <div class="group-picker" role="dialog" aria-label="选择分组">
          <strong>添加到分组</strong>
          <div v-for="group in groups" :key="group" class="picker-option" role="button" tabindex="0" @click="addToGroup(group)">{{ group === DEFAULT_GROUP ? '默认分组' : group }}</div>
          <div class="picker-cancel" role="button" tabindex="0" @click="showGroupPicker = false">取消</div>
        </div>
      </div>

      <section v-for="group in displayGroups" :key="group" :ref="(element) => setGroupRef(group, element)" class="group-section">
        <div class="group-heading" role="button" tabindex="0" @click="toggleGroup(group)">
          <ChevronDown :class="['chevron', { collapsed: collapsedGroups.has(group) }]" :size="14" stroke-width="1.8" aria-hidden="true" />
          <strong>{{ group === DEFAULT_GROUP ? '默认分组' : group }}</strong>
        </div>
        <div v-if="!collapsedGroups.has(group)" class="quote-list">
          <div class="list-header"><span>基金名称 / 代码</span><span>估值 / 净值</span><span>日涨跌幅</span></div>
          <QuoteRow
            v-for="(code, index) in (watchlist.state.groups[group] ?? [])"
            :key="code"
            :code="code"
            :quote="quoteMap[code]"
            :group="group"
            :groups="groups"
            :editing="editing"
            :index="index"
            :total="watchlist.state.groups[group]?.length ?? 0"
            @move="moveCode(code, group, $event)"
            @remove="removeCode(code, group)"
            @reorder="watchlist.reorder(group, $event.from, $event.to)"
          />
          <div v-if="!(watchlist.state.groups[group] ?? []).length" class="empty-list">暂无自选基金</div>
        </div>
      </section>

      <div v-if="!displayGroups.length" class="empty-list">暂无自选基金，请使用顶部搜索添加</div>

    </div>

    <GroupManager
      v-if="showManager"
      :groups="groups"
      :counts="groupCounts"
      :default-group="DEFAULT_GROUP"
      :funds="fundsByGroup"
      @close="showManager = false"
      @create="createGroup"
      @rename="renameGroup"
      @delete="deleteGroup"
      @move="moveCode"
      @remove="removeCode"
    />

    <BaseModal v-if="showIndexManager" title="指数管理" @close="showIndexManager = false">
      <div class="index-manager">
        <p class="manager-tip">选择要展示的指数，可通过箭头调整顺序</p>
        <div v-for="(item, index) in indexDraft" :key="item.code" class="index-manager-row">
          <div class="index-check" role="checkbox" :aria-checked="true" @click="removeIndex(item.code)"><Check :size="15" /> <span>{{ item.name }}</span><em>{{ item.code }}</em></div>
          <div class="index-order"><div role="button" tabindex="0" :class="{ disabled: index === 0 }" @click="moveIndex(index, -1)">↑</div><div role="button" tabindex="0" :class="{ disabled: index === indexDraft.length - 1 }" @click="moveIndex(index, 1)">↓</div></div>
        </div>
        <div v-for="item in availableIndexOptions" :key="item.code" class="index-manager-row disabled-row">
          <div class="index-check" role="checkbox" :aria-checked="false" @click="addIndex(item)"><Plus :size="15" /> <span>{{ item.name }}</span><em>{{ item.code }}</em></div>
        </div>
        <div class="index-manager-footer"><div role="button" tabindex="0" class="manager-cancel" @click="showIndexManager = false">取消</div><div role="button" tabindex="0" class="manager-save" @click="saveIndices">保存</div></div>
      </div>
    </BaseModal>
  </main>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown, Plus, Search, Settings, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import GroupManager from '@/components/GroupManager.vue'
import BaseModal from '@/components/BaseModal.vue'
import QuoteRow from '@/components/QuoteRow.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import useQuotes from '@/composables/useQuotes'
import { AVAILABLE_INDICES } from '@/constants/indices'
import useWatchlistStore, { DEFAULT_GROUP } from '@/stores/watchlist'

const watchlist = useWatchlistStore()
const router = useRouter()
const editing = ref(false)
const showSearch = ref(false)
const showManager = ref(false)
const activeGroup = ref(DEFAULT_GROUP)
const collapsedGroups = ref(new Set<string>())
const searchQuery = ref('')
const pendingCode = ref('')
const showGroupPicker = ref(false)
const showIndexManager = ref(false)
const indexDraft = ref(AVAILABLE_INDICES.slice(0, 3))
const selectedIndices = ref(AVAILABLE_INDICES.slice(0, 3))
const searchVisible = ref(true)
const marketCompact = ref(false)
const searchLine = ref<HTMLElement>()
const marketSection = ref<HTMLElement>()
let lastScrollTop = 0
let marketStickyStart = 16
const groupElements = new Map<string, HTMLElement>()

const groups = computed(function () { return watchlist.orderedGroupNames() })
const allCodes = computed(function () { return watchlist.allCodes() })
const addedCodes = computed(function () { return new Set(allCodes.value) })
const groupTabs = computed(function () {
  return displayGroups.value.map(function (group) {
    return { value: group, label: group === DEFAULT_GROUP ? '默认分组' : group }
  })
})
const displayGroups = computed(function () { return groups.value })
const groupCounts = computed(function () {
  return Object.fromEntries(groups.value.map(function (group) {
    return [group, watchlist.state.groups[group]?.length ?? 0]
  }))
})
const fundsByGroup = computed(function () {
  return Object.fromEntries(groups.value.map(function (group) {
    return [group, (watchlist.state.groups[group] ?? []).map(function (code) {
      return { code, name: quoteMap.value[code]?.name ?? code }
    })]
  }))
})
const availableIndexOptions = computed(function () { const selected = new Set(indexDraft.value.map(function (item) { return item.code })); return AVAILABLE_INDICES.filter(function (item) { return !selected.has(item.code) }) })

const { quoteMap, start } = useQuotes()

const marketCards = computed(function () {
  return selectedIndices.value.map(function (item) {
    const quote = quoteMap.value[item.code]
    const changeValue = Number(quote?.gszzl ?? 0)
    return {
      code: item.code,
      name: item.name,
      price: quote?.gsz || quote?.dwjz || '--',
      change: quote ? `${changeValue >= 0 ? '+' : ''}${quote.gszzl}%` : '--',
      changeClass: !quote || changeValue === 0 ? 'flat' : changeValue > 0 ? 'up' : 'down'
    }
  })
})

watch(allCodes, function (codes) {
  const marketCodes = selectedIndices.value.map(function (item) { return item.code })
  start(Array.from(new Set([...marketCodes, ...codes])))
}, { immediate: true })

watch(selectedIndices, function (items) {
  localStorage.setItem('om-fund.indices', JSON.stringify(items.map(function (item) { return item.code })))
  const marketCodes = items.map(function (item) { return item.code })
  start(Array.from(new Set([...marketCodes, ...allCodes.value])))
}, { deep: true })

function addIndex (item: typeof AVAILABLE_INDICES[number]) { indexDraft.value = [...indexDraft.value, item] }
function removeIndex (code: string) { if (indexDraft.value.length <= 1) return; indexDraft.value = indexDraft.value.filter(function (item) { return item.code !== code }) }
function moveIndex (index: number, offset: number) { const target = index + offset; if (target < 0 || target >= indexDraft.value.length) return; const next = [...indexDraft.value]; const item = next.splice(index, 1)[0]; next.splice(target, 0, item); indexDraft.value = next }
function saveIndices () { selectedIndices.value = [...indexDraft.value]; showIndexManager.value = false }

function setGroupRef (group: string, element: unknown) {
  if (element instanceof HTMLElement) groupElements.set(group, element)
  else groupElements.delete(group)
}

async function selectGroup (group: string) {
  activeGroup.value = group
  await nextTick()
  const element = groupElements.get(group)
  if (!element) return
  const stickyOffset = 108
  const targetTop = window.scrollY + element.getBoundingClientRect().top - stickyOffset
  window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
}

function openIndex (code: string, name: string) {
  void router.push({ name: 'index-detail', params: { code }, query: { name } })
}

function toggleGroup (group: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(group)) next.delete(group)
  else next.add(group)
  collapsedGroups.value = next
}

function handleScroll () {
  const current = window.scrollY
  const delta = current - lastScrollTop
  if (current <= 16) searchVisible.value = true
  else if (delta < -8) searchVisible.value = true
  else if (delta > 8) searchVisible.value = false

  if (!marketCompact.value && current >= marketStickyStart + 2) marketCompact.value = true
  else if (marketCompact.value && current <= marketStickyStart - 6) marketCompact.value = false
  lastScrollTop = current
}

function updateMarketStickyStart () {
  if (!marketSection.value) return
  marketStickyStart = Math.max(0, marketSection.value.offsetTop - (searchLine.value?.offsetHeight ?? 0))
  handleScroll()
}

function toggleEditing () {
  editing.value = !editing.value
}

function handleAddRequest (code: string) {
  if (groups.value.length <= 1) {
    pendingCode.value = code
    return addToGroup(groups.value[0] || DEFAULT_GROUP)
  }
  pendingCode.value = code
  showGroupPicker.value = true
}

function addToGroup (group: string) {
  if (!pendingCode.value) return
  watchlist.add(pendingCode.value, group)
  pendingCode.value = ''
  showGroupPicker.value = false
}

function closeSearch () {
  searchQuery.value = ''
  showSearch.value = false
}

function moveCode (code: string, from: string, to: string) {
  watchlist.move(code, from, to)
}

function removeCode (code: string, group: string) {
  watchlist.remove(code, group)
}

function createGroup (name: string) {
  if (watchlist.createGroup(name)) activeGroup.value = name.trim()
}

function renameGroup (from: string, to: string) {
  if (!watchlist.renameGroup(from, to)) return
  if (activeGroup.value === from) activeGroup.value = to.trim()
}

function deleteGroup (name: string) {
  if (!watchlist.deleteGroup(name)) return
  if (activeGroup.value === name) activeGroup.value = DEFAULT_GROUP
}

function openIndexManager () { indexDraft.value = [...selectedIndices.value]; showIndexManager.value = true }

watch([showManager, showSearch, showGroupPicker, showIndexManager], function (visible) { document.body.style.overflow = visible.some(Boolean) ? 'hidden' : '' })

onMounted(function () {
  const saved = localStorage.getItem('om-fund.indices')
  if (saved) {
    try {
      const codes = JSON.parse(saved) as string[]
      const restored = codes.map(function (code) { return AVAILABLE_INDICES.find(function (item) { return item.code === code }) }).filter(function (item): item is typeof AVAILABLE_INDICES[number] { return Boolean(item) })
      if (restored.length) selectedIndices.value = restored
    } catch { /* ignore malformed local settings */ }
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', updateMarketStickyStart)
  updateMarketStickyStart()
})
onBeforeUnmount(function () {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', updateMarketStickyStart)
  document.body.style.overflow = ''
})
</script>

<style lang="less" scoped>
.home-page {
  min-height: 100vh;
  background: #f4f5f7;
}

.topbar-wrap {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-top: env(safe-area-inset-top);
  background: #fff;
  border-bottom: 1px solid #ebedf0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 720px;
  height: 52px;
  margin: 0 auto;
  padding: 0 16px;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-action,
.refresh-action,
.manage-action,
.group-settings,
.group-tab,
.empty-action {
  cursor: pointer;
}

.refresh-action {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 36px;
  color: #2878d0;
  font-size: 14px;
}

.refresh-icon {
  font-size: 19px;
  line-height: 1;
}

.refresh-icon.loading {
  animation: refresh-rotate 0.8s linear infinite;
}

.search-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: #33363b;
}

.search-icon {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
}

.search-icon::before {
  position: absolute;
  top: 1px;
  left: 1px;
  box-sizing: border-box;
  width: 10px;
  height: 10px;
  border: 2px solid currentcolor;
  border-radius: 50%;
  content: '';
}

.search-icon::after {
  position: absolute;
  right: 0;
  bottom: 2px;
  width: 7px;
  height: 2px;
  background: currentcolor;
  border-radius: 1px;
  content: '';
  transform: rotate(45deg);
}

.manage-action {
  padding: 7px 8px;
  color: #555960;
  font-size: 13px;
}

.manage-action.active {
  color: #2878d0;
}

.group-tabs {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 720px;
  height: 40px;
  margin: 0 auto;
  padding: 0 16px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.group-tabs::-webkit-scrollbar {
  display: none;
}

.group-tab {
  position: relative;
  height: 40px;
  flex: none;
  color: #72767d;
  font-size: 14px;
  line-height: 40px;
}

.group-tab.active {
  color: #202124;
  font-weight: 650;
}

.group-tab.active::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 20px;
  height: 3px;
  background: #2878d0;
  border-radius: 2px;
  content: '';
  transform: translateX(-50%);
}

.group-settings {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: auto;
  flex: none;
  color: #8c9096;
  font-size: 15px;
}

.page-content {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 0 calc(24px + env(safe-area-inset-bottom));
}

.quote-list {
  background: #fff;
  border-top: 1px solid #eceef1;
  border-bottom: 1px solid #eceef1;
}

.list-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px 78px;
  gap: 8px;
  align-items: center;
  height: 34px;
  padding: 0 16px;
  color: #9a9da3;
  font-size: 11px;
  border-bottom: 1px solid #eef0f2;
}

.list-header span:nth-child(n + 2) {
  text-align: right;
}

.empty-list {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 58px 20px 68px;
  color: #9a9da3;
}

.empty-list strong {
  color: #575b61;
  font-size: 15px;
  font-weight: 500;
}

.empty-list span {
  margin-top: 7px;
  font-size: 12px;
}

.empty-action {
  margin-top: 20px;
  padding: 8px 20px;
  color: #2878d0;
  font-size: 13px;
  border: 1px solid #2878d0;
  border-radius: 4px;
}

@keyframes refresh-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 720px) {
  .page-content {
    padding-top: 16px;
  }

  .quote-list {
    border: 1px solid #e7e9ec;
    border-radius: 6px;
  }
}

.home-page {
  min-height: 100vh;
  background: #f3f6fa;
}

.page-content {
  max-width: 640px;
  padding: 16px 0 84px;
}

.search-line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px 16px;
  max-height: 56px;
  opacity: 1;
  overflow: hidden;
  transition: max-height 0.22s ease, opacity 0.18s ease, padding 0.22s ease;
}

.search-line.hidden { max-height: 0; padding-top: 0; padding-bottom: 0; opacity: 0; }

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 40px;
  flex: 1;
  padding: 0 12px;
  color: #a0a8b5;
  font-size: 14px;
  background: #eaf0f7;
  border-radius: 22px;
}

.search-box input { min-width: 0; flex: 1; padding: 0; color: #273346; font-size: 16px; background: transparent; border: 0; outline: 0; }
.search-box input::placeholder { color: #a0a8b5; }
.search-box input::-webkit-search-cancel-button { display: none; }

.search-box .search-icon { color: #596778; }

.add-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: #1e2735;
  font-size: 26px;
  line-height: 1;
  background: #fff;
  border: 1px solid #dce3ec;
  border-radius: 50%;
}

.market-cards {
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding: 0 16px 14px;
  position: sticky;
  top: 0;
  z-index: 20;
  background: #f3f6fa;
  transition: padding 0.22s ease, gap 0.22s ease;
}

.market-scroll { display: flex; flex: 1; gap: 10px; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.market-scroll::-webkit-scrollbar { display: none; }
.market-settings { display: flex; align-items: center; justify-content: center; flex: 0 0 30px; color: #68778a; background: #fff; border: 1px solid #dce5ef; border-radius: 10px; cursor: pointer; }

.market-cards.compact { gap: 0; padding: 5px 10px; background: #fff; box-shadow: none; }
.market-cards.compact .market-scroll { gap: 0; }
.market-cards.compact .market-settings { flex-basis: 28px; border: 0; border-left: 1px solid #eef1f5; border-radius: 0; }

.market-card {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  flex: 0 0 118px;
  min-height: 76px;
  padding: 9px 10px 7px;
  background: #fff;
  border: 1px solid #dce5ef;
  border-radius: 13px;
  cursor: pointer;
  transition: min-height 0.22s ease, padding 0.22s ease, border-radius 0.22s ease;
}

.market-card span { max-width: 100%; color: #536174; font-size: 12px; opacity: 1; transition: max-width 0.22s ease, opacity 0.15s ease; }
.market-card strong { margin-top: 5px; color: #273346; font-size: 17px; line-height: 20px; }
.market-card strong.up { color: #ef4b4b; }
.market-card strong.down { color: #20a06b; }
.market-card strong.flat { color: #8994a3; }
.market-card small { margin-top: 8px; font-size: 15px; font-weight: 650; }
.market-card small.up { color: #ef4b4b; }
.market-card small.down { color: #20a06b; }
.market-card small.flat { color: #8994a3; }
.market-cards.compact .market-card { align-items: center; justify-content: center; flex-direction: column; min-height: 44px; padding: 3px 4px; background: transparent; border: 0; border-radius: 0; }
.market-cards.compact .market-card + .market-card { border-left: 1px solid #eef1f5; }
.market-cards.compact .market-card span { max-width: 0; overflow: hidden; opacity: 0; white-space: nowrap; }
.market-cards.compact .market-card strong { margin-top: 0; color: #263345; font-size: 14px; line-height: 18px; }
.market-cards.compact .market-card strong.up { color: #ef4b4b; }
.market-cards.compact .market-card strong.down { color: #20a06b; }
.market-cards.compact .market-card strong.flat { color: #8994a3; }
.market-cards.compact .market-card small { margin-top: 1px; font-size: 11px; line-height: 15px; }

.group-tabs {
  position: sticky;
  top: 58px;
  z-index: 19;
  display: flex;
  gap: 0;
  height: 48px;
  padding: 0 8px 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4eaf1;
  box-shadow: 0 4px 10px rgba(31, 47, 68, 0.08);
}

.group-tab-scroll { display: flex; align-items: center; gap: 25px; min-width: 0; flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.group-tab-scroll::-webkit-scrollbar { display: none; }
.group-tab { height: 48px; line-height: 48px; font-size: 15px; white-space: nowrap; }
.group-tab.active::after { width: 42px; height: 3px; background: #275ee8; }
.group-settings { display: flex; align-items: center; justify-content: center; width: 36px; height: 48px; margin-left: 5px; color: #68778a; cursor: pointer; }
.group-tabs.compact { top: 54px; }

.group-section { margin-top: 8px; }
.group-heading { display: flex; align-items: center; gap: 5px; height: 32px; padding: 0 16px; color: #6d7888; background: transparent; border: 0; border-radius: 0; cursor: pointer; transition: background 0.15s ease; }
.group-heading:active { background: #e9eef4; }
.group-heading strong { color: #657184; font-size: 12px; font-weight: 400; }
.chevron { flex: none; color: #aab4c1; transform: rotate(0); transition: transform 0.18s ease; }
.chevron.collapsed { transform: rotate(-90deg); }

.quote-list { margin-top: -1px; overflow: hidden; border: 1px solid #e1e8f0; border-radius: 12px; }
.list-header { grid-template-columns: minmax(0, 1fr) 88px 78px; height: 36px; padding: 0 16px; background: #f7f9fc; border-bottom: 0; }
.quote-list > .empty-list { min-height: 104px; padding: 38px 16px; background: #fff; }
.picker-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 70; display: flex; align-items: flex-end; justify-content: center; background: rgba(20, 28, 40, 0.32); }
.group-picker { width: 100%; max-width: 640px; padding: 18px 16px calc(16px + env(safe-area-inset-bottom)); background: #fff; border-radius: 16px 16px 0 0; }
.group-picker > strong { display: block; margin-bottom: 10px; color: #273346; font-size: 16px; }
.picker-option, .picker-cancel { height: 42px; padding: 0 12px; color: #2767e8; font-size: 14px; line-height: 42px; border-top: 1px solid #edf0f4; cursor: pointer; }
.picker-cancel { margin-top: 6px; color: #6d7888; text-align: center; background: #f5f7fa; border: 0; border-radius: 8px; }

.bottom-nav { position: fixed; right: 0; bottom: 0; left: 0; z-index: 30; display: flex; justify-content: space-around; max-width: 640px; height: 68px; margin: 0 auto; padding-bottom: env(safe-area-inset-bottom); background: #fff; border-top: 1px solid #e1e7ef; }
.bottom-item { display: flex; align-items: center; flex-direction: column; justify-content: center; gap: 3px; min-width: 44px; color: #526072; font-size: 19px; }
.bottom-item small { font-size: 11px; }
.bottom-item.active { color: #245de8; font-weight: 600; }

.index-manager { padding: 0 16px 20px; }
.manager-tip { margin: 0 0 10px; color: #8995a5; font-size: 12px; }
.index-manager-row { display: flex; align-items: center; justify-content: space-between; min-height: 48px; border-bottom: 1px solid #edf0f4; }
.index-check { display: flex; align-items: center; gap: 8px; flex: 1; color: #273346; font-size: 14px; cursor: pointer; }.index-check svg { color: #2878e8; }.index-check em { color: #9aa5b4; font-size: 11px; font-style: normal; }.disabled-row .index-check { color: #8995a5; }.disabled-row .index-check svg { color: #b4bfcc; }
.index-order { display: flex; gap: 5px; }.index-order div { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; color: #2878e8; background: #f1f6ff; border-radius: 7px; cursor: pointer; }.index-order div.disabled { color: #c5ceda; background: #f5f6f8; cursor: default; }
.index-manager-footer { display: flex; gap: 10px; margin-top: 18px; }.manager-cancel, .manager-save { flex: 1; padding: 10px 0; border-radius: 10px; text-align: center; font-size: 14px; cursor: pointer; }.manager-cancel { color: #5e6c7e; background: #f1f3f6; }.manager-save { color: #fff; background: #2878e8; }

@media (min-width: 720px) {
  .bottom-nav { border-right: 1px solid #e1e7ef; border-left: 1px solid #e1e7ef; }
}
</style>
