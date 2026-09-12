import { describe, expect, it } from 'vitest'
import { isTradingTime, quoteRefreshInterval } from '@/utils/market-time'

describe('market time', function () {
  it('recognizes China morning and afternoon sessions', function () {
    expect(isTradingTime(new Date('2026-09-02T01:30:00.000Z'))).toBe(true)
    expect(isTradingTime(new Date('2026-09-02T05:00:00.000Z'))).toBe(true)
  })

  it('excludes lunch break, closing time and weekends', function () {
    expect(isTradingTime(new Date('2026-09-02T03:31:00.000Z'))).toBe(false)
    expect(isTradingTime(new Date('2026-09-02T07:01:00.000Z'))).toBe(false)
    expect(isTradingTime(new Date('2026-09-05T02:00:00.000Z'))).toBe(false)
  })

  it('uses a slower refresh interval outside trading time', function () {
    expect(quoteRefreshInterval(new Date('2026-09-02T01:30:00.000Z'))).toBe(15_000)
    expect(quoteRefreshInterval(new Date('2026-09-02T08:00:00.000Z'))).toBe(60_000)
  })
})
