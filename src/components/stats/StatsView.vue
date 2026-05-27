<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import CatSwitcher from '@/components/common/CatSwitcher.vue'
import TodayButton from '@/components/common/TodayButton.vue'
import { getCategoryColorValue } from '@/constants/defaultData'
import {
  getCountTrendStats,
  getMeasurementStats,
  getRatingStats,
  getSumDailyStats,
  type CountCategoryStats,
  type MeasurementStats,
  type RatingStats,
  type SumDailyStats,
} from '@/services/catTrackerStats'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

type StatsMode = 'count' | 'sum' | 'measurement' | 'rating'
type CountInterval = 'day' | 'week' | 'month'
type ValueTrendInterval = 'day' | 'week' | 'month'
type MeasurementInterval = 'week' | 'month'
type RangePickerMode = 'day' | 'week' | 'twoMonth' | 'month' | 'halfYear'

const catTrackerStore = useCatTrackerStore()
const { categories, events, selectedCatId } = storeToRefs(catTrackerStore)
const countInterval = ref<CountInterval>('week')
const measurementInterval = ref<MeasurementInterval>('week')
const ratingInterval = ref<ValueTrendInterval>('week')
const selectedStatsCategoryId = ref('')
const statsReferenceDate = ref(new Date())
const isRangePickerOpen = ref(false)
const isStatsCategoryMenuOpen = ref(false)
const rangePickerYear = ref(statsReferenceDate.value.getFullYear())
const rangePickerMonth = ref(statsReferenceDate.value.getMonth())

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: new Intl.DateTimeFormat('zh-TW', { month: 'long' }).format(new Date(2024, index, 1)),
}))

const periodCount = computed(() =>
  countInterval.value === 'day' ? 7 : countInterval.value === 'week' ? 8 : 6,
)
const periodUnitText = computed(() =>
  countInterval.value === 'day' ? '天' : countInterval.value === 'week' ? '週' : '個月',
)
const recentPeriodText = computed(() => `最近 ${periodCount.value} ${periodUnitText.value}`)
const previousPeriodText = computed(() => `前 ${periodCount.value} ${periodUnitText.value}`)
const selectedStatsCategory = computed(() =>
  statCategories.value.find((category) => category.id === selectedStatsCategoryId.value),
)
const statsMode = computed<StatsMode>(() => selectedStatsCategory.value?.statisticsMode ?? 'count')
const currentRange = computed(() => {
  if (statsMode.value === 'count') {
    if (countInterval.value === 'day') {
      return getStatsRange(statsReferenceDate.value, 'week', 1)
    }

    return getStatsRange(statsReferenceDate.value, countInterval.value, periodCount.value)
  }

  if (statsMode.value === 'rating' && ratingInterval.value === 'day') {
    return getStatsRange(statsReferenceDate.value, 'day', 1)
  }

  if (statsMode.value === 'measurement') {
    return getStatsRange(
      statsReferenceDate.value,
      'day',
      measurementInterval.value === 'month' ? 30 : 7,
    )
  }

  if (statsMode.value === 'rating') {
    return getStatsRange(statsReferenceDate.value, 'day', ratingInterval.value === 'month' ? 30 : 7)
  }

  return getStatsRange(statsReferenceDate.value, 'day', 7)
})
const rangeTitle = computed(
  () => `${formatRangeDate(currentRange.value.start)} - ${formatRangeDate(currentRange.value.end)}`,
)
const nextRangeReferenceDate = computed(() => getNextRangeReferenceDate())
const canShowNextRange = computed(
  () => getStatsRangeStart(nextRangeReferenceDate.value) <= startOfDay(new Date()),
)
const rangePickerMonthIndex = computed(() => statsReferenceDate.value.getMonth())
const rangePickerMode = computed<RangePickerMode>(() => {
  if (statsMode.value === 'count') {
    if (countInterval.value === 'day') {
      return 'week'
    }

    if (countInterval.value === 'week') {
      return 'twoMonth'
    }

    return 'halfYear'
  }

  if (statsMode.value === 'sum') {
    return 'week'
  }

  if (statsMode.value === 'measurement') {
    return measurementInterval.value === 'week' ? 'week' : 'month'
  }

  if (ratingInterval.value === 'day') {
    return 'day'
  }

  return ratingInterval.value === 'week' ? 'week' : 'month'
})
const rangePickerLabel = computed(() => {
  if (rangePickerMode.value === 'day') {
    return '選擇日期'
  }

  if (rangePickerMode.value === 'week') {
    return '選擇週區間'
  }

  if (rangePickerMode.value === 'twoMonth') {
    return '選擇雙月區間'
  }

  if (rangePickerMode.value === 'halfYear') {
    return '選擇半年區間'
  }

  return '選擇月份'
})
const shouldShowRangePickerHint = computed(
  () => !(statsMode.value === 'count' && countInterval.value === 'day'),
)
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
const countStats = computed(() =>
  getCountTrendStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    interval: countInterval.value,
    periods: periodCount.value,
    referenceDate: statsReferenceDate.value,
  }),
)
const selectedCountStats = computed(() =>
  countStats.value.find((stats) => stats.category.id === selectedStatsCategoryId.value),
)
const selectedSumStats = computed(() =>
  getSumDailyStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedStatsCategoryId.value,
    referenceDate: statsReferenceDate.value,
    days: 7,
  }),
)
const selectedMeasurementStats = computed(() =>
  getMeasurementStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedStatsCategoryId.value,
    interval: measurementInterval.value,
    referenceDate: statsReferenceDate.value,
  }),
)
const selectedRatingStats = computed(() =>
  getRatingStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedStatsCategoryId.value,
    interval: ratingInterval.value,
    referenceDate: statsReferenceDate.value,
  }),
)

