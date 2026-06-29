import type { CatEvent, EventCategory } from '@/types'
import type { StatsOverviewRange, StatsOverviewRangeMode } from '@/services/statsOverviewRange'

export interface CountOverviewSummary {
  mode: 'count'
  category: EventCategory
  currentTotal: number
  previousTotal: number
  delta: number
}

export interface SumOverviewSummary {
  mode: 'sum'
  category: EventCategory
  currentValue?: number
  previousValue?: number
  delta?: number
  currentRecordedDays: number
  currentCount: number
  previousRecordedDays: number
}

export interface MeasurementOverviewSummary {
  mode: 'measurement'
  category: EventCategory
  currentValue?: number
  currentOccurredAt?: string
  previousValue?: number
  previousOccurredAt?: string
  delta?: number
  currentRecordedDays: number
  currentCount: number
}

export interface RatingOverviewSummary {
  mode: 'rating'
  category: EventCategory
  currentAverage?: number
  previousAverage?: number
  delta?: number
  currentRecordedDays: number
  currentCount: number
}

interface CountOverviewSummaryInput {
  category: EventCategory
  events: CatEvent[]
  catId: string
  currentRange: StatsOverviewRange
  previousRange: StatsOverviewRange
}

interface SumOverviewSummaryInput {
  category: EventCategory
  events: CatEvent[]
  catId: string
  rangeMode: StatsOverviewRangeMode
  currentRange: StatsOverviewRange
  previousRange: StatsOverviewRange
}

interface MeasurementOverviewSummaryInput {
  category: EventCategory
  events: CatEvent[]
  catId: string
  currentRange: StatsOverviewRange
  previousRange: StatsOverviewRange
}

interface RatingOverviewSummaryInput {
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

export function getSumOverviewSummary({
  category,
  events,
  catId,
  rangeMode,
  currentRange,
  previousRange,
}: SumOverviewSummaryInput): SumOverviewSummary {
  const categoryEvents = events.filter(
    (event) => event.catId === catId && event.categoryId === category.id,
  )
  const currentNumericEvents = getNumericEventsInRange(categoryEvents, currentRange)
  const currentDailyTotals = getDailyTotalsInRange(categoryEvents, currentRange)
  const previousDailyTotals = getDailyTotalsInRange(categoryEvents, previousRange)
  const currentValue = getSumPeriodValue(currentDailyTotals, rangeMode)
  const previousValue = getSumPeriodValue(previousDailyTotals, rangeMode)

  return {
    mode: 'sum',
    category,
    currentValue,
    previousValue,
    delta:
      typeof currentValue === 'number' && typeof previousValue === 'number'
        ? currentValue - previousValue
        : undefined,
    currentRecordedDays: currentDailyTotals.size,
    currentCount: currentNumericEvents.length,
    previousRecordedDays: previousDailyTotals.size,
  }
}

export function getMeasurementOverviewSummary({
  category,
  events,
  catId,
  currentRange,
  previousRange,
}: MeasurementOverviewSummaryInput): MeasurementOverviewSummary {
  const categoryEvents = events.filter(
    (event) => event.catId === catId && event.categoryId === category.id,
  )
  const currentEvents = getNumericEventsInRange(categoryEvents, currentRange)
  const previousEvents = getNumericEventsInRange(categoryEvents, previousRange)
  const currentEvent = getLatestNumericEvent(currentEvents)
  const previousEvent = getLatestNumericEvent(previousEvents)
  const currentValue = currentEvent ? getNumericAmount(currentEvent.values) : undefined
  const previousValue = previousEvent ? getNumericAmount(previousEvent.values) : undefined
  const currentRecordedDays = new Set(
    currentEvents.map((event) => formatDateKey(new Date(event.occurredAt))),
  ).size

  return {
    mode: 'measurement',
    category,
    currentValue,
    currentOccurredAt: currentEvent?.occurredAt,
    previousValue,
    previousOccurredAt: previousEvent?.occurredAt,
    delta:
      typeof currentValue === 'number' && typeof previousValue === 'number'
        ? currentValue - previousValue
        : undefined,
    currentRecordedDays,
    currentCount: currentEvents.length,
  }
}

export function getRatingOverviewSummary({
  category,
  events,
  catId,
  currentRange,
  previousRange,
}: RatingOverviewSummaryInput): RatingOverviewSummary {
  const categoryEvents = events.filter(
    (event) => event.catId === catId && event.categoryId === category.id,
  )
  const currentDailyRatings = getDailyAveragesInRange(categoryEvents, currentRange)
  const previousDailyRatings = getDailyAveragesInRange(categoryEvents, previousRange)
  const currentAverage = getAverage(Array.from(currentDailyRatings.values()))
  const previousAverage = getAverage(Array.from(previousDailyRatings.values()))

  return {
    mode: 'rating',
    category,
    currentAverage,
    previousAverage,
    delta:
      typeof currentAverage === 'number' && typeof previousAverage === 'number'
        ? currentAverage - previousAverage
        : undefined,
    currentRecordedDays: currentDailyRatings.size,
    currentCount: getNumericEventsInRange(categoryEvents, currentRange).length,
  }
}

export function getCurrentCountLabel(mode: StatsOverviewRangeMode): string {
  if (mode === 'day') {
    return '當日總次數'
  }

  if (mode === 'year') {
    return '近 1 年總次數'
  }

  if (mode === 'custom') {
    return '此區間總次數'
  }

  return `近 ${mode.replace('d', '')} 日總次數`
}

export function getPreviousPeriodLabel(mode: StatsOverviewRangeMode): string {
  if (mode === 'day') {
    return '前日'
  }

  if (mode === 'year') {
    return '前 1 年'
  }

  if (mode === 'custom') {
    return '前一區間'
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

export function getCurrentSumLabel(mode: StatsOverviewRangeMode): string {
  if (mode === 'day') {
    return '當日總量'
  }

  if (mode === 'year') {
    return '近 1 年每日平均'
  }

  if (mode === 'custom') {
    return '此區間每日平均'
  }

  return `近 ${mode.replace('d', '')} 日每日平均`
}

export function getCurrentMeasurementLabel(mode: StatsOverviewRangeMode): string {
  return mode === 'day' ? '當日最新' : '最新'
}

export function getCurrentRatingLabel(mode: StatsOverviewRangeMode): string {
  if (mode === 'day') {
    return '當日平均'
  }

  if (mode === 'year') {
    return '近 1 年平均'
  }

  if (mode === 'custom') {
    return '此區間平均'
  }

  return `近 ${mode.replace('d', '')} 日平均`
}

export function getPreviousMeasurementLabel(mode: StatsOverviewRangeMode): string {
  if (mode === 'day') {
    return '前日最後一筆'
  }

  if (mode === 'year') {
    return '前 1 年最後一筆'
  }

  if (mode === 'custom') {
    return '前一區間最後一筆'
  }

  return `前 ${mode.replace('d', '')} 日最後一筆`
}

export function formatSummaryAmount(value: number, category: EventCategory): string {
  const amount = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))

  return `${amount}${category.valueUnit ? ` ${category.valueUnit}` : ''}`
}

export function formatSumDelta(delta: number, category: EventCategory): string {
  const prefix = delta > 0 ? '+' : delta === 0 ? '±' : ''

  return `${prefix}${formatSummaryAmount(delta, category)}`
}

export function formatSummaryDate(value: string): string {
  const date = new Date(value)

  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatRatingScore(value: number, category: EventCategory): string {
  const score = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))

