<template>
  <main class="index-page">
    <header class="index-header">
      <div class="back" role="button" tabindex="0" aria-label="返回" @click="router.back()"><ArrowLeft :size="20" /></div>
      <strong>{{ quote?.name || code }}</strong>
    </header>
    <section class="hero">
      <span>{{ code }} · 指数</span>
      <strong :class="changeClass">{{ quote?.gsz || '--' }}</strong>
      <div :class="changeClass">{{ quote ? `${Number(quote.change ?? 0) >= 0 ? '+' : ''}${quote.change ?? '0.00'} (${quote.gszzl}%)` : '--' }}</div>
    </section>
    <section class="stats">
      <div><span>开盘</span><strong :class="changeClass">{{ quote?.open || '--' }}</strong></div>
      <div><span>最高</span><strong :class="changeClass">{{ quote?.high || '--' }}</strong></div>
      <div><span>最低</span><strong :class="changeClass">{{ quote?.low || '--' }}</strong></div>
      <div><span>昨收</span><strong>{{ quote?.preClose || '--' }}</strong></div>
    </section>
    <section class="chart-card">
      <div class="period-tabs" role="tablist" aria-label="行情周期">
        <div v-for="item in periods" :key="item.value" class="period-tab" :class="{ active: selectedPeriod === item.value }" role="tab" :aria-selected="selectedPeriod === item.value" tabindex="0" @click="selectedPeriod = item.value">{{ item.label }}</div>
      </div>
      <div class="card-title">{{ periodLabel }}走势</div>
      <div v-if="points.length > 1" ref="chartWrap" class="chart-wrap" @pointermove="handlePointerMove" @pointerleave="clearActivePoint" @pointercancel="clearActivePoint">
        <svg ref="chartSvg" viewBox="0 0 700 240" preserveAspectRatio="none" aria-label="指数走势图">
          <polyline :points="chartPoints" fill="none" :stroke="chartColor" stroke-width="3" vector-effect="non-scaling-stroke" />
          <template v-if="activePoint">
            <line :x1="activePoint.x" y1="0" :x2="activePoint.x" y2="220" class="crosshair" />
            <circle :cx="activePoint.x" :cy="activePoint.y" r="5" :fill="chartColor" class="point-dot" />
          </template>
        </svg>
        <div v-if="activePoint" class="point-tooltip" :style="{ left: `${activePoint.percent}%` }">
          <strong>{{ formatPrice(activePoint.item.price) }}</strong>
          <span>{{ activePoint.item.time }}</span>
        </div>
        <div class="chart-axis"><span>{{ points[0]?.time.slice(-8) }}</span><span>{{ points.at(-1)?.time.slice(-8) }}</span></div>
      </div>
      <div v-else class="empty">{{ loading ? '正在加载行情数据…' : '暂无行情数据' }}</div>
    </section>
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { fetchIndexKline, fetchIndexTrends, fetchQuotes } from '@/services/fund'
import type { FundQuote, IndexKlinePoint, IndexTrendPoint } from '@/types/fund'

