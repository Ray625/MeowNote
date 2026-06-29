<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import TodayButton from '@/components/common/TodayButton.vue'
import StatsDatePicker from '@/components/stats/StatsDatePicker.vue'
import { useClickOutside } from '@/composables/useClickOutside'
import { getCategoryColorValue } from '@/constants/defaultData'
import {
  type CountCategoryStats,
  type MeasurementPoint,
  type MeasurementStats,
  type RatingStats,
  type SumDailyStats,
} from '@/services/catTrackerStats'
import {
  getCountDetailStats,
  getStatsDetailBucketGranularityLabel,
  getMeasurementDetailStats,
  getRatingDetailStats,
  getSumDetailStats,
} from '@/services/statsDetailData'
import {
  formatStatsOverviewDateInput,
  formatStatsOverviewRangeTitle,
  getPreviousStatsOverviewRange,
  getStatsOverviewRange,
  parseStatsOverviewDateInput,
  shiftStatsOverviewCustomRange,
  shiftStatsOverviewReferenceDate,
  STATS_OVERVIEW_RANGE_OPTIONS,
  type StatsOverviewRangeMode,
} from '@/services/statsOverviewRange'
import { getCurrentCountLabel, getPreviousPeriodLabel } from '@/services/statsOverviewSummary'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CatEvent, EventCategory } from '@/types'

const props = defineProps<{
  initialCategoryId?: string
  categoryIds?: string[]
  initialRangeMode?: StatsOverviewRangeMode
  initialReferenceDate?: string
  initialCustomStartDate?: string
  initialCustomEndDate?: string
}>()

const emit = defineEmits<{
  back: []
  rangeChange: [
    selection: {
      rangeMode: StatsOverviewRangeMode
      referenceDate: string
      customStartDate?: string
      customEndDate?: string
    },
  ]
}>()

type StatsMode = 'count' | 'sum' | 'measurement' | 'rating'
type CountInterval = 'day' | 'week' | 'month'
type ValueTrendInterval = 'day' | 'week' | 'month'
type MeasurementInterval = 'week' | 'month'
type RangePickerMode = 'day' | 'week' | 'twoMonth' | 'month' | 'halfYear'
type ChartTooltip = {
  key: string
  label: string
  value: string
  x: number
}
type TrendAxisTick = {
  key: string
  label: string
  x: number
}

const catTrackerStore = useCatTrackerStore()
const { categories, events, selectedCatId } = storeToRefs(catTrackerStore)
const rangeMode = ref<StatsOverviewRangeMode>(props.initialRangeMode ?? '7d')
const selectedStatsCategoryId = ref('')
const statsReferenceDate = ref(
  props.initialReferenceDate
    ? (parseStatsOverviewDateInput(props.initialReferenceDate) ?? new Date())
    : new Date(),
)
const customStartDate = ref(
  props.initialCustomStartDate
    ? (parseStatsOverviewDateInput(props.initialCustomStartDate) ?? addDays(new Date(), -6))
    : addDays(new Date(), -6),
)
const customEndDate = ref(
  props.initialCustomEndDate
    ? (parseStatsOverviewDateInput(props.initialCustomEndDate) ?? new Date())
    : new Date(),
)
const isRangePickerOpen = ref(false)
const isStatsCategoryMenuOpen = ref(false)
const statsCategorySelectRef = ref<HTMLElement>()
const rangePickerRef = ref<HTMLElement>()
const chartInteractionRef = ref<HTMLElement>()
const activeChartTooltip = ref<ChartTooltip>()
const rangePickerYear = ref(statsReferenceDate.value.getFullYear())
const rangePickerMonth = ref(statsReferenceDate.value.getMonth())
const supportsChartHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: new Intl.DateTimeFormat('zh-TW', { month: 'long' }).format(new Date(2024, index, 1)),
}))

useClickOutside(statsCategorySelectRef, () => {
  isStatsCategoryMenuOpen.value = false
})

useClickOutside(rangePickerRef, () => {
  isRangePickerOpen.value = false
})

useClickOutside(chartInteractionRef, () => {
  activeChartTooltip.value = undefined
})

