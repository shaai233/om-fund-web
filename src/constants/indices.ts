import type { FundSearchResult } from '@/types/fund'

export interface IndexMetadata extends FundSearchResult {
  secid: string
  kind: 'index'
}

export const AVAILABLE_INDICES: IndexMetadata[] = [
  { secid: '1.000001', code: '000001', name: '上证指数', kind: 'index' },
  { secid: '0.399001', code: '399001', name: '深证成指', kind: 'index' },
  { secid: '0.399006', code: '399006', name: '创业板指', kind: 'index' },
  { secid: '1.000016', code: '000016', name: '上证50', kind: 'index' },
  { secid: '1.000300', code: '000300', name: '沪深300', kind: 'index' },
  { secid: '0.399005', code: '399005', name: '中小板指', kind: 'index' }
]

export function searchIndices (query: string): FundSearchResult[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return []

  return AVAILABLE_INDICES.filter(function (item) {
    return item.code.includes(keyword)
      || item.secid.toLowerCase().includes(keyword)
      || item.name.toLowerCase().includes(keyword)
  })
}
