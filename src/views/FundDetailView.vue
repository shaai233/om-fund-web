<template>
  <main class="detail-page">
    <header class="topbar-wrap">
      <div class="topbar">
        <div class="back" role="button" tabindex="0" aria-label="返回" @click="router.back()">←</div>
        <div class="title">{{ displayName }}</div>
      </div>
    </header>

    <div class="detail-content">
      <section class="quote-hero">
        <span>{{ code }} · 基金</span>
        <strong>{{ currentPrice }}</strong>
        <div v-if="quote" class="quote-meta">
          <span :class="changeValue >= 0 ? 'up' : 'down'">{{ formatPercent(changeValue) }}</span>
          <small>估值时间 {{ quote.gztime || '--' }}</small>
        </div>
        <div v-else-if="loading" class="loading-line">正在加载最新估值…</div>
      </section>

      <section class="chart-card">
        <div class="section-title">净值走势</div>
        <div class="range-tabs">
          <div
            v-for="range in ranges"
            :key="range.value"
            :class="['range-tab', { active: selectedRange === range.value }]"
            role="button"
            tabindex="0"
            @click="selectedRange = range.value"
          >{{ range.label }}</div>
        </div>

        <div v-if="chartPoints" class="chart-wrap">
          <div class="chart-label max">{{ chartMax.toFixed(4) }}</div>
          <svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="基金净值走势">
            <defs>
              <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="chartColor" stop-opacity="0.22" />
                <stop offset="100%" :stop-color="chartColor" stop-opacity="0.01" />
              </linearGradient>
            </defs>
            <line v-for="y in [20, 80, 140, 200]" :key="y" x1="0" :y1="y" x2="700" :y2="y" class="grid-line" />
            <polygon :points="areaPoints" fill="url(#chart-area)" />
            <polyline :points="chartPoints" fill="none" :stroke="chartColor" stroke-width="2" vector-effect="non-scaling-stroke" />
          </svg>
          <div class="chart-label min">{{ chartMin.toFixed(4) }}</div>
          <div class="chart-dates">
            <span>{{ filteredHistory[0]?.date ?? '' }}</span>
            <span>{{ filteredHistory[filteredHistory.length - 1]?.date ?? '' }}</span>
          </div>
        </div>
        <div v-else class="chart-empty">
          {{ loading ? '正在加载走势数据…' : error || '暂无走势数据' }}
        </div>
      </section>

      <section class="info-card">
        <div class="section-title">基金概览</div>
        <div class="info-row"><span>基金代码</span><strong>{{ code }}</strong></div>
        <div class="info-row"><span>近 6 月收益</span><strong :class="valueClass(detail?.returnSixMonth)">{{ withPercent(detail?.returnSixMonth) }}</strong></div>
        <div class="info-row"><span>近 1 年收益</span><strong :class="valueClass(detail?.returnOneYear)">{{ withPercent(detail?.returnOneYear) }}</strong></div>
        <div class="info-row"><span>手续费率</span><strong>{{ withPercent(detail?.feeRate) }}</strong></div>
      </section>

      <div
        :class="['primary-action', { added }]"
        role="button"
        tabindex="0"
        @click="addToWatchlist"
      >
        {{ added ? '✓ 已添加到自选' : '+ 添加到自选' }}
      </div>

      <p class="risk-tip">数据来自公开市场信息，可能存在延迟，仅供参考，不构成投资建议。</p>
    </div>
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchFundDetail, fetchQuotes } from '@/services/fund'
import useWatchlistStore from '@/stores/watchlist'
import type { FundDetail, FundNetWorthPoint, FundQuote } from '@/types/fund'

type TimeRange = '1m' | '3m' | '6m' | '1y' | '3y' | 'all'

const route = useRoute()
const router = useRouter()
const watchlist = useWatchlistStore()
const code = String(route.params.code)
const quote = ref<FundQuote>()
const detail = ref<FundDetail>()
const loading = ref(true)
const error = ref('')
const selectedRange = ref<TimeRange>('3m')
const controller = new AbortController()

const ranges: Array<{ value: TimeRange, label: string, months?: number }> = [
  { value: '1m', label: '1月', months: 1 },
  { value: '3m', label: '3月', months: 3 },
  { value: '6m', label: '6月', months: 6 },
  { value: '1y', label: '1年', months: 12 },
  { value: '3y', label: '3年', months: 36 },
  { value: 'all', label: '全部' }
]

const displayName = computed(function () {
  return detail.value?.name || quote.value?.name || String(route.query.name || code)
})
const currentPrice = computed(function () { return quote.value?.gsz || quote.value?.dwjz || '--' })
const changeValue = computed(function () { return Number(quote.value?.gszzl ?? 0) })
const chartColor = computed(function () { return changeValue.value >= 0 ? '#e14b52' : '#22a06b' })
const added = computed(function () { return watchlist.allCodes().includes(code) })

