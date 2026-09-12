import type { ApiResponse, FundDetail, FundQuote, FundSearchResult, IndexKlinePoint, IndexTrendPoint } from '@/types/fund'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

async function request<T> (path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `请求失败（${response.status}）`)
  }

  const payload = await response.json() as ApiResponse<T>
  return payload.data
}

export function searchFunds (query: string, signal?: AbortSignal): Promise<FundSearchResult[]> {
  return request(`/search?q=${encodeURIComponent(query)}`, signal)
}

export function fetchQuotes (codes: string[], signal?: AbortSignal): Promise<FundQuote[]> {
  return request(`/quotes?codes=${encodeURIComponent(codes.join(','))}`, signal)
}

export function fetchFundDetail (code: string, signal?: AbortSignal): Promise<FundDetail> {
  return request(`/fund-detail?code=${encodeURIComponent(code)}`, signal)
}

export function fetchIndexTrends (code: string, signal?: AbortSignal): Promise<IndexTrendPoint[]> {
  return request(`/index-trends?code=${encodeURIComponent(code)}`, signal)
}

export function fetchIndexKline (code: string, period: string, signal?: AbortSignal): Promise<IndexKlinePoint[]> {
  return request(`/index-kline?code=${encodeURIComponent(code)}&period=${encodeURIComponent(period)}`, signal)
}
