import type {
  CountCategoryStats,
  CountTrendBucket,
  MeasurementPoint,
  MeasurementStats,
  RatingStats,
  SumDailyBucket,
  SumDailyStats,
} from '@/services/catTrackerStats'
import type {
  StatsOverviewRange,
  StatsOverviewRangeMode,
} from '@/services/statsOverviewRange'
import type { CatEvent, EventCategory } from '@/types'

type NumericEvent = {
  event: CatEvent
  value: number
}

type DetailBucket = {
  key: string
  label: string
  start: Date
  end: Date
}

interface DetailStatsInput {
  categories: EventCategory[]
  events: CatEvent[]
  catId: string
  categoryId: string
  rangeMode: StatsOverviewRangeMode
  currentRange: StatsOverviewRange
}

interface CountDetailStatsInput extends DetailStatsInput {
  previousRange: StatsOverviewRange
}

export function getCountDetailStats({
  categories,
  events,
  catId,
  categoryId,
  rangeMode,
  currentRange,
  previousRange,
}: CountDetailStatsInput): CountCategoryStats | undefined {
  const category = getCategory(categories, categoryId, 'count')

  if (!category || !catId) {
    return undefined
  }

  const categoryEvents = getCategoryEvents(events, catId, categoryId)
  const buckets: CountTrendBucket[] = createDetailBuckets(rangeMode, currentRange).map(
    (bucket) => ({
      ...bucket,
      count: countEventsInRange(categoryEvents, bucket),
    }),
  )
  const currentEvents = filterEventsInRange(categoryEvents, currentRange)
  const previousTotal = filterEventsInRange(categoryEvents, previousRange).length
  const recentTotal = currentEvents.length

  return {
    category,
    mode: 'count',
    recentTotal,
    previousTotal,
    delta: recentTotal - previousTotal,
    buckets,
    latestOccurredAt: getLatestEvent(currentEvents)?.occurredAt,
  }
}

export function getSumDetailStats({
  categories,
  events,
  catId,
  categoryId,
  rangeMode,
  currentRange,
}: DetailStatsInput): SumDailyStats | undefined {
  const category = getCategory(categories, categoryId, 'sum')

  if (!category || !catId) {
    return undefined
  }

  const numericEvents = getNumericEvents(
    filterEventsInRange(getCategoryEvents(events, catId, categoryId), currentRange),
  )

  if (numericEvents.length === 0) {
    return undefined
  }

  const dailyTotals = getDailyTotals(numericEvents)
  const detailBuckets = createDetailBuckets(rangeMode, currentRange)
  const buckets: SumDailyBucket[] = detailBuckets.map((bucket) => ({
    ...bucket,
    total:
      rangeMode === 'day' || rangeMode === '7d' || rangeMode === '30d'
        ? getTotalInRange(numericEvents, bucket)
        : getDailyAverageInRange(dailyTotals, bucket),
  }))
  const totals = Array.from(dailyTotals.values())
  const entryValues = numericEvents.map(({ value }) => value)
  const lastDayKey = formatDateKey(currentRange.end)

  return {
    category,
    mode: 'sum',
    rangeTotal: totals.reduce((total, value) => total + value, 0),
    currentDayTotal: dailyTotals.get(lastDayKey) ?? 0,
    maxDailyTotal: Math.max(...totals),
    minDailyTotal: Math.min(...totals),
    recordedDays: dailyTotals.size,
    sampleCount: numericEvents.length,
    maxEntryValue: Math.max(...entryValues),
    minEntryValue: Math.min(...entryValues),
    buckets,
    latestOccurredAt: getLatestNumericEvent(numericEvents)?.event.occurredAt,
  }
}

export function getMeasurementDetailStats({
  categories,
  events,
  catId,
  categoryId,
  rangeMode,
  currentRange,
}: DetailStatsInput): MeasurementStats | undefined {
  const category = getCategory(categories, categoryId, 'measurement')

  if (!category || !catId) {
    return undefined
  }

  const numericEvents = getNumericEvents(
    filterEventsInRange(getCategoryEvents(events, catId, categoryId), currentRange),
  ).sort((left, right) => left.event.occurredAt.localeCompare(right.event.occurredAt))

  if (numericEvents.length === 0) {
    return undefined
  }

  const values = numericEvents.map(({ value }) => value)
  const latest = numericEvents.at(-1)!
  const points = createMeasurementPoints(numericEvents, rangeMode, currentRange)

  return {
    category,
    mode: 'measurement',
    interval:
      getStatsDetailBucketGranularityLabel(rangeMode, currentRange) === '每月' ? 'month' : 'week',
    latestValue: latest.value,
    maxValue: Math.max(...values),
    minValue: Math.min(...values),
    sampleCount: numericEvents.length,
    points,
    latestOccurredAt: latest.event.occurredAt,
  }
}

