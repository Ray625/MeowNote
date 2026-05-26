<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getCategoryColorValue } from '@/constants/defaultData'
import { getCountTrendStats, type CountCategoryStats } from '@/services/catTrackerStats'
import { useCatTrackerStore } from '@/stores/catTracker'

type CountInterval = 'day' | 'week' | 'month'

const catTrackerStore = useCatTrackerStore()
const { categories, events, selectedCat, selectedCatId } = storeToRefs(catTrackerStore)
const countInterval = ref<CountInterval>('week')
const selectedCountCategoryId = ref('')
const statsReferenceDate = ref(new Date())

const periodCount = computed(() =>
  countInterval.value === 'day' ? 7 : countInterval.value === 'week' ? 8 : 6,
)
const periodUnitText = computed(() =>
  countInterval.value === 'day' ? '天' : countInterval.value === 'week' ? '週' : '個月',
)
const recentPeriodText = computed(() => `最近 ${periodCount.value} ${periodUnitText.value}`)
const previousPeriodText = computed(() => `前 ${periodCount.value} ${periodUnitText.value}`)
const currentRange = computed(() =>
  getStatsRange(statsReferenceDate.value, countInterval.value, periodCount.value),
)
const rangeTitle = computed(
  () => `${formatRangeDate(currentRange.value.start)} - ${formatRangeDate(currentRange.value.end)}`,
)

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
const selectedCountStats = computed(
  () => countStats.value.find((stats) => stats.category.id === selectedCountCategoryId.value),
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

function getStatsStyle(stats: CountCategoryStats): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(stats.category),
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

function showPreviousRange(): void {
  statsReferenceDate.value = shiftDate(statsReferenceDate.value, countInterval.value, -periodCount.value)
}

function showNextRange(): void {
  statsReferenceDate.value = shiftDate(statsReferenceDate.value, countInterval.value, periodCount.value)
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
      <p>{{ selectedCat?.name ?? '目前寵物' }} · 次數趨勢</p>
    </header>

    <section class="stats-section" aria-labelledby="count-stats-title">
      <div class="stats-section__header">
        <h2 id="count-stats-title">次數追蹤</h2>
        <span>{{ countStats.length }} 個分類</span>
      </div>

      <div class="stats-controls">
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

      <div class="range-controls" aria-label="統計日期區間">
        <button
          class="ui-button ui-button--icon range-button"
          type="button"
          @click="showPreviousRange"
        >
          ‹
        </button>
        <strong>{{ rangeTitle }}</strong>
        <button
          class="ui-button ui-button--icon range-button"
          type="button"
          @click="showNextRange"
        >
          ›
        </button>
      </div>

      <div v-if="selectedCountStats" class="count-stats-list">
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

          <div class="count-bars" aria-label="近期趨勢" :style="getCountBarsStyle(selectedCountStats)">
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

      <p v-else class="empty-state">最近還沒有可統計的次數紀錄。</p>
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
</style>
