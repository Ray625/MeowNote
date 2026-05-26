import type { CatEvent, EventCategory } from '@/types'

export interface CountTrendBucket {
  key: string
  label: string
  start: Date
  end: Date
  count: number
}

export interface CountCategoryStats {
  category: EventCategory
  mode: 'count'
  recentTotal: number
  previousTotal: number
  delta: number
  buckets: CountTrendBucket[]
  latestOccurredAt?: string
}

export interface CountTrendStatsInput {
  categories: EventCategory[]
  events: CatEvent[]
  catId: string
  interval?: 'day' | 'week' | 'month'
  referenceDate?: Date
  periods?: number
}

export function getCountTrendStats({
  categories,
  events,
  catId,
  interval = 'week',
  referenceDate = new Date(),
  periods = interval === 'day' ? 7 : interval === 'week' ? 8 : 6,
}: CountTrendStatsInput): CountCategoryStats[] {
  if (!catId || periods <= 0) {
    return []
  }

  const countCategories = categories.filter((category) => category.statisticsMode === 'count')
  const countCategoryIds = new Set(countCategories.map((category) => category.id))
  const categoryById = new Map(countCategories.map((category) => [category.id, category]))
  const anchorStart =
    interval === 'day'
      ? startOfDay(referenceDate)
      : interval === 'week'
        ? startOfWeek(referenceDate)
        : startOfMonth(referenceDate)
  const recentStart =
    interval === 'day'
      ? addDays(anchorStart, -(periods - 1))
      : interval === 'week'
        ? addWeeks(anchorStart, -(periods - 1))
        : addMonths(anchorStart, -(periods - 1))
  const recentEnd =
    interval === 'day'
      ? addDays(anchorStart, 1)
      : interval === 'week'
        ? addWeeks(anchorStart, 1)
        : addMonths(anchorStart, 1)
  const previousStart =
    interval === 'day'
      ? addDays(recentStart, -periods)
      : interval === 'week'
        ? addWeeks(recentStart, -periods)
        : addMonths(recentStart, -periods)

  const scopedEvents = events
    .filter((event) => event.catId === catId)
    .filter((event) => countCategoryIds.has(event.categoryId))
    .filter((event) => {
      const occurredAt = new Date(event.occurredAt)

      return occurredAt >= previousStart && occurredAt < recentEnd
    })

  return countCategories
    .map((category) => {
      const categoryEvents = scopedEvents.filter((event) => event.categoryId === category.id)
      const buckets =
        interval === 'day'
          ? createDayBuckets(recentStart, periods)
          : interval === 'week'
          ? createWeekBuckets(recentStart, periods)
          : createMonthBuckets(recentStart, periods)
      let previousTotal = 0
      let latestOccurredAt: string | undefined

      for (const event of categoryEvents) {
        const occurredAt = new Date(event.occurredAt)

        if (!latestOccurredAt || event.occurredAt > latestOccurredAt) {
          latestOccurredAt = event.occurredAt
        }

        if (occurredAt >= recentStart && occurredAt < recentEnd) {
          const bucket = buckets.find((item) => occurredAt >= item.start && occurredAt < item.end)

          if (bucket) {
            bucket.count += 1
          }
          continue
        }

        if (occurredAt >= previousStart && occurredAt < recentStart) {
          previousTotal += 1
        }
      }

      const recentTotal = buckets.reduce((total, bucket) => total + bucket.count, 0)

      return {
        category,
        mode: 'count' as const,
        recentTotal,
        previousTotal,
        delta: recentTotal - previousTotal,
        buckets,
        latestOccurredAt,
      }
    })
    .filter((stats) => stats.recentTotal > 0 || stats.previousTotal > 0)
    .sort((a, b) => {
      const totalOrder = b.recentTotal - a.recentTotal

      if (totalOrder !== 0) {
        return totalOrder
      }

      return a.category.sortOrder - b.category.sortOrder
    })
    .filter((stats) => categoryById.has(stats.category.id))
}

function createDayBuckets(start: Date, days: number): CountTrendBucket[] {
  return Array.from({ length: days }, (_, index) => {
    const bucketStart = addDays(start, index)
    const bucketEnd = addDays(bucketStart, 1)

    return {
      key: toDateKey(bucketStart),
      label: formatDayLabel(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      count: 0,
    }
  })
}

function createWeekBuckets(start: Date, weeks: number): CountTrendBucket[] {
  return Array.from({ length: weeks }, (_, index) => {
    const bucketStart = addWeeks(start, index)
    const bucketEnd = addWeeks(bucketStart, 1)

    return {
      key: toDateKey(bucketStart),
      label: formatWeekLabel(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      count: 0,
    }
  })
}

function createMonthBuckets(start: Date, months: number): CountTrendBucket[] {
  return Array.from({ length: months }, (_, index) => {
    const bucketStart = addMonths(start, index)
    const bucketEnd = addMonths(bucketStart, 1)

    return {
      key: `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, '0')}`,
      label: formatMonthLabel(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      count: 0,
    }
  })
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function startOfWeek(date: Date): Date {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day

  value.setDate(value.getDate() + diff)
  value.setHours(0, 0, 0, 0)

  return value
}

function addWeeks(date: Date, weeks: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + weeks * 7)
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatWeekLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(date)
}

function formatMonthLabel(date: Date): string {
  return `${date.getMonth() + 1}月`
}