const recentPeriodText = computed(() =>
  getCurrentCountLabel(rangeMode.value).replace('總次數', '').trim(),
)
const previousPeriodText = computed(() => getPreviousPeriodLabel(rangeMode.value))
const selectedStatsCategory = computed(() =>
  statCategories.value.find((category) => category.id === selectedStatsCategoryId.value),
)
const statsMode = computed<StatsMode>(() => selectedStatsCategory.value?.statisticsMode ?? 'count')
const currentRange = computed(() =>
  getStatsOverviewRange(rangeMode.value, statsReferenceDate.value, {
    startDate: customStartDate.value,
    endDate: customEndDate.value,
  }),
)
const previousRange = computed(() =>
  getPreviousStatsOverviewRange(rangeMode.value, currentRange.value),
)
const trendAxisTicks = computed<TrendAxisTick[]>(() => {
  if (rangeMode.value === 'day') {
    return Array.from({ length: 6 }, (_, index) => ({
      key: `hour-${index * 4}`,
      label: `${String(index * 4).padStart(2, '0')}:00`,
      x: 8 + (index / 5) * 84,
    }))
  }

  const dayCount =
    Math.round(
      (startOfDay(currentRange.value.end).getTime() -
        startOfDay(currentRange.value.start).getTime()) /
        86_400_000,
    ) + 1
  const tickCount = rangeMode.value === '7d' ? 7 : 6
  const dayOffsets = Array.from({ length: tickCount }, (_, index) =>
    Math.round((index / (tickCount - 1)) * (dayCount - 1)),
  )

  return dayOffsets.map((dayOffset, index) => {
    const date = addDays(currentRange.value.start, dayOffset)

    return {
      key: formatDateInputValue(date),
      label:
        getStatsDetailBucketGranularityLabel(rangeMode.value, currentRange.value) === '每月'
          ? `${date.getFullYear()}/${date.getMonth() + 1}`
          : `${date.getMonth() + 1}/${date.getDate()}`,
      x: 8 + (index / (tickCount - 1)) * 84,
    }
  })
})
const rangeTitle = computed(() =>
  formatStatsOverviewRangeTitle(rangeMode.value, currentRange.value),
)
const nextRangeReferenceDate = computed(() =>
  shiftStatsOverviewReferenceDate(rangeMode.value, statsReferenceDate.value, 1),
)
const canShowNextRange = computed(() => {
  if (rangeMode.value === 'custom') {
    const nextRange = shiftStatsOverviewCustomRange(currentRange.value, 1)

    return nextRange.end <= startOfDay(new Date())
  }

  return nextRangeReferenceDate.value <= startOfDay(new Date())
})
const rangePickerMonthIndex = computed(() => statsReferenceDate.value.getMonth())
const rangePickerMode = computed<RangePickerMode>(() => 'day')
const rangePickerLabel = computed(() => '選擇區間結束日期')
const shouldShowRangePickerHint = computed(() => true)
const rangePickerMonthLabel = computed(
  () =>
    `${rangePickerYear.value}年${new Intl.DateTimeFormat('zh-TW', { month: 'long' }).format(
      new Date(rangePickerYear.value, rangePickerMonth.value, 1),
    )}`,
)
const rangePickerDays = computed(() => {
  const daysInMonth = new Date(rangePickerYear.value, rangePickerMonth.value + 1, 0).getDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(rangePickerYear.value, rangePickerMonth.value, index + 1)

    return {
      key: formatDateInputValue(date),
      label: String(index + 1),
      date,
    }
  })
})
const rangePickerWeeks = computed(() => {
  const weeks = new Map<string, { key: string; label: string; start: Date; end: Date }>()
  const daysInMonth = new Date(rangePickerYear.value, rangePickerMonth.value + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day += 1) {
    const start = startOfWeek(new Date(rangePickerYear.value, rangePickerMonth.value, day))
    const end = addDays(start, 6)
    const key = formatDateInputValue(start)

    weeks.set(key, {
      key,
      label: `${formatRangeDate(start)} - ${formatRangeDate(end)}`,
      start,
      end,
    })
  }

  return Array.from(weeks.values())
})
const twoMonthOptions = computed(() =>
  Array.from({ length: 6 }, (_, index) => {
    const startMonth = index * 2
    const start = new Date(rangePickerYear.value, startMonth, 1)
    const end = new Date(rangePickerYear.value, startMonth + 2, 0)

    return {
      startMonth,
      label: `${startMonth + 1}-${startMonth + 2}月`,
      start,
      end,
    }
  }),
)
const halfYearOptions = computed(() => [
  {
    key: 'first',
    label: '上半年',
    start: new Date(rangePickerYear.value, 0, 1),
    end: new Date(rangePickerYear.value, 6, 0),
  },
  {
    key: 'second',
    label: '下半年',
    start: new Date(rangePickerYear.value, 6, 1),
    end: new Date(rangePickerYear.value, 12, 0),
  },
])
const recordedCategoryIds = computed(
  () =>
    new Set(
      events.value
        .filter((event) => event.catId === selectedCatId.value)
        .map((event) => event.categoryId),
    ),
)
const statCategories = computed(() =>
  categories.value
    .filter((category) => recordedCategoryIds.value.has(category.id))
    .filter((category) => !props.categoryIds?.length || props.categoryIds.includes(category.id))
    .filter((category) =>
      ['count', 'sum', 'measurement', 'rating'].includes(category.statisticsMode),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder),
)
const groupedStatCategories = computed(() => {
  const groups = new Map<string, typeof statCategories.value>()

  for (const category of statCategories.value) {
    const group = category.group ?? '其他'

    groups.set(group, [...(groups.get(group) ?? []), category])
  }

  return Array.from(groups.entries()).map(([group, groupCategories]) => ({
    group,
    categories: groupCategories,
  }))
})
const selectedCountStats = computed(() =>
  getCountDetailStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedStatsCategoryId.value,
    rangeMode: rangeMode.value,
    currentRange: currentRange.value,
    previousRange: previousRange.value,
  }),
)
const selectedSumStats = computed(() =>
  getSumDetailStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedStatsCategoryId.value,
    rangeMode: rangeMode.value,
    currentRange: currentRange.value,
  }),
)
const selectedMeasurementStats = computed(() =>
  getMeasurementDetailStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedStatsCategoryId.value,
    rangeMode: rangeMode.value,
    currentRange: currentRange.value,
  }),
)
const selectedRatingStats = computed(() =>
  getRatingDetailStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedStatsCategoryId.value,
    rangeMode: rangeMode.value,
    currentRange: currentRange.value,
  }),
)
const latestSelectedCategoryRecord = computed(() => {
  const category = selectedStatsCategory.value

  if (!category) {
    return undefined
  }

  const latest = events.value
    .filter(
      (event) =>
        event.catId === selectedCatId.value &&
        event.categoryId === category.id &&
        (category.statisticsMode === 'count' || typeof getEventNumericAmount(event) === 'number'),
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0]

  if (!latest) {
    return undefined
  }

  return {
    occurredAt: latest.occurredAt,
    valueText: getLatestRecordValueText(latest, category),
    dateTimeText: formatRecordDateTime(latest.occurredAt),
  }
})

watch(
  statCategories,
  (categoryList) => {
    if (categoryList.length === 0) {
      selectedStatsCategoryId.value = ''
      isStatsCategoryMenuOpen.value = false
      return
    }

    if (!categoryList.some((category) => category.id === selectedStatsCategoryId.value)) {
      selectedStatsCategoryId.value =
        categoryList.find((category) => category.id === props.initialCategoryId)?.id ??
        categoryList[0]?.id ??
        ''
      isStatsCategoryMenuOpen.value = false
    }
  },
  { immediate: true },
)

watch(
  [rangeMode, statsReferenceDate, customStartDate, customEndDate],
  ([nextRangeMode, nextReferenceDate]) => {
  emit('rangeChange', {
    rangeMode: nextRangeMode,
    referenceDate: formatStatsOverviewDateInput(nextReferenceDate),
    customStartDate: formatStatsOverviewDateInput(currentRange.value.start),
    customEndDate: formatStatsOverviewDateInput(currentRange.value.end),
  })
  },
)

watch([selectedStatsCategoryId, rangeMode, statsReferenceDate, customStartDate, customEndDate], () => {
  activeChartTooltip.value = undefined
})

function getStatsStyle(stats: CountCategoryStats): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(stats.category),
  }
}

function getSumStatsStyle(stats: SumDailyStats): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(stats.category),
  }
}

function getMeasurementStatsStyle(stats: MeasurementStats): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(stats.category),
  }
}

function getRatingStatsStyle(stats: RatingStats): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(stats.category),
  }
}

function getCategoryOptionStyle(category?: EventCategory): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(category),
  }
}

function getEventNumericAmount(event: CatEvent): number | undefined {
  const amount = event.values?.amount
  const value =
    typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : undefined

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getLatestRecordValueText(event: CatEvent, category: EventCategory): string {
  if (category.statisticsMode === 'count') {
    return ''
  }

  const value = getEventNumericAmount(event)

  if (typeof value !== 'number') {
    return ''
  }

  if (category.statisticsMode === 'rating') {
    return `${formatAmount(value)} / ${category.valueMax ?? 10}`
  }

  return `${formatAmount(value)}${category.valueUnit ? ` ${category.valueUnit}` : ''}`
}

function formatRecordDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value))
}

function showLatestRecordRange(): void {
  if (!latestSelectedCategoryRecord.value) {
    return
  }

  statsReferenceDate.value = new Date(latestSelectedCategoryRecord.value.occurredAt)
}

function getDeltaText(delta: number): string {
  if (delta > 0) {
    return `比${previousPeriodText.value}增加 ${delta} 次`
  }

  if (delta < 0) {
    return `比${previousPeriodText.value}減少 ${Math.abs(delta)} 次`
  }

  return `與${previousPeriodText.value}相同`
}

function formatLatestDate(dateTime?: string): string {
  if (!dateTime) {
    return '尚無近期紀錄'
  }

  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(dateTime))
}

function getBarHeight(count: number, stats: CountCategoryStats): string {
  if (count === 0) {
    return '0'
  }

  const maxCount = Math.max(...stats.buckets.map((bucket) => bucket.count), 1)
  const ratio = count / maxCount

  return `${Math.max(4, Math.round(ratio * 38))}px`
}

function getCountBarsStyle(stats: CountCategoryStats): Record<string, string> {
  return {
    '--count-bucket-count': String(stats.buckets.length),
  }
}