watch(
  statCategories,
  (categoryList) => {
    if (categoryList.length === 0) {
      selectedStatsCategoryId.value = ''
      isStatsCategoryMenuOpen.value = false
      return
    }

    if (!categoryList.some((category) => category.id === selectedStatsCategoryId.value)) {
      selectedStatsCategoryId.value = categoryList[0]?.id ?? ''
      isStatsCategoryMenuOpen.value = false
    }
  },
  { immediate: true },
)

watch(
  [selectedStatsCategoryId, selectedCatId],
  ([categoryId]) => {
    const latestDate = getLatestCategoryEventDate(categoryId)

    if (latestDate) {
      statsReferenceDate.value = latestDate
    }
  },
  { immediate: true },
)

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

function getLatestCategoryEventDate(categoryId: string): Date | null {
  const latestEvent = events.value
    .filter((event) => event.catId === selectedCatId.value && event.categoryId === categoryId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0]

  return latestEvent ? new Date(latestEvent.occurredAt) : null
}

function getMeasurementChartStyle(stats: MeasurementStats): Record<string, string> {
  return {
    '--measurement-point-count': String(Math.max(stats.points.length, 1)),
  }
}

function getRatingChartStyle(stats: RatingStats): Record<string, string> {
  return {
    '--measurement-point-count': String(Math.max(stats.points.length, 1)),
  }
}

