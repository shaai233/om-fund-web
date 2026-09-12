interface ChinaTimeParts {
  weekday: string
  hour: number
  minute: number
}

function chinaTimeParts (date: Date): ChinaTimeParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)

  const value = function (type: Intl.DateTimeFormatPartTypes) {
    return parts.find(function (part) { return part.type === type })?.value ?? ''
  }

  return {
    weekday: value('weekday'),
    hour: Number(value('hour')),
    minute: Number(value('minute'))
  }
}

export function isTradingTime (date = new Date()): boolean {
  const { weekday, hour, minute } = chinaTimeParts(date)
  if (weekday === 'Sat' || weekday === 'Sun') return false
  const morning = (hour === 9 && minute >= 30) || hour === 10 || (hour === 11 && minute <= 30)
  const afternoon = hour === 13 || hour === 14
  return morning || afternoon
}

export function quoteRefreshInterval (date = new Date()): number {
  return isTradingTime(date) ? 15_000 : 60_000
}