function getSumBarsStyle(stats: SumDailyStats): Record<string, string> {
  return {
    '--count-bucket-count': String(stats.buckets.length),
  }
}

function getSumBarHeight(total: number, stats: SumDailyStats): string {
  if (total === 0) {
    return '0'
  }

  const maxTotal = Math.max(...stats.buckets.map((bucket) => bucket.total), 1)
  const ratio = total / maxTotal

  return `${Math.max(4, Math.round(ratio * 38))}px`
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function getAmountText(value: number, stats: SumDailyStats): string {
  return `${formatAmount(value)}${stats.category.valueUnit ? ` ${stats.category.valueUnit}` : ''}`
}

function getDailyAverageText(stats: SumDailyStats): string {
  const recordedDays =
    stats.recordedDays ?? stats.buckets.filter((bucket) => bucket.total > 0).length

  return getAmountText(stats.rangeTotal / Math.max(recordedDays, 1), stats)
}

function shouldShowChartLabel(index: number, pointCount: number): boolean {
  if (pointCount <= 8) {
    return true
  }

  const labelStep = Math.ceil(pointCount / 6)

  return index === 0 || index === pointCount - 1 || index % labelStep === 0
}

function getAxisLabel(label: string): string {
  return label.split(/[–-]/, 1)[0]?.trim() ?? label
}

function getChartTooltipStyle(): Record<string, string> {
  return {
    left: `${activeChartTooltip.value?.x ?? 50}%`,
  }
}

function showChartTooltip(
  key: string,
  label: string,
  value: string,
  index: number,
  pointCount: number,
): void {
  const rawX = pointCount <= 1 ? 50 : ((index + 0.5) / pointCount) * 100

  activeChartTooltip.value = {
    key,
    label,
    value,
    x: Math.max(12, Math.min(rawX, 88)),
  }
}

function showTrendTooltip(
  key: string,
  label: string,
  value: string,
  point: MeasurementPoint,
): void {
  const rawX = getTrendPointX(point)

  activeChartTooltip.value = {
    key,
    label,
    value,
    x: Math.max(12, Math.min(rawX, 88)),
  }
}

function toggleChartTooltip(
  key: string,
  label: string,
  value: string,
  index: number,
  pointCount: number,
): void {
  if (supportsChartHover) {
    return
  }

  if (activeChartTooltip.value?.key === key) {
    activeChartTooltip.value = undefined
    return
  }

  showChartTooltip(key, label, value, index, pointCount)
}

function toggleTrendTooltip(
  key: string,
  label: string,
  value: string,
  point: MeasurementPoint,
): void {
  if (supportsChartHover) {
    return
  }

  if (activeChartTooltip.value?.key === key) {
    activeChartTooltip.value = undefined
    return
  }

  showTrendTooltip(key, label, value, point)
}

function hideChartTooltip(key: string): void {
  if (activeChartTooltip.value?.key === key) {
    activeChartTooltip.value = undefined
  }
}

function showChartTooltipFromHover(
  key: string,
  label: string,
  value: string,
  index: number,
  pointCount: number,
): void {
  if (supportsChartHover) {
    showChartTooltip(key, label, value, index, pointCount)
  }
}

function showTrendTooltipFromHover(
  key: string,
  label: string,
  value: string,
  point: MeasurementPoint,
): void {
  if (supportsChartHover) {
    showTrendTooltip(key, label, value, point)
  }
}

function hideChartTooltipFromHover(key: string): void {
  if (supportsChartHover) {
    hideChartTooltip(key)
  }
}

function getMeasurementText(value: number, stats: MeasurementStats): string {
  return `${formatAmount(value)}${stats.category.valueUnit ? ` ${stats.category.valueUnit}` : ''}`
}

function getRatingText(value: number, stats: RatingStats): string {
  return `${formatAmount(value)} / ${stats.category.valueMax ?? 10}`
}

function getMeasurementLinePoints(stats: MeasurementStats): string {
  return stats.points
    .map((point) => {
      if (typeof point.value !== 'number') {
        return ''
      }

      const position = getTrendPointPosition(point, point.value, stats.minValue, stats.maxValue)

      return `${position.x},${position.y}`
    })
    .filter(Boolean)
    .join(' ')
}

function getRatingLinePoints(stats: RatingStats): string {
  return stats.points
    .map((point) => {
      if (typeof point.value !== 'number') {
        return ''
      }

      const position = getTrendPointPosition(point, point.value, 0, stats.category.valueMax ?? 10)

      return `${position.x},${position.y}`
    })
    .filter(Boolean)
    .join(' ')
}

function getMeasurementPointPosition(
  point: MeasurementPoint,
  value: number,
  stats: MeasurementStats,
): { x: number; y: number } {
  return getTrendPointPosition(point, value, stats.minValue, stats.maxValue)
}

function getMeasurementDotStyle(
  point: MeasurementPoint,
  value: number,
  stats: MeasurementStats,
): Record<string, string> {
  const position = getMeasurementPointPosition(point, value, stats)

  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
  }
}

function getRatingPointPosition(
  point: MeasurementPoint,
  value: number,
  stats: RatingStats,
): { x: number; y: number } {
  return getTrendPointPosition(point, value, 0, stats.category.valueMax ?? 10)
}

function getRatingDotStyle(
  point: MeasurementPoint,
  value: number,
  stats: RatingStats,
): Record<string, string> {
  const position = getRatingPointPosition(point, value, stats)

  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
  }
}

function isTodayInRange(start: Date, end: Date): boolean {
  const today = startOfDay(new Date())

  return today >= startOfDay(start) && today < startOfDay(end)
}

function getTrendPointPosition(
  point: MeasurementPoint,
  value: number,
  minValue: number,
  maxValue: number,
): { x: number; y: number } {
  const x = getTrendPointX(point)
  const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue)
  const y = 92 - Math.max(0, Math.min(ratio, 1)) * 84

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  }
}

function getTrendPointX(point: MeasurementPoint): number {
  const pointDate = getMeasurementPointDate(point)

  if (!pointDate) {
    return 50
  }

  const rangeStart = startOfDay(currentRange.value.start).getTime()
  const rangeEnd =
    rangeMode.value === 'day'
      ? addDays(startOfDay(currentRange.value.end), 1).getTime()
      : startOfDay(currentRange.value.end).getTime()
  const ratio =
    rangeEnd === rangeStart ? 0.5 : (pointDate.getTime() - rangeStart) / (rangeEnd - rangeStart)

  return Number((8 + Math.max(0, Math.min(ratio, 1)) * 84).toFixed(2))
}

function getMeasurementPointDate(point: MeasurementPoint): Date | null {
  if (point.occurredAt) {
    return new Date(point.occurredAt)
  }

  const date = parseStatsOverviewDateInput(point.key)

  return date && !Number.isNaN(date.getTime()) ? date : null
}

function getValueTrendShift(interval: ValueTrendInterval): number {
  return interval === 'day' ? 1 : interval === 'week' ? 7 : 30
}

function syncRangePicker(): void {
  rangePickerYear.value = statsReferenceDate.value.getFullYear()
  rangePickerMonth.value = statsReferenceDate.value.getMonth()
}

function toggleRangePicker(): void {
  if (!isRangePickerOpen.value) {
    syncRangePicker()
  }

  isRangePickerOpen.value = !isRangePickerOpen.value
}