function getDeltaText(delta: number): string {
  if (delta > 0) {
    return `比${previousPeriodText.value} +${delta}`
  }

  if (delta < 0) {
    return `比${previousPeriodText.value} ${delta}`
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
  const recordedDays = stats.buckets.filter((bucket) => bucket.total > 0).length

  return getAmountText(stats.rangeTotal / Math.max(recordedDays, 1), stats)
}

function getMeasurementText(value: number, stats: MeasurementStats): string {
  return `${formatAmount(value)}${stats.category.valueUnit ? ` ${stats.category.valueUnit}` : ''}`
}

function getRatingText(value: number, stats: RatingStats): string {
  return `${formatAmount(value)} / ${stats.category.valueMax ?? 10}`
}

function getMeasurementLinePoints(stats: MeasurementStats): string {
  return stats.points
    .map((point, index) => {
      if (typeof point.value !== 'number') {
        return ''
      }

      const position = getTrendPointPosition(
        index,
        stats.points.length,
        point.value,
        stats.minValue,
        stats.maxValue,
      )

      return `${position.x},${position.y}`
    })
    .filter(Boolean)
    .join(' ')
}

function getRatingLinePoints(stats: RatingStats): string {
  return stats.points
    .map((point, index) => {
      if (typeof point.value !== 'number') {
        return ''
      }

      const position = getTrendPointPosition(
        index,
        stats.points.length,
        point.value,
        0,
        stats.category.valueMax ?? 10,
      )

      return `${position.x},${position.y}`
    })
    .filter(Boolean)
    .join(' ')
}

function getMeasurementPointPosition(
  index: number,
  pointCount: number,
  value: number,
  stats: MeasurementStats,
): { x: number; y: number } {
  return getTrendPointPosition(index, pointCount, value, stats.minValue, stats.maxValue)
}

function getMeasurementDotStyle(
  index: number,
  pointCount: number,
  value: number,
  stats: MeasurementStats,
): Record<string, string> {
  const position = getMeasurementPointPosition(index, pointCount, value, stats)

  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
  }
}

function getRatingPointPosition(
  index: number,
  pointCount: number,
  value: number,
  stats: RatingStats,
): { x: number; y: number } {
  return getTrendPointPosition(index, pointCount, value, 0, stats.category.valueMax ?? 10)
}

function getRatingDotStyle(
  index: number,
  pointCount: number,
  value: number,
  stats: RatingStats,
): Record<string, string> {
  const position = getRatingPointPosition(index, pointCount, value, stats)

  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
  }
}

function getTrendPointPosition(
  index: number,
  pointCount: number,
  value: number,
  minValue: number,
  maxValue: number,
): { x: number; y: number } {
  const x = pointCount <= 1 ? 50 : 8 + (index / (pointCount - 1)) * 84
  const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue)
  const y = 92 - Math.max(0, Math.min(ratio, 1)) * 84

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  }
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
  if (statsMode.value === 'measurement') {
    statsReferenceDate.value = shiftDate(
      statsReferenceDate.value,
      'day',
      -getValueTrendShift(measurementInterval.value),
    )
    return
  }

  if (statsMode.value === 'rating') {
    statsReferenceDate.value = shiftDate(
      statsReferenceDate.value,
      'day',
      -getValueTrendShift(ratingInterval.value),
    )
    return
  }

  statsReferenceDate.value =
    statsMode.value === 'count'
      ? shiftDate(statsReferenceDate.value, countInterval.value, -periodCount.value)
      : shiftDate(statsReferenceDate.value, 'day', -7)
}

function showNextRange(): void {
  if (!canShowNextRange.value) {
    return
  }

  statsReferenceDate.value = nextRangeReferenceDate.value
}

function getNextRangeReferenceDate(): Date {
  if (statsMode.value === 'measurement') {
    return shiftDate(statsReferenceDate.value, 'day', getValueTrendShift(measurementInterval.value))
  }

  if (statsMode.value === 'rating') {
    return shiftDate(statsReferenceDate.value, 'day', getValueTrendShift(ratingInterval.value))
  }

  return statsMode.value === 'count'
    ? shiftDate(statsReferenceDate.value, countInterval.value, periodCount.value)
    : shiftDate(statsReferenceDate.value, 'day', 7)
}

function showTodayRange(): void {
  statsReferenceDate.value = new Date()
  isRangePickerOpen.value = false
}

