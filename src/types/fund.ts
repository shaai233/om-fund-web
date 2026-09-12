export interface FundQuote {
  fundcode: string
  name: string
  jzrq: string
  dwjz: string
  gsz: string
  gszzl: string
  gztime: string
  kind: 'fund' | 'index'
  high?: string
  low?: string
  open?: string
  preClose?: string
  change?: string
  volume?: number
  amount?: number
  amplitude?: string
}

export interface IndexTrendPoint {
  time: string
  price: number
  average: number
}

export interface IndexKlinePoint {
  time: string
  open: number
  close: number
  high: number
  low: number
}

export interface FundSearchResult {
  code: string
  name: string
  kind: 'fund' | 'index'
}

export interface FundNetWorthPoint {
  date: string
  nav: number
}

export interface FundDetail {
  name: string
  code: string
  returnOneYear: string
  returnSixMonth: string
  feeRate: string
  history: FundNetWorthPoint[]
}

export interface ApiResponse<T> {
  data: T
  fetchedAt: string
}
