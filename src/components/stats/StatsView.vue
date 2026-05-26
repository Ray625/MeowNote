<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
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

type StatsMode = 'count' | 'sum' | 'measurement' | 'rating'
type CountInterval = 'day' | 'week' | 'month'
type ValueTrendInterval = 'day' | 'week' | 'month'
type MeasurementInterval = 'week' | 'month'

const catTrackerStore = useCatTrackerStore()
const { categories, events, selectedCat, selectedCatId } = storeToRefs(catTrackerStore)
const statsMode = ref<StatsMode>('count')
const countInterval = ref<CountInterval>('week')
const measurementInterval = ref<MeasurementInterval>('week')
const ratingInterval = ref<ValueTrendInterval>('week')
const selectedCountCategoryId = ref('')
const selectedSumCategoryId = ref('')
const selectedMeasurementCategoryId = ref('')
const selectedRatingCategoryId = ref('')
const statsReferenceDate = ref(new Date())

const periodCount = computed(() =>
  countInterval.value === 'day' ? 7 : countInterval.value === 'week' ? 8 : 6,
)
const periodUnitText = computed(() =>
  countInterval.value === 'day' ? '天' : countInterval.value === 'week' ? '週' : '個月',
)
const recentPeriodText = computed(() => `最近 ${periodCount.value} ${periodUnitText.value}`)
const previousPeriodText = computed(() => `前 ${periodCount.value} ${periodUnitText.value}`)
const currentRange = computed(() => {
  if (statsMode.value === 'count') {
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
const modeTitle = computed(() => {
  if (statsMode.value === 'count') {
    return '發生次數'
  }

  if (statsMode.value === 'sum') {
    return '累積數量'
  }

  return statsMode.value === 'measurement' ? '量測紀錄' : '狀態評分'
})
const categoryCountText = computed(() => {
  if (statsMode.value === 'count') {
    return `${countStats.value.length} 個分類`
  }

  if (statsMode.value === 'sum') {
    return `${sumCategories.value.length} 個分類`
  }

  return statsMode.value === 'measurement'
    ? `${measurementCategories.value.length} 個分類`
    : `${ratingCategories.value.length} 個分類`
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
  countStats.value.find((stats) => stats.category.id === selectedCountCategoryId.value),
)
const sumCategories = computed(() =>
  categories.value
    .filter((category) => category.statisticsMode === 'sum' && !category.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)
const selectedSumStats = computed(() =>
  getSumDailyStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedSumCategoryId.value,
    referenceDate: statsReferenceDate.value,
    days: 7,
  }),
)
const measurementCategories = computed(() =>
  categories.value
    .filter((category) => category.statisticsMode === 'measurement' && !category.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)
const selectedMeasurementStats = computed(() =>
  getMeasurementStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedMeasurementCategoryId.value,
    interval: measurementInterval.value,
    referenceDate: statsReferenceDate.value,
  }),
)
const ratingCategories = computed(() =>
  categories.value
    .filter((category) => category.statisticsMode === 'rating' && !category.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)
const selectedRatingStats = computed(() =>
  getRatingStats({
    categories: categories.value,
    events: events.value,
    catId: selectedCatId.value,
    categoryId: selectedRatingCategoryId.value,
    interval: ratingInterval.value,
    referenceDate: statsReferenceDate.value,
  }),
)

watch(
  countStats,
  (statsList) => {
    if (statsList.length === 0) {
      selectedCountCategoryId.value = ''
      return
    }

    if (!statsList.some((stats) => stats.category.id === selectedCountCategoryId.value)) {
      selectedCountCategoryId.value = statsList[0]?.category.id ?? ''
    }
  },
  { immediate: true },
)

watch(
  sumCategories,
  (categoryList) => {
    if (categoryList.length === 0) {
      selectedSumCategoryId.value = ''
      return
    }

    if (!categoryList.some((category) => category.id === selectedSumCategoryId.value)) {
      selectedSumCategoryId.value = categoryList[0]?.id ?? ''
    }
  },
  { immediate: true },
)

watch(
  measurementCategories,
  (categoryList) => {
    if (categoryList.length === 0) {
      selectedMeasurementCategoryId.value = ''
      return
    }

    if (!categoryList.some((category) => category.id === selectedMeasurementCategoryId.value)) {
      selectedMeasurementCategoryId.value = categoryList[0]?.id ?? ''
    }
  },
  { immediate: true },
)

watch(
  ratingCategories,
  (categoryList) => {
    if (categoryList.length === 0) {
      selectedRatingCategoryId.value = ''
      return
    }

    if (!categoryList.some((category) => category.id === selectedRatingCategoryId.value)) {
      selectedRatingCategoryId.value = categoryList[0]?.id ?? ''
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
  if (statsMode.value === 'measurement') {
    statsReferenceDate.value = shiftDate(
      statsReferenceDate.value,
      'day',
      getValueTrendShift(measurementInterval.value),
    )
    return
  }

  if (statsMode.value === 'rating') {
    statsReferenceDate.value = shiftDate(
      statsReferenceDate.value,
      'day',
      getValueTrendShift(ratingInterval.value),
    )
    return
  }

  statsReferenceDate.value =
    statsMode.value === 'count'
      ? shiftDate(statsReferenceDate.value, countInterval.value, periodCount.value)
      : shiftDate(statsReferenceDate.value, 'day', 7)
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
</script>

<template>
  <section class="stats-view" aria-labelledby="stats-title">
    <header class="stats-header">
      <h1 id="stats-title">統計</h1>
      <p>{{ selectedCat?.name ?? '目前寵物' }} · {{ modeTitle }}</p>
    </header>

    <section class="stats-section" aria-labelledby="count-stats-title">
      <div class="stats-section__header">
        <h2 id="count-stats-title">追蹤統計</h2>
        <span>{{ categoryCountText }}</span>
      </div>

      <div class="mode-tabs" role="tablist" aria-label="統計方式">
        <button
          class="mode-tab"
          :class="{ 'mode-tab--active': statsMode === 'count' }"
          type="button"
          role="tab"
          :aria-selected="statsMode === 'count'"
          @click="statsMode = 'count'"
        >
          發生次數
        </button>
        <button
          class="mode-tab"
          :class="{ 'mode-tab--active': statsMode === 'sum' }"
          type="button"
          role="tab"
          :aria-selected="statsMode === 'sum'"
          @click="statsMode = 'sum'"
        >
          累積數量
        </button>
        <button
          class="mode-tab"
          :class="{ 'mode-tab--active': statsMode === 'measurement' }"
          type="button"
          role="tab"
          :aria-selected="statsMode === 'measurement'"
          @click="statsMode = 'measurement'"
        >
          量測紀錄
        </button>
        <button
          class="mode-tab"
          :class="{ 'mode-tab--active': statsMode === 'rating' }"
          type="button"
          role="tab"
          :aria-selected="statsMode === 'rating'"
          @click="statsMode = 'rating'"
        >
          狀態評分
        </button>
      </div>

      <div v-if="statsMode === 'count'" class="stats-controls">
        <label class="stats-field">
          <span>紀錄項目</span>
          <select v-model="selectedCountCategoryId">
            <option v-for="stats in countStats" :key="stats.category.id" :value="stats.category.id">
              {{ stats.category.name }}
            </option>
          </select>
        </label>

        <div class="interval-tabs" role="tablist" aria-label="統計區間">
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
      </div>

      <div v-else-if="statsMode === 'sum'" class="stats-controls stats-controls--single">
        <label class="stats-field">
          <span>紀錄項目</span>
          <select v-model="selectedSumCategoryId">
            <option v-for="category in sumCategories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>
      </div>

      <div v-else-if="statsMode === 'measurement'" class="stats-controls">
        <label class="stats-field">
          <span>紀錄項目</span>
          <select v-model="selectedMeasurementCategoryId">
            <option
              v-for="category in measurementCategories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
        </label>

        <div
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
      </div>

      <div v-else class="stats-controls">
        <label class="stats-field">
          <span>紀錄項目</span>
          <select v-model="selectedRatingCategoryId">
            <option v-for="category in ratingCategories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>

        <div class="interval-tabs interval-tabs--rating" role="tablist" aria-label="評分統計區間">
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
        <strong>{{ rangeTitle }}</strong>
        <button class="ui-button ui-button--icon range-button" type="button" @click="showNextRange">
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
                <small>{{ typeof point.value === 'number' ? formatAmount(point.value) : '-' }}</small>
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
              <p>最近評分 {{ getRatingText(selectedRatingStats.latestValue, selectedRatingStats) }}</p>
            </div>
          </div>

          <div class="stats-metrics">
            <div>
              <span>最高</span>
              <strong>{{ getRatingText(selectedRatingStats.maxValue, selectedRatingStats) }}</strong>
            </div>
            <div>
              <span>最低</span>
              <strong>{{ getRatingText(selectedRatingStats.minValue, selectedRatingStats) }}</strong>
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
                <small>{{ typeof point.value === 'number' ? formatAmount(point.value) : '-' }}</small>
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
            ? '最近還沒有可統計的次數紀錄。'
            : statsMode === 'sum'
              ? '最近還沒有可統計的加總紀錄。'
              : statsMode === 'measurement'
                ? '最近還沒有可統計的測量紀錄。'
                : '最近還沒有可統計的評分紀錄。'
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
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.stats-header h1,
.stats-header p {
  margin: 0;
}

.stats-header h1 {
  font-size: 1.4rem;
}

.stats-header p {
  color: var(--color-muted);
}

.stats-section {
  display: grid;
  gap: 10px;
}

.stats-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.stats-section__header h2,
.stats-section__header span,
.empty-state {
  margin: 0;
}

.stats-section__header h2 {
  font-size: 1.05rem;
}

.stats-section__header span,
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

.range-controls strong {
  min-width: 0;
  color: var(--color-text);
  font-size: 0.95rem;
  text-align: center;
}

.range-button {
  width: 40px;
  height: 40px;
  font-size: 1.4rem;
  line-height: 1;
}

.stats-field {
  display: grid;
  gap: 6px;
}

.stats-field span {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 800;
}

.stats-field select {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 700;
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
