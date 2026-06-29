export type StatsOverviewRangeMode = 'day' | '7d' | '30d' | 'year' | 'custom'

export interface StatsOverviewRange {
  start: Date
  end: Date
}

export interface StatsOverviewCustomRange {
  startDate?: Date
  endDate?: Date
}

export const STATS_OVERVIEW_RANGE_OPTIONS: ReadonlyArray<{
  value: StatsOverviewRangeMode
  label: string
}> = [
  { value: 'day', label: '單日' },
  { value: '7d', label: '7日' },
  { value: '30d', label: '30日' },
  { value: 'year', label: '1 年' },
  { value: 'custom', label: '自訂' },
]

export function getStatsOverviewRange(
  mode: StatsOverviewRangeMode,
  referenceDate: Date,
  customRange?: StatsOverviewCustomRange,
): StatsOverviewRange {
  const end = startOfDay(referenceDate)

  if (mode === 'custom') {
    return normalizeCustomRange(customRange, end)
  }

  if (mode === 'day') {
    return { start: end, end }
  }

  if (mode === '7d' || mode === '30d') {
    const days = mode === '7d' ? 7 : 30

    return {
      start: addDays(end, -(days - 1)),
      end,
    }
  }

  return {
    start: addDays(addMonthsClamped(end, -12), 1),
    end,
  }
}

export function getPreviousStatsOverviewRange(
  mode: StatsOverviewRangeMode,
  currentRange: StatsOverviewRange,
): StatsOverviewRange {
  const days = getStatsOverviewRangeDayCount(currentRange)
  const end = addDays(currentRange.start, -1)

  return {
    start: addDays(end, -(days - 1)),
    end,
  }
}

export function shiftStatsOverviewReferenceDate(
  mode: StatsOverviewRangeMode,
  referenceDate: Date,
  direction: -1 | 1,
): Date {
  if (mode === 'custom') {
    return referenceDate
  }

  if (mode === 'day') {
    return addDays(referenceDate, direction)
  }

  if (mode === '7d' || mode === '30d') {
    const days = mode === '7d' ? 7 : 30

    return addDays(referenceDate, direction * days)
  }

  return addMonthsClamped(referenceDate, direction * 12)
}

export function shiftStatsOverviewCustomRange(
  range: StatsOverviewRange,
  direction: -1 | 1,
): StatsOverviewRange {
  const days = getStatsOverviewRangeDayCount(range)

  return {
    start: addDays(range.start, direction * days),
    end: addDays(range.end, direction * days),
  }
}

export function getStatsOverviewRangeDayCount(range: StatsOverviewRange): number {
  return (
    Math.round((startOfDay(range.end).getTime() - startOfDay(range.start).getTime()) / 86_400_000) +
    1
  )
}

export function formatStatsOverviewRangeTitle(
  mode: StatsOverviewRangeMode,
  range: StatsOverviewRange,
): string {
  if (mode === 'day') {
    return formatDate(range.end, true)
  }

  return `${formatDate(range.start, true)} - ${formatDate(range.end, true)}`
}

export function formatStatsOverviewDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function parseStatsOverviewDateInput(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  const date = new Date(year, month - 1, day)

  return Number.isNaN(date.getTime()) ? null : date
}

export function isSameStatsOverviewDate(left: Date, right: Date): boolean {
  return formatStatsOverviewDateInput(left) === formatStatsOverviewDateInput(right)
}

function normalizeCustomRange(
  customRange: StatsOverviewCustomRange | undefined,
  fallbackEnd: Date,
): StatsOverviewRange {
  const rawStart = startOfDay(customRange?.startDate ?? fallbackEnd)
  const rawEnd = startOfDay(customRange?.endDate ?? fallbackEnd)
  const today = startOfDay(new Date())
  const cappedStart = rawStart > today ? today : rawStart
  const cappedEnd = rawEnd > today ? today : rawEnd

  return cappedStart <= cappedEnd
    ? { start: cappedStart, end: cappedEnd }
    : { start: cappedEnd, end: cappedStart }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0,
  ).getDate()

  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    Math.min(date.getDate(), lastDay),
  )
}

function formatDate(date: Date, includeYear: boolean): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: includeYear ? 'numeric' : undefined,
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}