function toggleStatsCategoryMenu(): void {
  if (statCategories.value.length === 0) {
    return
  }

  isStatsCategoryMenuOpen.value = !isStatsCategoryMenuOpen.value
}

function selectStatsCategory(categoryId: string): void {
  selectedStatsCategoryId.value = categoryId
  isStatsCategoryMenuOpen.value = false
}

function changeRangePickerYear(delta: number): void {
  rangePickerYear.value += delta
}

function changeRangePickerMonth(delta: number): void {
  const next = new Date(rangePickerYear.value, rangePickerMonth.value + delta, 1)

  rangePickerYear.value = next.getFullYear()
  rangePickerMonth.value = next.getMonth()
}

function closeRangePickerWithReference(date: Date): void {
  statsReferenceDate.value = date
  isRangePickerOpen.value = false
}

function selectRangeDay(date: Date): void {
  closeRangePickerWithReference(date)
}

function selectRangeWeek(end: Date): void {
  closeRangePickerWithReference(end)
}

function selectRangeMonth(monthIndex: number): void {
  const today = new Date()
  const isCurrentMonth =
    rangePickerYear.value === today.getFullYear() && monthIndex === today.getMonth()

  closeRangePickerWithReference(
    isCurrentMonth ? today : new Date(rangePickerYear.value, monthIndex + 1, 0),
  )
}

function selectRangeTwoMonth(end: Date): void {
  closeRangePickerWithReference(getCappedReferenceDate(end))
}

function selectRangeHalfYear(end: Date): void {
  closeRangePickerWithReference(getCappedReferenceDate(end))
}

function getCappedReferenceDate(end: Date): Date {
  const today = startOfDay(new Date())

  return end > today ? today : end
}

function isReferenceDate(date: Date): boolean {
  return formatDateInputValue(statsReferenceDate.value) === formatDateInputValue(date)
}

function isReferenceInRange(start: Date, end: Date): boolean {
  const reference = startOfDay(statsReferenceDate.value)

  return reference >= start && reference <= end
}

function isFutureRange(start: Date): boolean {
  return startOfDay(start) > startOfDay(new Date())
}

function hasRecordInRange(start: Date, end: Date): boolean {
  const rangeStart = startOfDay(start).getTime()
  const rangeEnd = addDays(startOfDay(end), 1).getTime()

  return events.value.some((event) => {
    const occurredAt = new Date(event.occurredAt).getTime()

    return (
      event.catId === selectedCatId.value &&
      event.categoryId === selectedStatsCategoryId.value &&
      occurredAt >= rangeStart &&
      occurredAt < rangeEnd
    )
  })
}

function showPreviousRange(): void {
  if (rangeMode.value === 'custom') {
    const previousRange = shiftStatsOverviewCustomRange(currentRange.value, -1)

    customStartDate.value = previousRange.start
    customEndDate.value = previousRange.end
    statsReferenceDate.value = previousRange.end
    return
  }

  statsReferenceDate.value = shiftStatsOverviewReferenceDate(
    rangeMode.value,
    statsReferenceDate.value,
    -1,
  )
}

function selectRangeMode(mode: StatsOverviewRangeMode): void {
  rangeMode.value = mode
  isRangePickerOpen.value = false
}

function selectCustomStartDate(value: string): void {
  const selectedDate = parseStatsOverviewDateInput(value)

  if (!selectedDate || selectedDate > startOfDay(new Date())) {
    return
  }

  customStartDate.value = selectedDate

  if (customEndDate.value < selectedDate) {
    customEndDate.value = selectedDate
  }

  statsReferenceDate.value = customEndDate.value
}

function selectCustomEndDate(value: string): void {
  const selectedDate = parseStatsOverviewDateInput(value)

  if (!selectedDate || selectedDate > startOfDay(new Date())) {
    return
  }

  customEndDate.value = selectedDate

  if (customStartDate.value > selectedDate) {
    customStartDate.value = selectedDate
  }

  statsReferenceDate.value = selectedDate
}

function formatCustomDateTitle(date: Date): string {
  return formatStatsOverviewRangeTitle('day', { start: date, end: date })
}

function selectReferenceDate(value: string): void {
  const selectedDate = parseStatsOverviewDateInput(value)

  if (!selectedDate || selectedDate > startOfDay(new Date())) {
    return
  }

  statsReferenceDate.value = selectedDate
  isRangePickerOpen.value = false
}

function showNextRange(): void {
  if (!canShowNextRange.value) {
    return
  }

  if (rangeMode.value === 'custom') {
    const nextRange = shiftStatsOverviewCustomRange(currentRange.value, 1)

    customStartDate.value = nextRange.start
    customEndDate.value = nextRange.end
    statsReferenceDate.value = nextRange.end
    return
  }

  statsReferenceDate.value = nextRangeReferenceDate.value
}

function getNextRangeReferenceDate(): Date {
  return shiftStatsOverviewReferenceDate(rangeMode.value, statsReferenceDate.value, 1)
}

function showTodayRange(): void {
  statsReferenceDate.value = new Date()

  if (rangeMode.value === 'custom') {
    const dayCount =
      Math.round(
        (startOfDay(customEndDate.value).getTime() - startOfDay(customStartDate.value).getTime()) /
          86_400_000,
      ) + 1

    customEndDate.value = new Date()
    customStartDate.value = addDays(customEndDate.value, -Math.max(dayCount - 1, 0))
  }

  isRangePickerOpen.value = false
}

function getStatsRangeStart(referenceDate: Date): Date {
  return getStatsOverviewRange(rangeMode.value, referenceDate, {
    startDate: customStartDate.value,
    endDate: customEndDate.value,
  }).start
}

function getStatsRange(referenceDate: Date, interval: CountInterval, periods: number) {
  const anchorStart =
    interval === 'day'
      ? startOfDay(referenceDate)
      : interval === 'week'
        ? startOfWeek(referenceDate)
        : startOfMonth(referenceDate)
  const start =
    interval === 'day'
      ? addDays(anchorStart, -(periods - 1))
      : interval === 'week'
        ? addDays(anchorStart, -(periods - 1) * 7)
        : addMonths(anchorStart, -(periods - 1))
  const end =
    interval === 'day'
      ? addDays(anchorStart, 1)
      : interval === 'week'
        ? addDays(anchorStart, 7)
        : addMonths(anchorStart, 1)

  return {
    start,
    end: addDays(end, -1),
  }
}