function getStatsRangeStart(referenceDate: Date): Date {
  if (statsMode.value === 'count') {
    if (countInterval.value === 'day') {
      return getStatsRange(referenceDate, 'week', 1).start
    }

    return getStatsRange(referenceDate, countInterval.value, periodCount.value).start
  }

  if (statsMode.value === 'rating' && ratingInterval.value === 'day') {
    return getStatsRange(referenceDate, 'day', 1).start
  }

  if (statsMode.value === 'measurement') {
    return getStatsRange(referenceDate, 'day', measurementInterval.value === 'month' ? 30 : 7).start
  }

  if (statsMode.value === 'rating') {
    return getStatsRange(referenceDate, 'day', ratingInterval.value === 'month' ? 30 : 7).start
  }

  return getStatsRange(referenceDate, 'day', 7).start
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
      <CatSwitcher />

      <div class="stats-header__title">
        <h1 id="stats-title">統計</h1>
      </div>

      <TodayButton @click="showTodayRange" />
    </header>

    <section class="stats-section" aria-labelledby="stats-item-label">
      <div class="stats-controls">
        <div class="stats-field">
          <div class="stats-field__label-row">
            <span id="stats-item-label">紀錄項目</span>
            <small>僅顯示實際有紀錄的分類</small>
          </div>

          <div class="stats-category-select">
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
              aria-labelledby="stats-item-label"
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
                  :class="{ 'stats-category-option--selected': category.id === selectedStatsCategoryId }"
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

        <div
          v-if="statsMode === 'count'"
          class="interval-tabs"
          role="tablist"
          aria-label="統計區間"
        >
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': countInterval === 'day' }"
            type="button"
            role="tab"
            :aria-selected="countInterval === 'day'"
            @click="countInterval = 'day'"
          >
            日
          </button>
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': countInterval === 'week' }"
            type="button"
            role="tab"
            :aria-selected="countInterval === 'week'"
            @click="countInterval = 'week'"
          >
            週
          </button>
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': countInterval === 'month' }"
            type="button"
            role="tab"
            :aria-selected="countInterval === 'month'"
            @click="countInterval = 'month'"
          >
            月
          </button>
        </div>

        <div
          v-else-if="statsMode === 'measurement'"
          class="interval-tabs interval-tabs--measurement"
          role="tablist"
          aria-label="測量統計區間"
        >
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': measurementInterval === 'week' }"
            type="button"
            role="tab"
            :aria-selected="measurementInterval === 'week'"
            @click="measurementInterval = 'week'"
          >
            週
          </button>
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': measurementInterval === 'month' }"
            type="button"
            role="tab"
            :aria-selected="measurementInterval === 'month'"
            @click="measurementInterval = 'month'"
          >
            月
          </button>
        </div>

        <div
          v-else-if="statsMode === 'rating'"
          class="interval-tabs interval-tabs--rating"
          role="tablist"
          aria-label="評分統計區間"
        >
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': ratingInterval === 'day' }"
            type="button"
            role="tab"
            :aria-selected="ratingInterval === 'day'"
            @click="ratingInterval = 'day'"
          >
            日
          </button>
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': ratingInterval === 'week' }"
            type="button"
            role="tab"
            :aria-selected="ratingInterval === 'week'"
            @click="ratingInterval = 'week'"
          >
            週
          </button>
          <button
            class="interval-tab"
            :class="{ 'interval-tab--active': ratingInterval === 'month' }"
            type="button"
            role="tab"
            :aria-selected="ratingInterval === 'month'"
            @click="ratingInterval = 'month'"
          >
            月
          </button>
        </div>
      </div>

      <div class="range-controls" aria-label="統計日期區間">
        <button
          class="ui-button ui-button--icon range-button"
          type="button"
          @click="showPreviousRange"
        >
          ‹
        </button>
        <div class="range-picker">
          <button
            class="range-title-button"
            type="button"
            :aria-expanded="isRangePickerOpen"
            aria-haspopup="dialog"
            @click="toggleRangePicker"
          >
            <span>{{ rangeTitle }}</span>
            <span class="range-title-button__chevron" aria-hidden="true">▾</span>
          </button>

          <div
            v-if="isRangePickerOpen"
            class="range-picker-menu"
            role="dialog"
            aria-label="切換統計區間"
          >
            <div v-if="rangePickerMode !== 'week'" class="range-picker-menu__year">
              <button
                class="ui-button ui-button--icon range-picker-menu__year-button"
                type="button"
                aria-label="上一年"
                @click="changeRangePickerYear(-1)"
              >
                ‹
              </button>
              <strong>{{ rangePickerYear }}年</strong>
              <button
                class="ui-button ui-button--icon range-picker-menu__year-button"
                type="button"
                aria-label="下一年"
                @click="changeRangePickerYear(1)"
              >
                ›
              </button>
            </div>

            <p v-if="shouldShowRangePickerHint" class="range-picker-menu__hint">
              {{ rangePickerLabel }}
            </p>

            <div
              v-if="rangePickerMode === 'day' || rangePickerMode === 'week'"
              class="range-picker-menu__month-nav"
            >
              <button
                class="ui-button ui-button--icon range-picker-menu__year-button"
                type="button"
                aria-label="上一個月"
                @click="changeRangePickerMonth(-1)"
              >
                ‹
              </button>
              <strong>{{ rangePickerMonthLabel }}</strong>
              <button
                class="ui-button ui-button--icon range-picker-menu__year-button"
                type="button"
                aria-label="下一個月"
                @click="changeRangePickerMonth(1)"
              >
                ›
              </button>
            </div>

            <div
              v-if="rangePickerMode === 'day'"
              class="range-picker-menu__days"
              aria-label="選擇日期"
            >
              <button
                v-for="day in rangePickerDays"
                :key="day.key"
                class="range-picker-menu__day"
                :class="{ 'range-picker-menu__month--selected': isReferenceDate(day.date) }"
                :disabled="isFutureRange(day.date)"
                type="button"
                @click="selectRangeDay(day.date)"
              >
                <span
                  v-if="hasRecordInRange(day.date, day.date)"
                  class="range-picker-menu__record-dot"
                  aria-hidden="true"
                ></span>
                {{ day.label }}
              </button>
            </div>

            <div
              v-else-if="rangePickerMode === 'week'"
              class="range-picker-menu__weeks"
              aria-label="選擇週區間"
            >
              <button
                v-for="week in rangePickerWeeks"
                :key="week.key"
                class="range-picker-menu__week"
                :class="{
                  'range-picker-menu__month--selected': isReferenceInRange(week.start, week.end),
                }"
                :disabled="isFutureRange(week.start)"
                type="button"
                @click="selectRangeWeek(week.end)"
              >
                <span
                  v-if="hasRecordInRange(week.start, week.end)"
                  class="range-picker-menu__record-dot"
                  aria-hidden="true"
                ></span>
                {{ week.label }}
              </button>
            </div>

            <div
              v-else-if="rangePickerMode === 'twoMonth'"
              class="range-picker-menu__months"
              aria-label="選擇雙月區間"
            >
              <button
                v-for="period in twoMonthOptions"
                :key="period.startMonth"
                class="range-picker-menu__month"
                :class="{
                  'range-picker-menu__month--selected': isReferenceInRange(
                    period.start,
                    period.end,
                  ),
                }"
                :disabled="isFutureRange(period.start)"
                type="button"
                @click="selectRangeTwoMonth(period.end)"
              >
                <span
                  v-if="hasRecordInRange(period.start, period.end)"
                  class="range-picker-menu__record-dot"
                  aria-hidden="true"
                ></span>
                {{ period.label }}
              </button>
            </div>

            <div
              v-else-if="rangePickerMode === 'halfYear'"
              class="range-picker-menu__months range-picker-menu__months--two"
              aria-label="選擇半年區間"
            >
              <button
                v-for="period in halfYearOptions"
                :key="period.key"
                class="range-picker-menu__month"
                :class="{
                  'range-picker-menu__month--selected': isReferenceInRange(
                    period.start,
                    period.end,
                  ),
                }"
                :disabled="isFutureRange(period.start)"
                type="button"
                @click="selectRangeHalfYear(period.end)"
              >
                <span
                  v-if="hasRecordInRange(period.start, period.end)"
                  class="range-picker-menu__record-dot"
                  aria-hidden="true"
                ></span>
                {{ period.label }}
              </button>
            </div>

            <div v-else class="range-picker-menu__months" aria-label="選擇月份">
              <button
                v-for="month in monthOptions"
                :key="month.index"
                class="range-picker-menu__month"
                :class="{
                  'range-picker-menu__month--selected':
                    rangePickerYear === statsReferenceDate.getFullYear() &&
                    month.index === rangePickerMonthIndex,
                }"
                :disabled="isFutureRange(new Date(rangePickerYear, month.index, 1))"
                type="button"
                @click="selectRangeMonth(month.index)"
              >
                <span
                  v-if="
                    hasRecordInRange(
                      new Date(rangePickerYear, month.index, 1),
                      new Date(rangePickerYear, month.index + 1, 0),
                    )
                  "
                  class="range-picker-menu__record-dot"
                  aria-hidden="true"
                ></span>
                {{ month.label }}
              </button>
            </div>
          </div>
        </div>
        <button
          class="ui-button ui-button--icon range-button"
          type="button"
          :disabled="!canShowNextRange"
          @click="showNextRange"
        >
          ›
        </button>
      </div>

      <div v-if="statsMode === 'count' && selectedCountStats" class="count-stats-list">
        <article
          :key="selectedCountStats.category.id"
          class="count-card"
          :style="getStatsStyle(selectedCountStats)"
        >
          <div class="count-card__summary">
            <div>
              <h3>{{ selectedCountStats.category.name }}</h3>
              <p>{{ recentPeriodText }} {{ selectedCountStats.recentTotal }} 次</p>
            </div>
            <strong :class="{ 'count-card__delta--up': selectedCountStats.delta > 0 }">
              {{ getDeltaText(selectedCountStats.delta) }}
            </strong>
          </div>

          <div
            class="count-bars"
            aria-label="近期趨勢"
            :style="getCountBarsStyle(selectedCountStats)"
          >
            <div v-for="bucket in selectedCountStats.buckets" :key="bucket.key" class="count-bar">
              <span
                class="count-bar__fill"
                :style="{ height: getBarHeight(bucket.count, selectedCountStats) }"
                :title="`${bucket.label}: ${bucket.count} 次`"
              ></span>
              <small>{{ bucket.count }}</small>
              <em>{{ bucket.label }}</em>
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
              <h3>{{ selectedSumStats.category.name }}</h3>
              <p>每日平均 {{ getDailyAverageText(selectedSumStats) }}</p>
            </div>
          </div>

          <div class="stats-metrics">
            <div>
              <span>區間最後日</span>
              <strong>{{
                getAmountText(selectedSumStats.currentDayTotal, selectedSumStats)
              }}</strong>
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

          <div class="count-bars" aria-label="每日總量" :style="getSumBarsStyle(selectedSumStats)">
            <div v-for="bucket in selectedSumStats.buckets" :key="bucket.key" class="count-bar">
              <span
                class="count-bar__fill"
                :style="{ height: getSumBarHeight(bucket.total, selectedSumStats) }"
                :title="`${bucket.label}: ${getAmountText(bucket.total, selectedSumStats)}`"
              ></span>
              <small>{{ formatAmount(bucket.total) }}</small>
              <em>{{ bucket.label }}</em>
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
              <h3>{{ selectedMeasurementStats.category.name }}</h3>
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

          <div
            class="measurement-chart"
            aria-label="量測趨勢"
            :style="getMeasurementChartStyle(selectedMeasurementStats)"
          >
            <div class="trend-plot">
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
              <template v-for="(point, index) in selectedMeasurementStats.points" :key="point.key">
                <span
                  v-if="typeof point.value === 'number'"
                  class="trend-chart__dot"
                  :style="
                    getMeasurementDotStyle(
                      index,
                      selectedMeasurementStats.points.length,
                      point.value,
                      selectedMeasurementStats,
                    )
                  "
                  :title="`${point.label}: ${getMeasurementText(point.value, selectedMeasurementStats)}`"
                ></span>
              </template>
            </div>

            <div class="trend-labels">
              <div
                v-for="point in selectedMeasurementStats.points"
                :key="point.key"
                class="trend-label"
              >
                <small>{{
                  typeof point.value === 'number' ? formatAmount(point.value) : '-'
                }}</small>
                <em>{{ point.label }}</em>
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
              <h3>{{ selectedRatingStats.category.name }}</h3>
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

          <div
            class="measurement-chart"
            aria-label="評分趨勢"
            :style="getRatingChartStyle(selectedRatingStats)"
          >
            <div class="trend-plot">
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
              <template v-for="(point, index) in selectedRatingStats.points" :key="point.key">
                <span
                  v-if="typeof point.value === 'number'"
                  class="trend-chart__dot"
                  :style="
                    getRatingDotStyle(
                      index,
                      selectedRatingStats.points.length,
                      point.value,
                      selectedRatingStats,
                    )
                  "
                  :title="`${point.label}: ${getRatingText(point.value, selectedRatingStats)}`"
                ></span>
              </template>
            </div>

            <div class="trend-labels">
              <div v-for="point in selectedRatingStats.points" :key="point.key" class="trend-label">
                <small>{{
                  typeof point.value === 'number' ? formatAmount(point.value) : '-'
                }}</small>
                <em>{{ point.label }}</em>
              </div>
            </div>
          </div>

          <div class="count-card__meta">
            <span>最近 {{ formatLatestDate(selectedRatingStats.latestOccurredAt) }}</span>
            <span>{{ ratingInterval === 'day' ? '單日多筆' : '只顯示有紀錄日期' }}</span>
          </div>
        </article>
      </div>

      <p v-else class="empty-state">
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
  align-items: end;
  gap: 10px;
}