export function getRatingDetailStats({
  categories,
  events,
  catId,
  categoryId,
  rangeMode,
  currentRange,
}: DetailStatsInput): RatingStats | undefined {
  const category = getCategory(categories, categoryId, 'rating')

  if (!category || !catId) {
    return undefined
  }

  const numericEvents = getNumericEvents(
    filterEventsInRange(getCategoryEvents(events, catId, categoryId), currentRange),
  ).sort((left, right) => left.event.occurredAt.localeCompare(right.event.occurredAt))

  if (numericEvents.length === 0) {
    return undefined
  }

  const values = numericEvents.map(({ value }) => value)
  const latest = numericEvents.at(-1)!
  const points =
    rangeMode === 'day'
      ? numericEvents.map(({ event, value }) => ({
          key: event.id,
          label: formatTimeLabel(new Date(event.occurredAt)),
          occurredAt: event.occurredAt,
          value,
        }))
      : createRatingPoints(numericEvents, rangeMode, currentRange)

  return {
    category,
    mode: 'rating',
    interval:
      rangeMode === 'day'
        ? 'day'
        : getStatsDetailBucketGranularityLabel(rangeMode, currentRange) === '每月'
          ? 'month'
          : 'week',
    latestValue: latest.value,
    maxValue: Math.max(...values),
    minValue: Math.min(...values),
    sampleCount: numericEvents.length,
    points,
    latestOccurredAt: latest.event.occurredAt,
  }
}

export function getStatsDetailBucketGranularityLabel(
  mode: StatsOverviewRangeMode,
  range: StatsOverviewRange | undefined,
): string {
  if (mode === 'day') {
    return '每 4 小時'
  }

  if (mode === '7d' || mode === '30d') {
    return '每日'
  }

  if (mode === 'custom' && range) {
    const dayCount = getRangeDayCount(range)

    if (dayCount === 1) {
      return '每 4 小時'
    }

    if (dayCount <= 30) {
      return '每日'
    }

    if (dayCount <= 120) {
      return '每週'
    }
  }

  return '每月'
}

function createMeasurementPoints(
  events: NumericEvent[],
  mode: StatsOverviewRangeMode,
  range: StatsOverviewRange,
): MeasurementPoint[] {
  if (mode === 'day') {
    return events.map(({ event, value }) => ({
      key: event.id,
      label: formatTimeLabel(new Date(event.occurredAt)),
      occurredAt: event.occurredAt,
      value,
    }))
  }

  return createDetailBuckets(mode, range).flatMap((bucket) => {
    const latest = events
      .filter(({ event }) => isDateInRange(new Date(event.occurredAt), bucket))
      .at(-1)

    if (!latest) {
      return []
    }

    return [
      {
        key: bucket.key,
        label: bucket.label,
        occurredAt: latest.event.occurredAt,
        value: latest.value,
      },
    ]
  })
}

function createRatingPoints(
  events: NumericEvent[],
  mode: StatsOverviewRangeMode,
  range: StatsOverviewRange,
): MeasurementPoint[] {
  const dailyValues = new Map<string, number[]>()

  for (const { event, value } of events) {
    const key = formatDateKey(new Date(event.occurredAt))

    dailyValues.set(key, [...(dailyValues.get(key) ?? []), value])
  }

  const dailyAverages = new Map(
    Array.from(dailyValues.entries()).map(([key, values]) => [
      key,
      values.reduce((sum, value) => sum + value, 0) / values.length,
    ]),
  )

  if (mode === '7d' || mode === '30d') {
    return Array.from(dailyAverages.entries()).map(([key, value]) => ({
      key,
      label: formatShortDate(parseDateKey(key)),
      value,
    }))
  }

  return createDetailBuckets(mode, range).flatMap((bucket) => {
    const values = Array.from(dailyAverages.entries())
      .filter(([key]) => isDateInRange(parseDateKey(key), bucket))
      .map(([, value]) => value)

    if (values.length === 0) {
      return []
    }

    return [
      {
        key: bucket.key,
        label: bucket.label,
        value: values.reduce((sum, value) => sum + value, 0) / values.length,
      },
    ]
  })
}

function createDetailBuckets(
  mode: StatsOverviewRangeMode,
  range: StatsOverviewRange,
): DetailBucket[] {
  const granularity = getStatsDetailBucketGranularityLabel(mode, range)

  if (granularity === '每 4 小時') {
    return Array.from({ length: 6 }, (_, index) => {
      const start = new Date(
        range.start.getFullYear(),
        range.start.getMonth(),
        range.start.getDate(),
        index * 4,
      )
      const end = new Date(
        range.start.getFullYear(),
        range.start.getMonth(),
        range.start.getDate(),
        (index + 1) * 4,
      )

      return {
        key: `${formatDateKey(start)}-${index}`,
        label: `${String(index * 4).padStart(2, '0')}:00–${String((index + 1) * 4).padStart(2, '0')}:00`,
        start,
        end,
      }
    })
  }

  if (granularity === '每日') {
    return createFixedDayBuckets(range)
  }

  if (granularity === '每週') {
    return createFixedWeekBuckets(range)
  }

  return createCalendarMonthBuckets(range)
}