  return `${score}／${category.valueMax ?? 10}`
}

export function formatRatingDelta(delta: number): string {
  const roundedDelta = Number(delta.toFixed(2))
  const prefix = roundedDelta > 0 ? '+' : roundedDelta === 0 ? '±' : ''

  return `${prefix}${roundedDelta}`
}

function countEventsInRange(events: CatEvent[], range: StatsOverviewRange): number {
  const startTime = startOfDay(range.start).getTime()
  const endTime = addDays(startOfDay(range.end), 1).getTime()

  return events.filter((event) => {
    const occurredAt = new Date(event.occurredAt).getTime()

    return occurredAt >= startTime && occurredAt < endTime
  }).length
}

function getDailyTotalsInRange(events: CatEvent[], range: StatsOverviewRange): Map<string, number> {
  const startTime = startOfDay(range.start).getTime()
  const endTime = addDays(startOfDay(range.end), 1).getTime()
  const dailyTotals = new Map<string, number>()

  for (const event of events) {
    const occurredAt = new Date(event.occurredAt)
    const occurredTime = occurredAt.getTime()
    const amount = getNumericAmount(event.values)

    if (occurredTime < startTime || occurredTime >= endTime || typeof amount !== 'number') {
      continue
    }

    const key = formatDateKey(occurredAt)

    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + amount)
  }

  return dailyTotals
}

function getDailyAveragesInRange(
  events: CatEvent[],
  range: StatsOverviewRange,
): Map<string, number> {
  const dailyValues = new Map<string, number[]>()

  for (const event of getNumericEventsInRange(events, range)) {
    const amount = getNumericAmount(event.values)

    if (typeof amount !== 'number') {
      continue
    }

    const key = formatDateKey(new Date(event.occurredAt))

    dailyValues.set(key, [...(dailyValues.get(key) ?? []), amount])
  }

  return new Map(
    Array.from(dailyValues.entries()).flatMap(([key, values]) => {
      const average = getAverage(values)

      return typeof average === 'number' ? [[key, average]] : []
    }),
  )
}

function getNumericEventsInRange(events: CatEvent[], range: StatsOverviewRange): CatEvent[] {
  const startTime = startOfDay(range.start).getTime()
  const endTime = addDays(startOfDay(range.end), 1).getTime()

  return events.filter((event) => {
    const occurredTime = new Date(event.occurredAt).getTime()

    return (
      occurredTime >= startTime &&
      occurredTime < endTime &&
      typeof getNumericAmount(event.values) === 'number'
    )
  })
}

function getLatestNumericEvent(events: CatEvent[]): CatEvent | undefined {
  return events.reduce<CatEvent | undefined>((latestEvent, event) => {
    if (!latestEvent) {
      return event
    }

    return new Date(event.occurredAt).getTime() > new Date(latestEvent.occurredAt).getTime()
      ? event
      : latestEvent
  }, undefined)
}

function getAverage(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getSumPeriodValue(
  dailyTotals: Map<string, number>,
  rangeMode: StatsOverviewRangeMode,
): number | undefined {
  if (dailyTotals.size === 0) {
    return undefined
  }

  const total = Array.from(dailyTotals.values()).reduce((sum, value) => sum + value, 0)

  return rangeMode === 'day' ? total : total / dailyTotals.size
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}