.stats-controls--single {
  grid-template-columns: 1fr;
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
  min-height: 40px;
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

.count-card__summary h3,
.count-card__summary p {
  margin: 0;
}

.count-card__summary h3 {
  font-size: 1rem;
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
  display: grid;
  grid-template-columns: repeat(var(--count-bucket-count), minmax(0, 1fr));
  align-items: end;
  gap: 6px;
  min-height: 76px;
}

.count-bar {
  display: grid;
  align-items: end;
  gap: 4px;
  min-width: 0;
  justify-items: center;
}

.count-bar__fill {
  width: 100%;
  max-width: 18px;
  border-radius: 999px 999px 3px 3px;
  background: var(--category-color);
}

.count-bar small {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.count-bar em {
  overflow: hidden;
  max-width: 100%;
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.measurement-chart {
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
  border: 2px solid var(--color-surface);
  border-radius: 999px;
  background: var(--category-color);
  transform: translate(-50%, -50%);
}

.trend-labels {
  display: grid;
  grid-template-columns: repeat(var(--measurement-point-count, 7), minmax(0, 1fr));
  gap: 6px;
}

.trend-label {
  display: grid;
  gap: 2px;
  min-width: 0;
  justify-items: center;
}

.trend-label small {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.trend-label em {
  overflow: hidden;
  max-width: 100%;
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count-card__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.empty-state {
  padding: 18px 0;
  text-align: center;
}

@media (hover: hover) and (pointer: fine) {
  .mode-tab:hover,
  .interval-tab:hover {
    background: color-mix(in srgb, var(--color-primary) 18%, transparent);
    color: var(--color-text);
  }

  .mode-tab--active:hover,
  .interval-tab--active:hover {
    background: var(--color-primary);
  }
}

@media (max-width: 520px) {
  .stats-controls {
    grid-template-columns: 1fr;
  }

  .stats-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