const filteredHistory = computed(function () {
  const history = detail.value?.history ?? []
  const months = ranges.find(function (range) { return range.value === selectedRange.value })?.months
  if (!months) return history
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return history.filter(function (point) { return new Date(point.date) >= cutoff })
})

const chartMin = computed(function () {
  const values = filteredHistory.value.map(function (point) { return point.nav })
  return Math.min(...values)
})

const chartMax = computed(function () {
  const values = filteredHistory.value.map(function (point) { return point.nav })
  return Math.max(...values)
})

const chartCoordinates = computed(function () {
  const history = filteredHistory.value
  if (history.length < 2) return []
  const spread = chartMax.value - chartMin.value || 1
  return history.map(function (point: FundNetWorthPoint, index: number) {
    return {
      x: index / (history.length - 1) * 700,
      y: 200 - (point.nav - chartMin.value) / spread * 180
    }
  })
})

const chartPoints = computed(function () {
  return chartCoordinates.value.map(function (point) { return `${point.x},${point.y}` }).join(' ')
})

const areaPoints = computed(function () {
  if (!chartCoordinates.value.length) return ''
  return `0,220 ${chartPoints.value} 700,220`
})

function formatPercent (value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function withPercent (value?: string): string {
  return value && value !== '--' ? `${value}%` : '--'
}

function valueClass (value?: string): string {
  if (!value || value === '--') return ''
  return Number(value) >= 0 ? 'up' : 'down'
}

function addToWatchlist () {
  if (!added.value) watchlist.add(code)
}

async function loadData () {
  loading.value = true
  error.value = ''
  const [quoteResult, detailResult] = await Promise.allSettled([
    fetchQuotes([code], controller.signal),
    fetchFundDetail(code, controller.signal)
  ])
  if (quoteResult.status === 'fulfilled') quote.value = quoteResult.value[0]
  if (detailResult.status === 'fulfilled') detail.value = detailResult.value
  if (quoteResult.status === 'rejected' && detailResult.status === 'rejected') error.value = '数据加载失败，请稍后重试'
  loading.value = false
}

onMounted(function () { void loadData() })
onBeforeUnmount(function () { controller.abort() })
</script>

<style lang="less" scoped>
.detail-page {
  min-height: 100vh;
  background: var(--color-background);
}

.topbar-wrap {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-top: env(safe-area-inset-top);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.topbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 720px;
  height: 44px;
  margin: 0 auto;
}

.back {
  position: absolute;
  top: 50%;
  left: 16px;
  width: 36px;
  height: 36px;
  color: var(--color-text);
  font-size: 22px;
  line-height: 36px;
  cursor: pointer;
  transform: translateY(-50%);
}

.title {
  max-width: 65%;
  overflow: hidden;
  color: var(--color-text);
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-content {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 0 calc(24px + env(safe-area-inset-bottom));
}

.quote-hero {
  padding: 22px 16px 20px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.quote-hero > span {
  display: block;
  color: var(--color-text-tertiary);
  font-size: 11px;
}

.quote-hero > strong {
  display: block;
  margin: 5px 0 6px;
  color: var(--color-text);
  font-size: 38px;
  font-weight: 600;
  letter-spacing: -1px;
}

.quote-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
}

.quote-hero small {
  color: var(--color-text-tertiary);
  font-size: 10px;
  font-weight: 400;
}

.up { color: var(--color-up); }
.down { color: var(--color-down); }
.loading-line { color: var(--color-text-tertiary); }

.chart-card,
.info-card {
  margin-top: 10px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.chart-card {
  padding: 0 16px 12px;
}

.section-title {
  height: 44px;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 44px;
}

.range-tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
}

.range-tab {
  flex: 1;
  padding: 6px 2px;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-align: center;
  cursor: pointer;
  border-radius: 3px;
}

.range-tab.active {
  color: var(--color-primary);
  font-weight: 600;
  background: var(--color-primary-light);
}

.chart-wrap {
  position: relative;
  height: 260px;
  margin-top: 14px;
}

.chart-wrap svg {
  width: 100%;
  height: 220px;
  overflow: visible;
}

.grid-line {
  stroke: var(--color-border);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.chart-label {
  position: absolute;
  right: 4px;
  z-index: 2;
  color: var(--color-text-tertiary);
  font-size: 9px;
}

.chart-label.max { top: 6px; }
.chart-label.min { top: 196px; }

.chart-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  color: var(--color-text-tertiary);
  font-size: 9px;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 230px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.info-card {
  padding: 0 16px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-top: 1px solid var(--color-border);
}

.section-title + .info-row {
  border-top: 0;
}

.info-row span {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.info-row strong {
  font-size: 13px;
}

.primary-action {
  margin: 14px 16px 0;
  padding: 12px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  background: var(--color-primary);
  border-radius: 4px;
  cursor: pointer;
}

.primary-action.added {
  color: var(--color-text-tertiary);
  background: #e9ebee;
}

.risk-tip {
  margin: 12px 16px 0;
  color: var(--color-text-tertiary);
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}
</style>
