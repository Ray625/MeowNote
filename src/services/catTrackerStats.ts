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

export interface SumDailyBucket {
  key: string
  label: string
  start: Date
  end: Date
  total: number
}

export interface SumDailyStats {
  category: EventCategory
  mode: 'sum'
  rangeTotal: number
  currentDayTotal: number
  maxDailyTotal: number
  minDailyTotal: number
  buckets: SumDailyBucket[]
  latestOccurredAt?: string
}

export interface MeasurementPoint {
  key: string
  label: string
  occurredAt?: string
  value?: number
}

export interface MeasurementStats {
  category: EventCategory
  mode: 'measurement'
  interval: 'day' | 'week'
  latestValue: number
  maxValue: number
  minValue: number
  sampleCount: number
  points: MeasurementPoint[]
  latestOccurredAt: string
}

export interface CountTrendStatsInput {
  categories: EventCategory[]
  events: CatEvent[]
  catId: string
  interval?: 'day' | 'week' | 'month'
  referenceDate?: Date
  periods?: number
}

export interface SumDailyStatsInput {
  categories: EventCategory[]
  events: CatEvent[]
  catId: string
  categoryId: string
  referenceDate?: Date
  days?: number
}

export interface MeasurementStatsInput {
  categories: EventCategory[]
  events: CatEvent[]
  catId: string
  categoryId: string
  interval?: 'day' | 'week'
  referenceDate?: Date
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

export function getSumDailyStats({
  categories,
  events,
  catId,
  categoryId,
  referenceDate = new Date(),
  days = 7,
}: SumDailyStatsInput): SumDailyStats | undefined {
  if (!catId || !categoryId || days <= 0) {
    return undefined
  }

  const category = categories.find(
    (item) => item.id === categoryId && item.statisticsMode === 'sum',
  )

  if (!category) {
    return undefined
  }

  const anchorStart = startOfDay(referenceDate)
  const rangeStart = addDays(anchorStart, -(days - 1))
  const rangeEnd = addDays(anchorStart, 1)
  const buckets = createSumDayBuckets(rangeStart, days)
  let latestOccurredAt: string | undefined

  const scopedEvents = events
    .filter((event) => event.catId === catId && event.categoryId === categoryId)
    .filter((event) => {
      const occurredAt = new Date(event.occurredAt)

      return occurredAt >= rangeStart && occurredAt < rangeEnd
    })

  for (const event of scopedEvents) {
    const occurredAt = new Date(event.occurredAt)
    const amount = getNumericAmount(event.values)

    if (typeof amount !== 'number') {
      continue
    }

    if (!latestOccurredAt || event.occurredAt > latestOccurredAt) {
      latestOccurredAt = event.occurredAt
    }

    const bucket = buckets.find((item) => occurredAt >= item.start && occurredAt < item.end)

    if (bucket) {
      bucket.total += amount
    }
  }

  const rangeTotal = buckets.reduce((total, bucket) => total + bucket.total, 0)
  const currentDayTotal = buckets.at(-1)?.total ?? 0
  const bucketTotals = buckets.map((bucket) => bucket.total)

  return {
    category,
    mode: 'sum',
    rangeTotal,
    currentDayTotal,
    maxDailyTotal: Math.max(...bucketTotals, 0),
    minDailyTotal: Math.min(...bucketTotals),
    buckets,
    latestOccurredAt,
  }
}

export function getMeasurementStats({
  categories,
  events,
  catId,
  categoryId,
  interval = 'week',
  referenceDate = new Date(),
}: MeasurementStatsInput): MeasurementStats | undefined {
  if (!catId || !categoryId) {
    return undefined
  }

  const category = categories.find(
    (item) => item.id === categoryId && item.statisticsMode === 'measurement',
  )

  if (!category) {
    return undefined
  }

  const anchorStart = startOfDay(referenceDate)
  const rangeStart = interval === 'day' ? anchorStart : addDays(anchorStart, -6)
  const rangeEnd = addDays(anchorStart, 1)
  const scopedEvents = events
    .filter((event) => event.catId === catId && event.categoryId === categoryId)
    .map((event) => ({ event, value: getNumericAmount(event.values) }))
    .filter((item): item is { event: CatEvent; value: number } => {
      if (typeof item.value !== 'number') {
        return false
      }

      const occurredAt = new Date(item.event.occurredAt)

      return occurredAt >= rangeStart && occurredAt < rangeEnd
    })
    .sort((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt))

  if (scopedEvents.length === 0) {
    return undefined
  }

  const values = scopedEvents.map((item) => item.value)
  const latest = scopedEvents[scopedEvents.length - 1]!
  const points =
    interval === 'day'
      ? scopedEvents.map(({ event, value }) => ({
          key: event.id,
          label: formatTimeLabel(new Date(event.occurredAt)),
          occurredAt: event.occurredAt,
          value,
        }))
      : createMeasurementWeekPoints(rangeStart, scopedEvents)

  return {
    category,
    mode: 'measurement',
    interval,
    latestValue: latest.value,
    maxValue: Math.max(...values),
    minValue: Math.min(...values),
    sampleCount: scopedEvents.length,
    points,
    latestOccurredAt: latest.event.occurredAt,
  }
}

function createSumDayBuckets(start: Date, days: number): SumDailyBucket[] {
  return Array.from({ length: days }, (_, index) => {
    const bucketStart = addDays(start, index)
    const bucketEnd = addDays(bucketStart, 1)

    return {
      key: toDateKey(bucketStart),
      label: formatDayLabel(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      total: 0,
    }
  })
}

function createMeasurementWeekPoints(
  start: Date,
  scopedEvents: Array<{ event: CatEvent; value: number }>,
): MeasurementPoint[] {
  const latestByDate = new Map<string, { event: CatEvent; value: number }>()

  for (const item of scopedEvents) {
    latestByDate.set(toDateKey(new Date(item.event.occurredAt)), item)
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index)
    const key = toDateKey(date)
    const latest = latestByDate.get(key)

    return {
      key,
      label: formatDayLabel(date),
      occurredAt: latest?.event.occurredAt,
      value: latest?.value,
    }
  })
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

function getNumericAmount(values?: Record<string, unknown>): number | undefined {
  const amount = values?.amount
  const numericAmount =
    typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : undefined

  return typeof numericAmount === 'number' && Number.isFinite(numericAmount)
    ? numericAmount
    : undefined
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
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatTimeLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatMonthLabel(date: Date): string {
  return `${date.getMonth() + 1}月`
}