function shiftDate(date: Date, interval: CountInterval, amount: number): Date {
  if (interval === 'month') {
    return addMonths(date, amount)
  }

  return addDays(date, interval === 'week' ? amount * 7 : amount)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date): Date {
  const value = startOfDay(date)
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day

  return addDays(value, diff)
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function formatRangeDate(date: Date): string {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function formatDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}
</script>

<template>
  <section class="stats-view" aria-labelledby="stats-title">
    <header class="stats-header">
      <button class="stats-back-button" type="button" @click="emit('back')">‹ 返回</button>

      <div class="stats-header__title">
        <h1 id="stats-title">統計圖</h1>
      </div>

      <TodayButton @click="showTodayRange" />
    </header>

    <section class="stats-section" aria-label="分類詳細統計">
      <div class="stats-detail-range-tabs" role="tablist" aria-label="時間區間">
        <button
          v-for="option in STATS_OVERVIEW_RANGE_OPTIONS"
          :key="option.value"
          class="stats-detail-range-tab"
          :class="{ 'stats-detail-range-tab--active': rangeMode === option.value }"
          type="button"
          role="tab"
          :aria-selected="rangeMode === option.value"
          @click="selectRangeMode(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="range-controls" aria-label="統計日期區間">
        <button
          class="ui-button ui-button--icon range-button"
          type="button"
          @click="showPreviousRange"
        >
          ‹
        </button>
        <div v-if="rangeMode === 'custom'" class="stats-custom-range">
          <label>
            <span>開始</span>
            <StatsDatePicker
              :title="formatCustomDateTitle(currentRange.start)"
              :model-value="formatStatsOverviewDateInput(currentRange.start)"
              :max-date="formatStatsOverviewDateInput(new Date())"
              align="start"
              @update:model-value="selectCustomStartDate"
            />
          </label>
          <label>
            <span>結束</span>
            <StatsDatePicker
              :title="formatCustomDateTitle(currentRange.end)"
              :model-value="formatStatsOverviewDateInput(currentRange.end)"
              :max-date="formatStatsOverviewDateInput(new Date())"
              align="end"
              @update:model-value="selectCustomEndDate"
            />
          </label>
        </div>

        <StatsDatePicker
          v-else
          :title="rangeTitle"
          :model-value="formatStatsOverviewDateInput(statsReferenceDate)"
          :max-date="formatStatsOverviewDateInput(new Date())"
          @update:model-value="selectReferenceDate"
        />
        <button
          class="ui-button ui-button--icon range-button"
          type="button"
          :disabled="!canShowNextRange"
          @click="showNextRange"
        >
          ›
        </button>
      </div>

      <div class="stats-controls">
        <div class="stats-field">
          <div ref="statsCategorySelectRef" class="stats-category-select">
            <button
              class="stats-category-trigger"
              type="button"
              :disabled="statCategories.length === 0"
              :aria-expanded="isStatsCategoryMenuOpen"
              aria-haspopup="listbox"
              @click="toggleStatsCategoryMenu"
            >
              <span
                v-if="selectedStatsCategory"
                class="stats-category-dot"
                :style="getCategoryOptionStyle(selectedStatsCategory)"
                aria-hidden="true"
              ></span>
              <span class="stats-category-trigger__name">
                {{ selectedStatsCategory?.name ?? '尚無紀錄項目' }}
              </span>
              <span class="stats-category-trigger__chevron" aria-hidden="true">▾</span>
            </button>

            <div
              v-if="isStatsCategoryMenuOpen"
              class="stats-category-menu"
              role="listbox"
              aria-label="選擇統計分類"
            >
              <section
                v-for="group in groupedStatCategories"
                :key="group.group"
                class="stats-category-menu__group"
              >
                <h3>{{ group.group }}</h3>
                <button
                  v-for="category in group.categories"
                  :key="category.id"
                  class="stats-category-option"
                  :class="{
                    'stats-category-option--selected': category.id === selectedStatsCategoryId,
                  }"
                  :style="getCategoryOptionStyle(category)"
                  type="button"
                  role="option"
                  :aria-selected="category.id === selectedStatsCategoryId"
                  @click="selectStatsCategory(category.id)"
                >
                  <span class="stats-category-option__check" aria-hidden="true">
                    {{ category.id === selectedStatsCategoryId ? '✓' : '' }}
                  </span>
                  <span class="stats-category-dot" aria-hidden="true"></span>
                  <span class="stats-category-option__name">{{ category.name }}</span>
                </button>
              </section>
            </div>
          </div>
        </div>

        <span class="stats-granularity">
          圖表：{{ getStatsDetailBucketGranularityLabel(rangeMode, currentRange) }}
        </span>
      </div>

      <div
        v-if="statsMode === 'count' && selectedCountStats && selectedCountStats.recentTotal > 0"
        class="count-stats-list"
      >
        <article
          :key="selectedCountStats.category.id"
          class="count-card"
          :style="getStatsStyle(selectedCountStats)"
        >
          <div class="count-card__summary">
            <div>
              <p>{{ recentPeriodText }} {{ selectedCountStats.recentTotal }} 次</p>
            </div>
            <strong :class="{ 'count-card__delta--up': selectedCountStats.delta > 0 }">
              {{ getDeltaText(selectedCountStats.delta) }}
            </strong>
          </div>

          <div
            ref="chartInteractionRef"
            class="count-bars"
            aria-label="近期趨勢"
            :style="getCountBarsStyle(selectedCountStats)"
          >
            <div
              v-if="activeChartTooltip"
              class="chart-tooltip"
              :style="getChartTooltipStyle()"
              role="status"
            >
              <strong>{{ activeChartTooltip.label }}</strong>
              <span>{{ activeChartTooltip.value }}</span>
            </div>
            <div class="count-bars__plot">
              <button
                v-for="(bucket, index) in selectedCountStats.buckets"
                :key="bucket.key"
                class="count-bar"
                :class="{ 'count-bar--active': activeChartTooltip?.key === bucket.key }"
                type="button"
                :disabled="bucket.count === 0"
                :aria-label="`${bucket.label}，${bucket.count} 次`"
                @mouseenter="
                  showChartTooltipFromHover(
                    bucket.key,
                    bucket.label,
                    `${bucket.count} 次`,
                    index,
                    selectedCountStats.buckets.length,
                  )
                "
                @mouseleave="hideChartTooltipFromHover(bucket.key)"
                @focus="
                  showChartTooltipFromHover(
                    bucket.key,
                    bucket.label,
                    `${bucket.count} 次`,
                    index,
                    selectedCountStats.buckets.length,
                  )
                "
                @blur="hideChartTooltipFromHover(bucket.key)"
                @click.stop="
                  toggleChartTooltip(
                    bucket.key,
                    bucket.label,
                    `${bucket.count} 次`,
                    index,
                    selectedCountStats.buckets.length,
                  )
                "
              >
                <span
                  class="count-bar__fill"
                  :style="{ height: getBarHeight(bucket.count, selectedCountStats) }"
                ></span>
              </button>
            </div>
            <div class="count-bars__labels" aria-hidden="true">
              <em
                v-for="(bucket, index) in selectedCountStats.buckets"
                :key="bucket.key"
                :class="{
                  'count-bar-label--today': isTodayInRange(bucket.start, bucket.end),
                }"
              >
                {{
                  shouldShowChartLabel(index, selectedCountStats.buckets.length)
                    ? getAxisLabel(bucket.label)
                    : ''
                }}
              </em>
            </div>
          </div>

          <div class="count-card__meta">
            <span>{{ previousPeriodText }} {{ selectedCountStats.previousTotal }} 次</span>
            <span>最近 {{ formatLatestDate(selectedCountStats.latestOccurredAt) }}</span>
          </div>
        </article>
      </div>

      <div v-else-if="statsMode === 'sum' && selectedSumStats" class="count-stats-list">
        <article
          :key="selectedSumStats.category.id"
          class="count-card"
          :style="getSumStatsStyle(selectedSumStats)"
        >
          <div class="count-card__summary">
            <div>
              <p v-if="rangeMode === 'day'">
                當日總量 {{ getAmountText(selectedSumStats.rangeTotal, selectedSumStats) }}
              </p>
              <p v-else>每日平均 {{ getDailyAverageText(selectedSumStats) }}</p>
            </div>
          </div>

          <div v-if="rangeMode === 'day'" class="stats-metrics">
            <div>
              <span>紀錄筆數</span>
              <strong>{{ selectedSumStats.sampleCount ?? 0 }} 筆</strong>
            </div>
            <div>
              <span>單筆最高</span>
              <strong>{{
                getAmountText(selectedSumStats.maxEntryValue ?? 0, selectedSumStats)
              }}</strong>
            </div>
            <div>
              <span>單筆最低</span>
              <strong>{{
                getAmountText(selectedSumStats.minEntryValue ?? 0, selectedSumStats)
              }}</strong>
            </div>
          </div>

          <div v-else class="stats-metrics">
            <div>
              <span>有紀錄天數</span>
              <strong>{{ selectedSumStats.recordedDays ?? 0 }} 天</strong>
            </div>
            <div>
              <span>最高單日</span>
              <strong>{{ getAmountText(selectedSumStats.maxDailyTotal, selectedSumStats) }}</strong>
            </div>
            <div>
              <span>最低單日</span>
              <strong>{{ getAmountText(selectedSumStats.minDailyTotal, selectedSumStats) }}</strong>
            </div>
          </div>

          <div
            ref="chartInteractionRef"
            class="count-bars"
            aria-label="每日總量"
            :style="getSumBarsStyle(selectedSumStats)"
          >
            <div
              v-if="activeChartTooltip"
              class="chart-tooltip"
              :style="getChartTooltipStyle()"
              role="status"
            >
              <strong>{{ activeChartTooltip.label }}</strong>
              <span>{{ activeChartTooltip.value }}</span>
            </div>
            <div class="count-bars__plot">
              <button
                v-for="(bucket, index) in selectedSumStats.buckets"
                :key="bucket.key"
                class="count-bar"
                :class="{ 'count-bar--active': activeChartTooltip?.key === bucket.key }"
                type="button"
                :disabled="bucket.total === 0"
                :aria-label="`${bucket.label}，${getAmountText(bucket.total, selectedSumStats)}`"
                @mouseenter="
                  showChartTooltipFromHover(
                    bucket.key,
                    bucket.label,
                    getAmountText(bucket.total, selectedSumStats),
                    index,
                    selectedSumStats.buckets.length,
                  )
                "
                @mouseleave="hideChartTooltipFromHover(bucket.key)"
                @focus="
                  showChartTooltipFromHover(
                    bucket.key,
                    bucket.label,
                    getAmountText(bucket.total, selectedSumStats),
                    index,
                    selectedSumStats.buckets.length,
                  )
                "
                @blur="hideChartTooltipFromHover(bucket.key)"
                @click.stop="
                  toggleChartTooltip(
                    bucket.key,
                    bucket.label,
                    getAmountText(bucket.total, selectedSumStats),
                    index,
                    selectedSumStats.buckets.length,
                  )
                "
              >
                <span
                  class="count-bar__fill"
                  :style="{ height: getSumBarHeight(bucket.total, selectedSumStats) }"
                ></span>
              </button>
            </div>
            <div class="count-bars__labels" aria-hidden="true">
              <em
                v-for="(bucket, index) in selectedSumStats.buckets"
                :key="bucket.key"
                :class="{
                  'count-bar-label--today': isTodayInRange(bucket.start, bucket.end),
                }"
              >
                {{
                  shouldShowChartLabel(index, selectedSumStats.buckets.length)
                    ? getAxisLabel(bucket.label)
                    : ''
                }}
              </em>
            </div>
          </div>

          <div class="count-card__meta">
            <span>最近 {{ formatLatestDate(selectedSumStats.latestOccurredAt) }}</span>
          </div>
        </article>
      </div>

      <div
        v-else-if="statsMode === 'measurement' && selectedMeasurementStats"
        class="count-stats-list"
      >
        <article
          :key="selectedMeasurementStats.category.id"
          class="count-card"
          :style="getMeasurementStatsStyle(selectedMeasurementStats)"
        >
          <div class="count-card__summary">
            <div>
              <p>
                最近量測
                {{
                  getMeasurementText(selectedMeasurementStats.latestValue, selectedMeasurementStats)
                }}
              </p>
            </div>
          </div>

          <div class="stats-metrics">
            <div>
              <span>最高</span>
              <strong>{{
                getMeasurementText(selectedMeasurementStats.maxValue, selectedMeasurementStats)
              }}</strong>
            </div>
            <div>
              <span>最低</span>
              <strong>{{
                getMeasurementText(selectedMeasurementStats.minValue, selectedMeasurementStats)
              }}</strong>
            </div>
            <div>
              <span>筆數</span>
              <strong>{{ selectedMeasurementStats.sampleCount }}</strong>
            </div>
          </div>

          <div ref="chartInteractionRef" class="measurement-chart" aria-label="量測趨勢">
            <div class="trend-plot">
              <div
                v-if="activeChartTooltip"
                class="chart-tooltip"
                :style="getChartTooltipStyle()"
                role="status"
              >
                <strong>{{ activeChartTooltip.label }}</strong>
                <span>{{ activeChartTooltip.value }}</span>
              </div>
              <svg
                class="trend-chart"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  class="trend-chart__line"
                  :points="getMeasurementLinePoints(selectedMeasurementStats)"
                />
              </svg>
              <template v-for="point in selectedMeasurementStats.points" :key="point.key">
                <button
                  v-if="typeof point.value === 'number'"
                  class="trend-chart__dot"
                  :class="{ 'trend-chart__dot--active': activeChartTooltip?.key === point.key }"
                  type="button"
                  :disabled="point.value === 0"
                  :style="getMeasurementDotStyle(point, point.value, selectedMeasurementStats)"
                  :aria-label="`${point.label}，${getMeasurementText(point.value, selectedMeasurementStats)}`"
                  @mouseenter="
                    showTrendTooltipFromHover(
                      point.key,
                      point.label,
                      getMeasurementText(point.value, selectedMeasurementStats),
                      point,
                    )
                  "
                  @mouseleave="hideChartTooltipFromHover(point.key)"
                  @focus="
                    showTrendTooltipFromHover(
                      point.key,
                      point.label,
                      getMeasurementText(point.value, selectedMeasurementStats),
                      point,
                    )
                  "
                  @blur="hideChartTooltipFromHover(point.key)"
                  @click.stop="
                    toggleTrendTooltip(
                      point.key,
                      point.label,
                      getMeasurementText(point.value, selectedMeasurementStats),
                      point,
                    )
                  "
                ></button>
              </template>
            </div>

            <div class="trend-labels">
              <div
                v-for="tick in trendAxisTicks"
                :key="tick.key"
                class="trend-label"
                :class="{
                  'trend-label--today': tick.key === formatDateInputValue(new Date()),
                }"
                :style="{ left: `${tick.x}%` }"
              >
                <em>{{ tick.label }}</em>
              </div>
            </div>
          </div>

          <div class="count-card__meta">
            <span>最近 {{ formatLatestDate(selectedMeasurementStats.latestOccurredAt) }}</span>
            <span>只顯示有紀錄日期</span>
          </div>
        </article>
      </div>

      <div v-else-if="statsMode === 'rating' && selectedRatingStats" class="count-stats-list">
        <article
          :key="selectedRatingStats.category.id"
          class="count-card"
          :style="getRatingStatsStyle(selectedRatingStats)"
        >
          <div class="count-card__summary">
            <div>
              <p>
                最近評分 {{ getRatingText(selectedRatingStats.latestValue, selectedRatingStats) }}
              </p>
            </div>
          </div>

          <div class="stats-metrics">
            <div>
              <span>最高</span>
              <strong>{{
                getRatingText(selectedRatingStats.maxValue, selectedRatingStats)
              }}</strong>
            </div>
            <div>
              <span>最低</span>
              <strong>{{
                getRatingText(selectedRatingStats.minValue, selectedRatingStats)
              }}</strong>
            </div>
            <div>
              <span>筆數</span>
              <strong>{{ selectedRatingStats.sampleCount }}</strong>
            </div>
          </div>

          <div ref="chartInteractionRef" class="measurement-chart" aria-label="評分趨勢">
            <div class="trend-plot">
              <div
                v-if="activeChartTooltip"
                class="chart-tooltip"
                :style="getChartTooltipStyle()"
                role="status"
              >
                <strong>{{ activeChartTooltip.label }}</strong>
                <span>{{ activeChartTooltip.value }}</span>
              </div>
              <svg
                class="trend-chart"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  class="trend-chart__line"
                  :points="getRatingLinePoints(selectedRatingStats)"
                />
              </svg>
              <template v-for="point in selectedRatingStats.points" :key="point.key">
                <button
                  v-if="typeof point.value === 'number'"
                  class="trend-chart__dot"
                  :class="{ 'trend-chart__dot--active': activeChartTooltip?.key === point.key }"
                  type="button"
                  :disabled="point.value === 0"
                  :style="getRatingDotStyle(point, point.value, selectedRatingStats)"
                  :aria-label="`${point.label}，${getRatingText(point.value, selectedRatingStats)}`"
                  @mouseenter="
                    showTrendTooltipFromHover(
                      point.key,
                      point.label,
                      getRatingText(point.value, selectedRatingStats),
                      point,
                    )
                  "
                  @mouseleave="hideChartTooltipFromHover(point.key)"
                  @focus="
                    showTrendTooltipFromHover(
                      point.key,
                      point.label,
                      getRatingText(point.value, selectedRatingStats),
                      point,
                    )
                  "
                  @blur="hideChartTooltipFromHover(point.key)"
                  @click.stop="
                    toggleTrendTooltip(
                      point.key,
                      point.label,
                      getRatingText(point.value, selectedRatingStats),
                      point,
                    )
                  "
                ></button>
              </template>
            </div>

            <div class="trend-labels">
              <div
                v-for="tick in trendAxisTicks"
                :key="tick.key"
                class="trend-label"
                :class="{
                  'trend-label--today': tick.key === formatDateInputValue(new Date()),
                }"
                :style="{ left: `${tick.x}%` }"
              >
                <em>{{ tick.label }}</em>
              </div>
            </div>
          </div>

          <div class="count-card__meta">
            <span>最近 {{ formatLatestDate(selectedRatingStats.latestOccurredAt) }}</span>
            <span>{{
              rangeMode === 'day'
                ? '單日多筆'
                : getStatsDetailBucketGranularityLabel(rangeMode, currentRange)
            }}</span>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <p>
          {{
            statsMode === 'count'
              ? '區間沒有可統計的次數紀錄。'
              : statsMode === 'sum'
                ? '區間沒有可統計的加總紀錄。'
                : statsMode === 'measurement'
                  ? '區間沒有可統計的測量紀錄。'
                  : '區間沒有可統計的評分紀錄。'
          }}
        </p>
        <p v-if="latestSelectedCategoryRecord" class="empty-state__latest">
          最後一次紀錄{{ latestSelectedCategoryRecord.valueText ? '為' : '於' }}
          <button type="button" @click="showLatestRecordRange">
            <template v-if="latestSelectedCategoryRecord.valueText">
              {{ latestSelectedCategoryRecord.valueText }}（{{
                latestSelectedCategoryRecord.dateTimeText
              }}）
            </template>
            <template v-else>{{ latestSelectedCategoryRecord.dateTimeText }}</template>
          </button>
        </p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.stats-view {
  display: grid;
  width: var(--content-width);
  gap: 12px;
  margin: 0 auto;
}

