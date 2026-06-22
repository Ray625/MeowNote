import type { CatEvent, EventCategory } from '@/types'
import type { StatsOverviewRange, StatsOverviewRangeMode } from '@/services/statsOverviewRange'

export interface CountOverviewSummary {
  mode: 'count'
  category: EventCategory
  currentTotal: number
  previousTotal: number
  delta: number
}

interface CountOverviewSummaryInput {
  category: EventCategory
  events: CatEvent[]
  catId: string
  currentRange: StatsOverviewRange
  previousRange: StatsOverviewRange
}

export function getCountOverviewSummary({
  category,
  events,
  catId,
  currentRange,
  previousRange,
}: CountOverviewSummaryInput): CountOverviewSummary {
  const categoryEvents = events.filter(
    (event) => event.catId === catId && event.categoryId === category.id,
  )
  const currentTotal = countEventsInRange(categoryEvents, currentRange)
  const previousTotal = countEventsInRange(categoryEvents, previousRange)

  return {
    mode: 'count',
    category,
    currentTotal,
    previousTotal,
    delta: currentTotal - previousTotal,
  }
}

export function getCurrentCountLabel(mode: StatsOverviewRangeMode): string {
  if (mode === 'day') {
    return '當日總次數'
  }

  if (mode === 'halfYear') {
    return '近半年總次數'
  }

  if (mode === 'year') {
    return '近 1 年總次數'
  }

  return `近 ${mode.replace('d', '')} 日總次數`
}

export function getPreviousPeriodLabel(mode: StatsOverviewRangeMode): string {
  if (mode === 'day') {
    return '前日'
  }

  if (mode === 'halfYear') {
    return '前半年'
  }

  if (mode === 'year') {
    return '前 1 年'
  }

  return `前 ${mode.replace('d', '')} 日`
}

export function formatCountDelta(delta: number): string {
  if (delta > 0) {
    return `+${delta} 次`
  }

  if (delta < 0) {
    return `${delta} 次`
  }

  return '±0 次'
}

function countEventsInRange(events: CatEvent[], range: StatsOverviewRange): number {
  const startTime = startOfDay(range.start).getTime()
  const endTime = addDays(startOfDay(range.end), 1).getTime()

  return events.filter((event) => {
    const occurredAt = new Date(event.occurredAt).getTime()

    return occurredAt >= startTime && occurredAt < endTime
  }).length
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}
