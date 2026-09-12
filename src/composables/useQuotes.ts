import { computed, onBeforeUnmount, readonly, ref } from 'vue'
import { fetchQuotes } from '@/services/fund'
import type { FundQuote } from '@/types/fund'
import { quoteRefreshInterval } from '@/utils/market-time'

const QUOTE_CACHE_KEY = 'omfund.web.quotes.v1'

function loadQuoteCache (): Record<string, FundQuote> {
  try {
    return JSON.parse(localStorage.getItem(QUOTE_CACHE_KEY) ?? '{}') as Record<string, FundQuote>
  } catch {
    return {}
  }
}

export default function useQuotes () {
  const quoteMap = ref<Record<string, FundQuote>>(loadQuoteCache())
  const loading = ref(false)
  const error = ref('')
  const lastUpdated = ref<Date>()
  const offline = ref(!navigator.onLine)
  let timer: number | undefined
  let activeController: AbortController | undefined
  let latestCodes: string[] = []

  const statusText = computed(function () {
    if (offline.value) return '离线 · 显示最近数据'
    if (loading.value) return '正在更新行情'
    if (error.value) return error.value
    if (!lastUpdated.value) return '等待行情数据'
    return `更新于 ${lastUpdated.value.toLocaleTimeString('zh-CN', { hour12: false })}`
  })

  async function refresh (codes = latestCodes) {
    latestCodes = [...codes]
    if (!codes.length) {
      loading.value = false
      return
    }

    activeController?.abort()
    activeController = new AbortController()
    loading.value = true
    error.value = ''

    try {
      const quotes = await fetchQuotes(codes, activeController.signal)
      const next = { ...quoteMap.value }
      quotes.forEach(function (quote) { next[quote.fundcode] = quote })
      quoteMap.value = next
      localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(next))
      lastUpdated.value = new Date()
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      error.value = navigator.onLine ? '行情更新失败' : '离线 · 显示最近数据'
    } finally {
      loading.value = false
    }
  }

  function start (codes: string[]) {
    latestCodes = [...codes]
    window.clearTimeout(timer)
    void refresh(codes)

    const schedule = function () {
      timer = window.setTimeout(async function () {
        await refresh()
        schedule()
      }, quoteRefreshInterval())
    }
    schedule()
  }

  function onOnline () {
    offline.value = false
    void refresh()
  }

  function onOffline () {
    offline.value = true
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  onBeforeUnmount(function () {
    window.clearTimeout(timer)
    activeController?.abort()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  })

  return {
    quoteMap: readonly(quoteMap),
    loading: readonly(loading),
    offline: readonly(offline),
    statusText,
    refresh,
    start
  }
}