.stats-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.stats-back-button {
  justify-self: start;
  border: 0;
  padding: 8px 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.stats-header__title {
  display: grid;
  gap: 4px;
  min-width: 0;
  text-align: center;
}

.stats-header__title h1 {
  margin: 0;
}

.stats-header__title h1 {
  font-size: 1rem;
}

.stats-section {
  display: grid;
  gap: 10px;
}

.empty-state {
  margin: 0;
}

.empty-state {
  color: var(--color-muted);
}

.stats-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.stats-granularity {
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  white-space: nowrap;
}

.stats-controls--single {
  grid-template-columns: 1fr;
}

.stats-detail-range-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(64px, 1fr));
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  scrollbar-width: none;
}

.stats-detail-range-tabs::-webkit-scrollbar {
  display: none;
}

.stats-detail-range-tab {
  min-height: 40px;
  border: 0;
  border-right: 1px solid var(--color-divider);
  padding: 0 10px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  white-space: nowrap;
}

.stats-detail-range-tab:last-child {
  border-right: 0;
}

.stats-detail-range-tab--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.mode-tab {
  min-height: 40px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.mode-tab--active {
  background: var(--color-primary);
  color: var(--color-text);
}

.range-controls {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 8px;
}

.stats-custom-range {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.stats-custom-range label {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
  text-align: left;
}

.stats-custom-range :deep(.stats-date-picker__trigger) {
  min-height: 40px;
  background: var(--color-background);
}

.range-controls > strong {
  min-width: 0;
  color: var(--color-text);
  font-size: 0.95rem;
  text-align: center;
}

.range-picker {
  position: relative;
  min-width: 0;
  text-align: center;
}

.range-title-button {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
}

.range-title-button:hover {
  color: var(--color-primary-dark);
}

.range-title-button span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.range-title-button__chevron {
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1;
}

.range-picker-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 6;
  display: grid;
  width: min(278px, calc(100vw - 28px));
  gap: 12px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
  transform: translateX(-50%);
}

.range-picker-menu__year {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.range-picker-menu__hint {
  margin: -2px 0 0;
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-weight: 800;
  text-align: center;
}

.range-picker-menu__month-nav {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.range-picker-menu__year-button {
  width: 36px;
  height: 36px;
  font-size: 1.25rem;
}

.range-picker-menu__months {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.range-picker-menu__months--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.range-picker-menu__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.range-picker-menu__weeks {
  display: grid;
  gap: 8px;
}

.range-picker-menu__month {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
}

.range-picker-menu__day {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 800;
}

.range-picker-menu__week {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 800;
}

.range-picker-menu__record-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--color-primary);
}

.range-picker-menu__month:hover,
.range-picker-menu__day:hover,
.range-picker-menu__week:hover,
.range-picker-menu__month--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.range-picker-menu__month:disabled,
.range-picker-menu__day:disabled,
.range-picker-menu__week:disabled {
  border-color: var(--color-border);
  background: color-mix(in srgb, var(--color-background) 72%, transparent);
  color: var(--color-muted);
  cursor: not-allowed;
  opacity: 0.45;
}

.range-picker-menu__month:disabled:hover,
.range-picker-menu__day:disabled:hover,
.range-picker-menu__week:disabled:hover {
  border-color: var(--color-border);
  background: color-mix(in srgb, var(--color-background) 72%, transparent);
}

.range-button {
  width: 40px;
  height: 40px;
  font-size: 1.4rem;
  line-height: 1;
}

.range-button:disabled {
  border-color: var(--color-border);
  background: var(--color-disabled-surface);
  color: var(--color-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.range-button:disabled:hover {
  border-color: var(--color-border);
  background: var(--color-disabled-surface);
  color: var(--color-muted);
}

.stats-field {
  display: grid;
  gap: 6px;
}

.stats-field__label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.stats-field__label-row span {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 800;
}

.stats-field__label-row small {
  min-width: 0;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: right;
}

.stats-category-select {
  position: relative;
  min-width: 0;
}

.stats-category-trigger {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.stats-category-trigger:disabled {
  background: var(--color-disabled-surface);
  color: var(--color-muted);
  cursor: not-allowed;
}

.stats-category-trigger__name {
  min-width: 0;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-category-trigger__chevron {
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1;
}

.stats-category-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--category-color);
}

.stats-category-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 8;
  display: grid;
  max-height: min(360px, 48dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.stats-category-menu__group {
  display: grid;
  gap: 4px;
}

.stats-category-menu__group + .stats-category-menu__group {
  margin-top: 8px;
}

.stats-category-menu__group h3 {
  margin: 0;
  padding: 4px 8px;
  color: var(--color-muted);
  font-size: 0.75rem;
}

.stats-category-option {
  display: grid;
  grid-template-columns: 18px auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 38px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-align: left;
}

.stats-category-option:hover,
.stats-category-option--selected {
  border-color: color-mix(in srgb, var(--category-color) 34%, var(--color-border));
  background: color-mix(in srgb, var(--category-color) 10%, var(--color-surface));
}

.stats-category-option__check {
  color: var(--category-color);
  font-weight: 900;
}

.stats-category-option__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.interval-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 132px;
  margin-left: 10px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.interval-tabs--measurement {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.interval-tabs--rating {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.interval-tab {
  min-height: 38px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.interval-tab--active {
  background: var(--color-primary);
  color: var(--color-text);
}

.count-stats-list {
  display: grid;
  gap: 10px;
}

.count-card {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--category-color) 30%, var(--color-border));
  border-left: 5px solid var(--category-color);
  border-radius: 10px;
  background: color-mix(in srgb, var(--category-color) 7%, var(--color-surface));
}

.count-card__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.count-card__summary p {
  margin: 0;
}

.count-card__summary p,
.count-card__summary strong,
.count-card__meta {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.count-card__summary strong {
  flex: 0 0 auto;
  color: var(--color-text);
}

.count-card__delta--up {
  color: var(--color-danger) !important;
}

.stats-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.stats-metrics div {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--category-color) 22%, var(--color-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--category-color) 5%, var(--color-background));
}

.stats-metrics span {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.stats-metrics strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count-bars {
  position: relative;
  display: grid;
  gap: 4px;
}

.count-bars__plot,
.count-bars__labels {
  display: grid;
  grid-template-columns: repeat(var(--count-bucket-count), minmax(0, 1fr));
  gap: 6px;
}

.count-bars__plot {
  align-items: end;
  min-height: 76px;
  padding-top: 42px;
}

.count-bar {
  display: flex;
  height: 100%;
  align-items: end;
  justify-content: center;
  min-width: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.count-bar:disabled {
  cursor: default;
}

.count-bar__fill {
  width: 100%;
  max-width: 18px;
  border-radius: 999px 999px 3px 3px;
  background: var(--category-color);
  transition: opacity 120ms ease;
}

.count-bar--active .count-bar__fill {
  opacity: 0.6;
}

.count-bars__labels em {
  overflow: visible;
  min-width: 0;
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-style: normal;
  justify-self: center;
  text-align: center;
  white-space: nowrap;
}

.count-bar-label--today {
  color: var(--color-text);
  font-weight: 800;
}

.measurement-chart {
  position: relative;
  display: grid;
  gap: 8px;
  min-height: 140px;
}

.trend-plot {
  position: relative;
  width: 100%;
  height: 96px;
  overflow: hidden;
  border-radius: 8px;
  background:
    linear-gradient(
      to bottom,
      transparent,
      transparent 48%,
      color-mix(in srgb, var(--category-color) 14%, transparent) 49%,
      transparent 51%,
      transparent
    ),
    color-mix(in srgb, var(--category-color) 5%, var(--color-background));
}

.trend-chart {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.trend-chart__line {
  fill: none;
  stroke: var(--category-color);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
  vector-effect: non-scaling-stroke;
}

.trend-chart__dot {
  position: absolute;
  width: 12px;
  height: 12px;
  z-index: 2;
  border: 2px solid var(--color-surface);
  border-radius: 999px;
  padding: 0;
  background: var(--category-color);
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: opacity 120ms ease;
}

.trend-chart__dot:disabled {
  cursor: default;
}

.trend-chart__dot--active {
  opacity: 0.6;
}

.chart-tooltip {
  position: absolute;
  top: 0;
  z-index: 4;
  display: grid;
  min-width: max-content;
  max-width: min(220px, 76vw);
  gap: 2px;
  border: 1px solid color-mix(in srgb, var(--category-color) 45%, var(--color-border));
  border-radius: 7px;
  padding: 6px 9px;
  background: var(--color-surface);
  box-shadow: 0 8px 24px var(--shadow-color);
  color: var(--color-text);
  font-size: 0.75rem;
  pointer-events: none;
  transform: translateX(-50%);
}

.chart-tooltip span {
  color: var(--color-muted);
}

.trend-plot .chart-tooltip {
  top: 6px;
}

.trend-labels {
  position: relative;
  height: 18px;
}

.trend-label {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}

.trend-label em {
  overflow: visible;
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-style: normal;
  white-space: nowrap;
}

.trend-label--today em {
  color: var(--color-text);
  font-weight: 800;
}

.count-card__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.empty-state {
  display: grid;
  gap: 8px;
  padding: 18px 0;
  text-align: center;
}

.empty-state p {
  margin: 0;
}

.empty-state__latest {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.empty-state__latest button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #3182ce;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .count-bar:not(:disabled):hover .count-bar__fill,
  .count-bar:not(:disabled):focus-visible .count-bar__fill,
  .trend-chart__dot:not(:disabled):hover,
  .trend-chart__dot:not(:disabled):focus-visible {
    opacity: 0.6;
  }

  .mode-tab:hover,
  .interval-tab:hover,
  .stats-detail-range-tab:hover {
    background: color-mix(in srgb, var(--color-primary) 18%, transparent);
    color: var(--color-text);
  }

  .mode-tab--active:hover,
  .interval-tab--active:hover,
  .stats-detail-range-tab--active:hover {
    background: var(--color-primary);
    color: var(--color-on-primary);
  }
}

@media (max-width: 520px) {
  .stats-controls {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 10px;
  }

  .stats-field {
    width: 100%;
    justify-self: stretch;
  }

  .stats-granularity {
    justify-self: center;
  }

  .stats-detail-range-tabs {
    grid-template-columns: repeat(6, 72px);
  }

  .interval-tabs {
    width: min(100%, 300px);
    min-width: 0;
    margin-left: 0;
    justify-self: center;
  }

  .stats-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