function getRangeDayCount(range: StatsOverviewRange): number {
  return (
    Math.round((startOfDay(range.end).getTime() - startOfDay(range.start).getTime()) / 86_400_000) +
    1
  )
}

function createFixedDayBuckets(range: StatsOverviewRange): DetailBucket[] {
  const buckets: DetailBucket[] = []

  for (
    let date = startOfDay(range.start);
    date <= startOfDay(range.end);
    date = addDays(date, 1)
  ) {
    buckets.push({
      key: formatDateKey(date),
      label: formatShortDate(date),
      start: date,
      end: addDays(date, 1),
    })
  }

  return buckets
}

function createFixedWeekBuckets(range: StatsOverviewRange): DetailBucket[] {
  const buckets: DetailBucket[] = []
  const rangeEndExclusive = addDays(startOfDay(range.end), 1)

  for (
    let start = startOfDay(range.start);
    start < rangeEndExclusive;
    start = addDays(start, 7)
  ) {
    const end = minDate(addDays(start, 7), rangeEndExclusive)

    buckets.push({
      key: formatDateKey(start),
      label: `${formatShortDate(start)}–${formatShortDate(addDays(end, -1))}`,
      start,
      end,
    })
  }

  return buckets
}

function createCalendarMonthBuckets(range: StatsOverviewRange): DetailBucket[] {
  const buckets: DetailBucket[] = []
  const rangeEndExclusive = addDays(startOfDay(range.end), 1)
  let start = startOfDay(range.start)

  while (start < rangeEndExclusive) {
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    const end = minDate(nextMonth, rangeEndExclusive)

    buckets.push({
      key: formatDateKey(start),
      label: `${start.getFullYear()}/${start.getMonth() + 1}`,
      start,
      end,
    })
    start = end
  }

  return buckets
}

function getCategory(
  categories: EventCategory[],
  categoryId: string,
  mode: EventCategory['statisticsMode'],
): EventCategory | undefined {
  return categories.find(
    (category) => category.id === categoryId && category.statisticsMode === mode,
  )
}

function getCategoryEvents(
  events: CatEvent[],
  catId: string,
  categoryId: string,
): CatEvent[] {
  return events.filter((event) => event.catId === catId && event.categoryId === categoryId)
}

function filterEventsInRange(events: CatEvent[], range: StatsOverviewRange): CatEvent[] {
  const startTime = startOfDay(range.start).getTime()
  const endTime = addDays(startOfDay(range.end), 1).getTime()

  return events.filter((event) => {
    const occurredAt = new Date(event.occurredAt).getTime()

    return occurredAt >= startTime && occurredAt < endTime
  })
}

function getNumericEvents(events: CatEvent[]): NumericEvent[] {
  return events.flatMap((event) => {
    const value = getNumericAmount(event.values)

    return typeof value === 'number' ? [{ event, value }] : []
  })
}

function getDailyTotals(events: NumericEvent[]): Map<string, number> {
  const dailyTotals = new Map<string, number>()

  for (const { event, value } of events) {
    const key = formatDateKey(new Date(event.occurredAt))

    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + value)
  }

  return dailyTotals
}

function getTotalInRange(events: NumericEvent[], range: DetailBucket): number {
  return events
    .filter(({ event }) => isDateInRange(new Date(event.occurredAt), range))
    .reduce((total, { value }) => total + value, 0)
}

function getDailyAverageInRange(
  dailyTotals: Map<string, number>,
  range: DetailBucket,
): number {
  const values = Array.from(dailyTotals.entries())
    .filter(([key]) => isDateInRange(parseDateKey(key), range))
    .map(([, value]) => value)

  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0
}

function countEventsInRange(events: CatEvent[], range: DetailBucket): number {
  return events.filter((event) => isDateInRange(new Date(event.occurredAt), range)).length
}

function isDateInRange(date: Date, range: Pick<DetailBucket, 'start' | 'end'>): boolean {
  return date >= range.start && date < range.end
}

function getLatestEvent(events: CatEvent[]): CatEvent | undefined {
  return events.reduce<CatEvent | undefined>((latest, event) => {
    return !latest || event.occurredAt > latest.occurredAt ? event : latest
  }, undefined)
}

function getLatestNumericEvent(events: NumericEvent[]): NumericEvent | undefined {
  return events.reduce<NumericEvent | undefined>((latest, item) => {
    return !latest || item.event.occurredAt > latest.event.occurredAt ? item : latest
  }, undefined)
}

function getNumericAmount(values?: Record<string, unknown>): number | undefined {
  const amount = values?.amount
  const numericAmount =
    typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : undefined

  return typeof numericAmount === 'number' && Number.isFinite(numericAmount)
    ? numericAmount
    : undefined
}

function formatDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year!, month! - 1, day!)
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatTimeLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function minDate(left: Date, right: Date): Date {
  return left < right ? left : right
}