type Period = 'intraday' | '5d' | 'day' | 'week' | 'month'
interface ChartPoint { time: string; price: number }
interface ActivePoint { item: ChartPoint; index: number; x: number; y: number; percent: number }
const route = useRoute(); const router = useRouter(); const code = String(route.params.code)
const periods: Array<{ value: Period; label: string }> = [{ value: 'intraday', label: '分时' }, { value: '5d', label: '5日' }, { value: 'day', label: '日' }, { value: 'week', label: '周' }, { value: 'month', label: '月' }]
const selectedPeriod = ref<Period>('intraday'); const quote = ref<FundQuote>(); const points = ref<ChartPoint[]>([]); const loading = ref(true); const activePoint = ref<ActivePoint>(); const chartSvg = ref<SVGSVGElement>(); let controller: AbortController | undefined
const changeValue = computed(function () { return Number(quote.value?.gszzl ?? 0) })
const changeClass = computed(function () { return changeValue.value > 0 ? 'up' : changeValue.value < 0 ? 'down' : 'flat' })
const chartColor = computed(function () { return changeClass.value === 'down' ? '#20a06b' : '#ef4b4b' })
const periodLabel = computed(function () { return periods.find(function (item) { return item.value === selectedPeriod.value })?.label || '分时' })
const chartPoints = computed(function () { const values = points.value.map(function (item) { return item.price }); const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || 1; return points.value.map(function (item, index) { return `${index / (points.value.length - 1) * 700},${220 - (item.price - min) / spread * 190}` }).join(' ') })
const chartGeometry = computed(function () {
  const values = points.value.map(function (item) { return item.price })
  const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || 1
  return { min, spread }
})
function toChartPoints (items: IndexTrendPoint[] | IndexKlinePoint[]): ChartPoint[] { return items.map(function (item) { if ('price' in item) return { time: item.time, price: Number(item.price) }; return { time: item.time, price: Number(item.close) } }).filter(function (item) { return Number.isFinite(item.price) }) }
function formatPrice (price: number) { return price.toFixed(2) }
function handlePointerMove (event: PointerEvent) {
  if (!chartSvg.value || points.value.length < 2) return
  const rect = chartSvg.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const index = Math.round(percent * (points.value.length - 1))
  const item = points.value[index]
  if (!item) return
  const x = index / (points.value.length - 1) * 700
  const y = 220 - (item.price - chartGeometry.value.min) / chartGeometry.value.spread * 190
  activePoint.value = { item, index, x, y, percent: Math.max(12, Math.min(88, x / 7)) }
}
function clearActivePoint () { activePoint.value = undefined }
async function loadChart () {
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  loading.value = true
  try {
    const result = selectedPeriod.value === 'intraday'
      ? await fetchIndexTrends(code, requestController.signal)
      : await fetchIndexKline(code, selectedPeriod.value, requestController.signal)
    if (!requestController.signal.aborted) points.value = toChartPoints(result)
  } catch (error) {
    if ((error as Error).name !== 'AbortError' && !requestController.signal.aborted) points.value = []
  } finally {
    if (controller === requestController) loading.value = false
  }
}
watch(selectedPeriod, function () { void loadChart() })
onMounted(async function () {
  const result = await Promise.allSettled([fetchQuotes([code])])
  if (result[0].status === 'fulfilled') quote.value = result[0].value[0]
  await loadChart()
})
onBeforeUnmount(function () { controller?.abort() })
</script>

<style lang="less" scoped>
.index-page { min-height: 100vh; background: #f3f6fa; color: #273346; }.index-header { display: flex; align-items: center; justify-content: center; position: relative; height: 48px; background: #fff; border-bottom: 1px solid #e4e9f0; font-size: 16px; }.back { display: flex; align-items: center; position: absolute; left: 16px; cursor: pointer; }.hero { padding: 22px 16px; background: #fff; }.hero > span { display: block; color: #8995a5; font-size: 12px; }.hero > strong { display: block; margin: 8px 0 4px; font-size: 30px; }.up { color: #ef4b4b; }.down { color: #20a06b; }.flat { color: #8995a5; }.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin-top: 10px; background: #e8edf3; }.stats div { display: flex; align-items: center; flex-direction: column; gap: 5px; padding: 12px 4px; background: #fff; }.stats span { color: #8995a5; font-size: 11px; }.stats strong { font-size: 13px; }.chart-card { margin-top: 10px; padding: 16px; background: #fff; }.period-tabs { display: flex; gap: 22px; border-bottom: 1px solid #edf0f4; }.period-tab { position: relative; padding: 0 0 11px; color: #8995a5; font-size: 13px; cursor: pointer; }.period-tab.active { color: #2878e8; font-weight: 600; }.period-tab.active::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: #2878e8; content: ''; }.card-title { margin: 14px 0; font-size: 15px; font-weight: 600; }.chart-wrap svg { display: block; width: 100%; height: 220px; background: linear-gradient(#f4f7fa 1px, transparent 1px) 0 0 / 100% 25%; }.chart-axis { display: flex; justify-content: space-between; margin-top: 7px; color: #9aa5b4; font-size: 10px; }.empty { padding: 80px 0; color: #9aa5b4; text-align: center; font-size: 12px; }
.chart-wrap { position: relative; touch-action: none; }
.crosshair { stroke: #9aa5b4; stroke-dasharray: 4 4; stroke-width: 1; vector-effect: non-scaling-stroke; }
.point-dot { stroke: #fff; stroke-width: 2; vector-effect: non-scaling-stroke; }
.point-tooltip { display: flex; align-items: flex-start; flex-direction: column; position: absolute; top: 8px; z-index: 1; width: 94px; padding: 7px 9px; box-sizing: border-box; border: 1px solid #e4e9f0; border-radius: 6px; background: rgba(255, 255, 255, .96); box-shadow: 0 3px 10px rgba(33, 55, 80, .12); transform: translateX(-50%); pointer-events: none; }
.point-tooltip strong { color: #273346; font-size: 13px; line-height: 18px; }.point-tooltip span { color: #8995a5; font-size: 10px; line-height: 15px; white-space: nowrap; }
</style>
