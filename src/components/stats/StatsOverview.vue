<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import CatSwitcher from '@/components/common/CatSwitcher.vue'
import FixedModal from '@/components/common/FixedModal.vue'
import TodayButton from '@/components/common/TodayButton.vue'
import StatsDatePicker from '@/components/stats/StatsDatePicker.vue'
import { getCategoryColorValue } from '@/constants/defaultData'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useClickOutside } from '@/composables/useClickOutside'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import {
  loadStatsPreference,
  loadSyncedStatsPreference,
  saveSyncedStatsPreference,
} from '@/repositories/statsPreferenceRepository'
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
import {
  formatRatingScore,
  formatSummaryAmount,
  formatSummaryDate,
  getCountOverviewSummary,
  getCurrentCountLabel,
  getCurrentMeasurementLabel,
  getCurrentRatingLabel,
  getCurrentSumLabel,
  getMeasurementOverviewSummary,
  getPreviousMeasurementLabel,
  getPreviousPeriodLabel,
  getRatingOverviewSummary,
  getSumOverviewSummary,
  type CountOverviewSummary,
  type MeasurementOverviewSummary,
  type RatingOverviewSummary,
  type SumOverviewSummary,
} from '@/services/statsOverviewSummary'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

const props = defineProps<{
  initialRangeMode?: StatsOverviewRangeMode
  initialReferenceDate?: string
  initialCustomStartDate?: string
  initialCustomEndDate?: string
}>()

const emit = defineEmits<{
  openCategory: [
    selection: {
      categoryId: string
      categoryIds: string[]
      rangeMode: StatsOverviewRangeMode
      referenceDate: string
      customStartDate?: string
      customEndDate?: string
    },
  ]
}>()

const catTrackerStore = useCatTrackerStore()
const { categories, events, selectedCatId } = storeToRefs(catTrackerStore)
const { activeNotebookId, user } = useRemoteAuth()
const selectedCategoryIds = ref<string[]>([])
const draftCategoryIds = ref<string[]>([])
const isManagerOpen = ref(false)
const draggingCategoryId = ref<string>()
const dragTargetCategoryId = ref<string>()
const dragTargetPosition = ref<'before' | 'after'>('before')
const comparisonHelpRef = ref<HTMLElement>()
const isComparisonHelpOpen = ref(false)
const shouldSuppressCardClick = ref(false)
let activeDragPointerId: number | undefined
let cardClickSuppressTimer: ReturnType<typeof window.setTimeout> | undefined
const rangeMode = ref<StatsOverviewRangeMode>(props.initialRangeMode ?? '7d')
const statsReferenceDate = ref(
  props.initialReferenceDate
    ? (parseStatsOverviewDateInput(props.initialReferenceDate) ?? new Date())
    : new Date(),
)
const customStartDate = ref(
  props.initialCustomStartDate
    ? (parseStatsOverviewDateInput(props.initialCustomStartDate) ?? addLocalDays(new Date(), -6))
    : addLocalDays(new Date(), -6),
)
const customEndDate = ref(
  props.initialCustomEndDate
    ? (parseStatsOverviewDateInput(props.initialCustomEndDate) ?? new Date())
    : new Date(),
)

const preferenceScopeKey = computed(
  () => `${user.value?.id ?? 'guest'}:${activeNotebookId.value || 'local'}`,
)
const recordedCategoryIds = computed(
  () =>
    new Set(
      events.value
        .filter((event) => event.catId === selectedCatId.value)
        .map((event) => event.categoryId),
    ),
)
const availableCategories = computed(() =>
  categories.value
    .filter((category) => recordedCategoryIds.value.has(category.id))
    .sort((left, right) => left.sortOrder - right.sortOrder),
)
const availableCategoryIdSet = computed(
  () => new Set(availableCategories.value.map((category) => category.id)),
)
const manageableCategories = computed(() => {
  const categoryIds = new Set([
    ...availableCategories.value.map((category) => category.id),
    ...selectedCategoryIds.value,
  ])

  return categories.value
    .filter((category) => categoryIds.has(category.id))
    .sort((left, right) => left.sortOrder - right.sortOrder)
})
const selectedCategories = computed(() =>
  selectedCategoryIds.value
    .map((categoryId) => categories.value.find((category) => category.id === categoryId))
    .filter((category): category is EventCategory => Boolean(category)),
)
const shouldShowSetup = computed(
  () => selectedCategories.value.length === 0 && availableCategories.value.length > 0,
)
const groupedAvailableCategories = computed(() => {
  const groups = new Map<string, EventCategory[]>()

  for (const category of manageableCategories.value) {
    const group = category.group ?? '其他'

    groups.set(group, [...(groups.get(group) ?? []), category])
  }

  return Array.from(groups.entries()).map(([group, groupCategories]) => ({
    group,
    categories: groupCategories,
  }))
})
const currentRange = computed(() =>
  getStatsOverviewRange(rangeMode.value, statsReferenceDate.value, {
    startDate: customStartDate.value,
    endDate: customEndDate.value,
  }),
)
const previousRange = computed(() =>
  getPreviousStatsOverviewRange(rangeMode.value, currentRange.value),
)
const rangeTitle = computed(() =>
  formatStatsOverviewRangeTitle(rangeMode.value, currentRange.value),
)
const canShowNextRange = computed(() => {
  if (rangeMode.value === 'custom') {
    const nextRange = shiftStatsOverviewCustomRange(currentRange.value, 1)

    return nextRange.end <= startOfLocalDay(new Date())
  }

  const nextReferenceDate = shiftStatsOverviewReferenceDate(
    rangeMode.value,
    statsReferenceDate.value,
    1,
  )

  return nextReferenceDate <= startOfLocalDay(new Date())
})
const countSummariesByCategoryId = computed(
  () =>
    new Map(
      selectedCategories.value
        .filter((category) => category.statisticsMode === 'count')
        .map((category) => [
          category.id,
          getCountOverviewSummary({
            category,
            events: events.value,
            catId: selectedCatId.value,
            currentRange: currentRange.value,
            previousRange: previousRange.value,
          }),
        ]),
    ),
)
const sumSummariesByCategoryId = computed(
  () =>
    new Map(
      selectedCategories.value
        .filter((category) => category.statisticsMode === 'sum')
        .map((category) => [
          category.id,
          getSumOverviewSummary({
            category,
            events: events.value,
            catId: selectedCatId.value,
            rangeMode: rangeMode.value,
            currentRange: currentRange.value,
            previousRange: previousRange.value,
          }),
        ]),
    ),
)
const measurementSummariesByCategoryId = computed(
  () =>
    new Map(
      selectedCategories.value
        .filter((category) => category.statisticsMode === 'measurement')
        .map((category) => [
          category.id,
          getMeasurementOverviewSummary({
            category,
            events: events.value,
            catId: selectedCatId.value,
            currentRange: currentRange.value,
            previousRange: previousRange.value,
          }),
        ]),
    ),
)
const ratingSummariesByCategoryId = computed(
  () =>
    new Map(
      selectedCategories.value
        .filter((category) => category.statisticsMode === 'rating')
        .map((category) => [
          category.id,
          getRatingOverviewSummary({
            category,
            events: events.value,
            catId: selectedCatId.value,
            currentRange: currentRange.value,
            previousRange: previousRange.value,
          }),
        ]),
    ),
)

useBodyScrollLock(computed(() => isManagerOpen.value || shouldShowSetup.value))

useClickOutside(comparisonHelpRef, () => {
  isComparisonHelpOpen.value = false
})

watch(
  preferenceScopeKey,
  async (scopeKey, _previousScopeKey, onCleanup) => {
    let isCancelled = false

    onCleanup(() => {
      isCancelled = true
    })

    selectedCategoryIds.value = loadStatsPreference(scopeKey).categoryIds

    try {
      const preference = await loadSyncedStatsPreference({
        scopeKey,
        userId: user.value?.id,
        notebookId: activeNotebookId.value || undefined,
      })

      if (!isCancelled) {
        selectedCategoryIds.value = preference.categoryIds
        draftCategoryIds.value = shouldShowSetup.value ? [] : [...preference.categoryIds]
      }
    } catch (error) {
      console.error('同步統計頁偏好失敗', error)
    }
  },
  { immediate: true },
)

watch(
  availableCategoryIdSet,
  () => {
    draftCategoryIds.value = shouldShowSetup.value ? [] : [...selectedCategoryIds.value]
  },
  { immediate: true },
)

function getCategoryStyle(category: EventCategory): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(category),
  }
}

function getCountSummary(categoryId: string): CountOverviewSummary | undefined {
  return countSummariesByCategoryId.value.get(categoryId)
}

function getSumSummary(categoryId: string): SumOverviewSummary | undefined {
  return sumSummariesByCategoryId.value.get(categoryId)
}

function getMeasurementSummary(categoryId: string): MeasurementOverviewSummary | undefined {
  return measurementSummariesByCategoryId.value.get(categoryId)
}

function getRatingSummary(categoryId: string): RatingOverviewSummary | undefined {
  return ratingSummariesByCategoryId.value.get(categoryId)
}

function openManager(): void {
  draftCategoryIds.value = [...selectedCategoryIds.value]
  isManagerOpen.value = true
}

function closeManager(): void {
  isManagerOpen.value = false
}

function toggleDraftCategory(categoryId: string): void {
  draftCategoryIds.value = draftCategoryIds.value.includes(categoryId)
    ? draftCategoryIds.value.filter((id) => id !== categoryId)
    : [...draftCategoryIds.value, categoryId]
}

function saveManagedCategories(): void {
  selectedCategoryIds.value = draftCategoryIds.value.filter((categoryId) =>
    categories.value.some((category) => category.id === categoryId),
  )
  persistPreference()
  closeManager()
}

function persistPreference(): void {
  void saveSyncedStatsPreference({
    scopeKey: preferenceScopeKey.value,
    userId: user.value?.id,
    notebookId: activeNotebookId.value || undefined,
    preference: {
      categoryIds: selectedCategoryIds.value,
    },
  }).catch((error: unknown) => {
    console.error('儲存統計頁偏好失敗', error)
  })
}

function startDrag(categoryId: string, event: DragEvent): void {
  draggingCategoryId.value = categoryId
  dragTargetCategoryId.value = undefined

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', categoryId)
  }
}

function startPointerDrag(categoryId: string, event: PointerEvent): void {
  if (event.pointerType === 'mouse') {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  activeDragPointerId = event.pointerId
  draggingCategoryId.value = categoryId
  dragTargetCategoryId.value = undefined
  document.body.classList.add('stats-card-reordering')
  window.addEventListener('pointermove', movePointerDrag, { passive: false })
  window.addEventListener('pointerup', finishPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
}

function movePointerDrag(event: PointerEvent): void {
  if (event.pointerId !== activeDragPointerId || !draggingCategoryId.value) {
    return
  }

  event.preventDefault()

  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-stats-category-id]')
  const targetCategoryId = target?.dataset.statsCategoryId

  if (!target || !targetCategoryId || targetCategoryId === draggingCategoryId.value) {
    dragTargetCategoryId.value = undefined
  } else {
    const bounds = target.getBoundingClientRect()

    dragTargetCategoryId.value = targetCategoryId
    dragTargetPosition.value =
      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  }

  const scrollEdge = 72

  if (event.clientY < scrollEdge) {
    window.scrollBy({ top: -12 })
  } else if (event.clientY > window.innerHeight - scrollEdge) {
    window.scrollBy({ top: 12 })
  }
}

function finishPointerDrag(event: PointerEvent): void {
  if (event.pointerId !== activeDragPointerId) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  suppressNextCardClick()

  const targetCategoryId = dragTargetCategoryId.value

  if (targetCategoryId) {
    dropCategory(targetCategoryId)
  } else {
    clearDragState()
  }

  cleanupPointerDrag()
}

function cancelPointerDrag(event: PointerEvent): void {
  if (event.pointerId !== activeDragPointerId) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  suppressNextCardClick()
  clearDragState()
  cleanupPointerDrag()
}

function suppressNextCardClick(): void {
  shouldSuppressCardClick.value = true

  if (cardClickSuppressTimer) {
    window.clearTimeout(cardClickSuppressTimer)
  }

  cardClickSuppressTimer = window.setTimeout(() => {
    shouldSuppressCardClick.value = false
    cardClickSuppressTimer = undefined
  }, 300)
}

function cleanupPointerDrag(): void {
  activeDragPointerId = undefined
  document.body.classList.remove('stats-card-reordering')
  window.removeEventListener('pointermove', movePointerDrag)
  window.removeEventListener('pointerup', finishPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
}

function dragOverCategory(targetCategoryId: string, event: DragEvent): void {
  if (!draggingCategoryId.value || draggingCategoryId.value === targetCategoryId) {
    dragTargetCategoryId.value = undefined
    return
  }

  const target = event.currentTarget as HTMLElement
  const bounds = target.getBoundingClientRect()

  dragTargetCategoryId.value = targetCategoryId
  dragTargetPosition.value = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
}

function dropCategory(targetCategoryId: string): void {
  const sourceCategoryId = draggingCategoryId.value
  const position = dragTargetPosition.value

  if (!sourceCategoryId || sourceCategoryId === targetCategoryId) {
    clearDragState()
    return
  }

  const nextIds = selectedCategoryIds.value.filter((categoryId) => categoryId !== sourceCategoryId)
  const targetIndex = nextIds.indexOf(targetCategoryId)
  const insertIndex = Math.max(targetIndex + (position === 'after' ? 1 : 0), 0)

  nextIds.splice(insertIndex, 0, sourceCategoryId)
  selectedCategoryIds.value = nextIds
  persistPreference()
  clearDragState()
}

function clearDragState(): void {
  draggingCategoryId.value = undefined
  dragTargetCategoryId.value = undefined
}

onUnmounted(() => {
  cleanupPointerDrag()

  if (cardClickSuppressTimer) {
    window.clearTimeout(cardClickSuppressTimer)
  }
})

function selectRangeMode(mode: StatsOverviewRangeMode): void {
  rangeMode.value = mode
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

  statsReferenceDate.value = shiftStatsOverviewReferenceDate(
    rangeMode.value,
    statsReferenceDate.value,
    1,
  )
}

function showTodayRange(): void {
  statsReferenceDate.value = new Date()

  if (rangeMode.value === 'custom') {
    const dayCount =
      Math.round(
        (startOfLocalDay(customEndDate.value).getTime() -
          startOfLocalDay(customStartDate.value).getTime()) /
          86_400_000,
      ) + 1

    customEndDate.value = new Date()
    customStartDate.value = addLocalDays(customEndDate.value, -Math.max(dayCount - 1, 0))
  }
}

function selectReferenceDate(value: string): void {
  const selectedDate = parseStatsOverviewDateInput(value)

  if (!selectedDate || selectedDate > startOfLocalDay(new Date())) {
    return
  }

  statsReferenceDate.value = selectedDate
}

function selectCustomStartDate(value: string): void {
  const selectedDate = parseStatsOverviewDateInput(value)

  if (!selectedDate || selectedDate > startOfLocalDay(new Date())) {
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

  if (!selectedDate || selectedDate > startOfLocalDay(new Date())) {
    return
  }

  customEndDate.value = selectedDate

  if (customStartDate.value > selectedDate) {
    customStartDate.value = selectedDate
  }

  statsReferenceDate.value = selectedDate
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function openCategory(categoryId: string): void {
  emit('openCategory', {
    categoryId,
    categoryIds: [...selectedCategoryIds.value],
    rangeMode: rangeMode.value,
    referenceDate: formatStatsOverviewDateInput(statsReferenceDate.value),
    customStartDate: formatStatsOverviewDateInput(currentRange.value.start),
    customEndDate: formatStatsOverviewDateInput(currentRange.value.end),
  })
}

function openCategoryFromClick(categoryId: string, event: MouseEvent): void {
  if (shouldSuppressCardClick.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  openCategory(categoryId)
}
</script>

<template>
  <section class="stats-overview" aria-label="統計">
    <header class="stats-overview__header">
      <CatSwitcher />
      <div class="stats-overview__header-actions">
        <TodayButton @click="showTodayRange" />
        <button
          class="ui-button ui-button--primary stats-overview__manage"
          type="button"
          @click="openManager"
        >
          管理統計
        </button>
      </div>
    </header>

    <section v-if="selectedCategories.length > 0" class="stats-range-panel" aria-label="統計區間">
      <div class="stats-range-tabs" role="tablist" aria-label="時間區間">
        <button
          v-for="option in STATS_OVERVIEW_RANGE_OPTIONS"
          :key="option.value"
          class="stats-range-tab"
          :class="{ 'stats-range-tab--active': rangeMode === option.value }"
          type="button"
          role="tab"
          :aria-selected="rangeMode === option.value"
          @click="selectRangeMode(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="stats-range-controls">
        <button
          class="ui-button ui-button--icon stats-range-button"
          type="button"
          aria-label="上一個統計區間"
          @click="showPreviousRange"
        >
          ‹
        </button>

        <div v-if="rangeMode === 'custom'" class="stats-custom-range">
          <label>
            <span>開始</span>
            <input
              type="date"
              :value="formatStatsOverviewDateInput(currentRange.start)"
              :max="formatStatsOverviewDateInput(new Date())"
              @change="selectCustomStartDate(($event.target as HTMLInputElement).value)"
            />
          </label>
          <label>
            <span>結束</span>
            <input
              type="date"
              :value="formatStatsOverviewDateInput(currentRange.end)"
              :max="formatStatsOverviewDateInput(new Date())"
              @change="selectCustomEndDate(($event.target as HTMLInputElement).value)"
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
          class="ui-button ui-button--icon stats-range-button"
          type="button"
          aria-label="下一個統計區間"
          :disabled="!canShowNextRange"
          @click="showNextRange"
        >
          ›
        </button>
      </div>

      <div ref="comparisonHelpRef" class="stats-range-panel__comparison">
        <span>比較區間：{{ formatStatsOverviewRangeTitle(rangeMode, previousRange) }}</span>
        <button
          class="stats-comparison-help__button"
          type="button"
          aria-label="查看比較區間說明"
          :aria-expanded="isComparisonHelpOpen"
          @click="isComparisonHelpOpen = !isComparisonHelpOpen"
        >
          ?
        </button>
        <span
          class="stats-comparison-help__tooltip"
          :class="{ 'stats-comparison-help__tooltip--open': isComparisonHelpOpen }"
          role="tooltip"
        >
          與前一時段相比，觀察趨勢
        </span>
      </div>
    </section>

    <div v-if="selectedCategories.length > 0" class="stats-overview__cards">
      <article
        v-for="category in selectedCategories"
        :key="category.id"
        :data-stats-category-id="category.id"
        class="stats-overview-card"
        :class="{
          'stats-overview-card--dragging': draggingCategoryId === category.id,
          'stats-overview-card--drop-before':
            dragTargetCategoryId === category.id && dragTargetPosition === 'before',
          'stats-overview-card--drop-after':
            dragTargetCategoryId === category.id && dragTargetPosition === 'after',
        }"
        :style="getCategoryStyle(category)"
        @dragover.prevent="dragOverCategory(category.id, $event)"
        @dragend="clearDragState"
        @drop="dropCategory(category.id)"
      >
        <span
          class="stats-overview-card__drag-handle"
          draggable="true"
          aria-label="拖曳排序"
          title="拖曳排序"
          @dragstart="startDrag(category.id, $event)"
          @pointerdown="startPointerDrag(category.id, $event)"
        >
          ⋮⋮
        </span>
        <button
          class="stats-overview-card__main"
          type="button"
          @click="openCategoryFromClick(category.id, $event)"
        >
          <span class="stats-overview-card__content">
            <strong>{{ category.name }}</strong>
            <template v-if="category.statisticsMode === 'count' && getCountSummary(category.id)">
              <span
                v-if="getCountSummary(category.id)!.currentTotal > 0"
                class="stats-overview-card__primary"
              >
                {{ getCurrentCountLabel(rangeMode) }}
                <b>{{ getCountSummary(category.id)!.currentTotal }} 次</b>
              </span>
              <span v-else class="stats-overview-card__empty-period">此區間沒有紀錄</span>
              <small class="stats-overview-card__comparison">
                {{ getPreviousPeriodLabel(rangeMode) }}
                {{ getCountSummary(category.id)!.previousTotal }} 次
              </small>
            </template>
            <template v-else-if="category.statisticsMode === 'sum' && getSumSummary(category.id)">
              <span
                v-if="typeof getSumSummary(category.id)!.currentValue === 'number'"
                class="stats-overview-card__primary"
              >
                {{ getCurrentSumLabel(rangeMode) }}
                <b>
                  {{
                    formatSummaryAmount(
                      getSumSummary(category.id)!.currentValue!,
                      category,
                    )
                  }}
                </b>
              </span>
              <span v-else class="stats-overview-card__empty-period">此區間沒有紀錄</span>
              <small
                v-if="getSumSummary(category.id)!.currentCount > 0"
                class="stats-overview-card__record-days"
              >
                有紀錄 {{ getSumSummary(category.id)!.currentRecordedDays }} 天・共
                {{ getSumSummary(category.id)!.currentCount }} 筆
              </small>
              <small class="stats-overview-card__comparison">
                <template v-if="typeof getSumSummary(category.id)!.previousValue === 'number'">
                  {{ getPreviousPeriodLabel(rangeMode) }}
                  {{
                    formatSummaryAmount(
                      getSumSummary(category.id)!.previousValue!,
                      category,
                    )
                  }}
                </template>
                <template v-else>{{ getPreviousPeriodLabel(rangeMode) }}沒有紀錄</template>
              </small>
            </template>
            <template
              v-else-if="
                category.statisticsMode === 'measurement' &&
                getMeasurementSummary(category.id)
              "
            >
              <span
                v-if="typeof getMeasurementSummary(category.id)!.currentValue === 'number'"
                class="stats-overview-card__primary"
              >
                {{ getCurrentMeasurementLabel(rangeMode) }}
                <b>
                  {{
                    formatSummaryAmount(
                      getMeasurementSummary(category.id)!.currentValue!,
                      category,
                    )
                  }}
                </b>
                <span
                  v-if="
                    rangeMode !== 'day' &&
                    getMeasurementSummary(category.id)!.currentOccurredAt
                  "
                  class="stats-overview-card__date"
                >
                  （{{
                    formatSummaryDate(
                      getMeasurementSummary(category.id)!.currentOccurredAt!,
                    )
                  }}）
                </span>
              </span>
              <span v-else class="stats-overview-card__empty-period">此區間沒有紀錄</span>
              <small
                v-if="getMeasurementSummary(category.id)!.currentCount > 0"
                class="stats-overview-card__record-days"
              >
                有紀錄 {{ getMeasurementSummary(category.id)!.currentRecordedDays }} 天・共
                {{ getMeasurementSummary(category.id)!.currentCount }} 筆
              </small>
              <small class="stats-overview-card__comparison">
                <template
                  v-if="typeof getMeasurementSummary(category.id)!.previousValue === 'number'"
                >
                  {{ getPreviousMeasurementLabel(rangeMode) }}
                  {{
                    formatSummaryAmount(
                      getMeasurementSummary(category.id)!.previousValue!,
                      category,
                    )
                  }}
                </template>
                <template v-else>{{ getPreviousPeriodLabel(rangeMode) }}沒有紀錄</template>
              </small>
            </template>
            <template
              v-else-if="category.statisticsMode === 'rating' && getRatingSummary(category.id)"
            >
              <span
                v-if="typeof getRatingSummary(category.id)!.currentAverage === 'number'"
                class="stats-overview-card__primary"
              >
                {{ getCurrentRatingLabel(rangeMode) }}
                <b>
                  {{
                    formatRatingScore(
                      getRatingSummary(category.id)!.currentAverage!,
                      category,
                    )
                  }}
                </b>
              </span>
              <span v-else class="stats-overview-card__empty-period">此區間沒有紀錄</span>
              <small
                v-if="getRatingSummary(category.id)!.currentCount > 0"
                class="stats-overview-card__record-days"
              >
                有紀錄 {{ getRatingSummary(category.id)!.currentRecordedDays }} 天・共
                {{ getRatingSummary(category.id)!.currentCount }} 筆
              </small>
              <small class="stats-overview-card__comparison">
                <template
                  v-if="typeof getRatingSummary(category.id)!.previousAverage === 'number'"
                >
                  {{ getPreviousPeriodLabel(rangeMode) }}
                  {{
                    formatRatingScore(
                      getRatingSummary(category.id)!.previousAverage!,
                      category,
                    )
                  }}
                </template>
                <template v-else>{{ getPreviousPeriodLabel(rangeMode) }}沒有紀錄</template>
              </small>
            </template>
            <small v-else>統計摘要將在下一階段接上</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </article>
    </div>

    <p v-else-if="availableCategories.length === 0" class="stats-overview__empty">
      目前還沒有可統計的紀錄。
    </p>

    <FixedModal
      v-if="isManagerOpen || shouldShowSetup"
      labelledby="stats-manager-title"
      :close-on-backdrop="!shouldShowSetup"
      @close="shouldShowSetup ? undefined : closeManager()"
    >
      <template #header>
        <h2 id="stats-manager-title">
          {{ shouldShowSetup ? '選擇統計項目' : '管理統計項目' }}
        </h2>
        <button
          v-if="!shouldShowSetup"
          class="stats-manager__close"
          type="button"
          aria-label="關閉管理統計項目"
          @click="closeManager"
        >
          ×
        </button>
      </template>

      <template #body>
        <p class="stats-manager__hint">只會列出目前寵物實際有紀錄的分類。</p>
        <section
          v-for="group in groupedAvailableCategories"
          :key="group.group"
          class="stats-manager__group"
        >
          <h3>{{ group.group }}</h3>
          <div class="stats-manager__options">
            <button
              v-for="category in group.categories"
              :key="category.id"
              class="stats-manager__option"
              :class="{ 'stats-manager__option--selected': draftCategoryIds.includes(category.id) }"
              :style="getCategoryStyle(category)"
              type="button"
              @click="toggleDraftCategory(category.id)"
            >
              <span class="stats-overview-card__dot" aria-hidden="true"></span>
              <span>{{ category.name }}</span>
            </button>
          </div>
        </section>
      </template>

      <template #footer>
        <button
          class="ui-button ui-button--primary stats-manager__save"
          type="button"
          :disabled="draftCategoryIds.length === 0"
          @click="saveManagedCategories"
        >
          完成
        </button>
      </template>
    </FixedModal>
  </section>
</template>

<style scoped>
.stats-overview {
  display: grid;
  width: var(--content-width);
  gap: 14px;
  margin: 0 auto;
}

.stats-overview__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
  background: var(--color-surface);
}

.stats-overview__manage {
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.875rem;
}

.stats-overview__header-actions {
  display: flex;
  justify-self: end;
  gap: 8px;
}

.stats-range-panel {
  display: grid;
  gap: 10px;
}

.stats-range-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(64px, 1fr));
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  scrollbar-width: none;
}

.stats-range-tabs::-webkit-scrollbar {
  display: none;
}

.stats-range-tab {
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

.stats-range-tab:last-child {
  border-right: 0;
}

.stats-range-tab--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.stats-range-controls {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 10px;
}

.stats-range-button {
  width: 42px;
  height: 42px;
  font-size: 1.5rem;
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
}

.stats-custom-range input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 42px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 800;
}

.stats-range-picker {
  position: relative;
  min-width: 0;
}

.stats-range-title {
  display: grid;
  width: 100%;
  min-height: 42px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.stats-range-title span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-range-title span:last-child {
  color: var(--color-muted);
  font-size: 0.75rem;
}

.stats-range-picker__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 15;
  display: grid;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.stats-range-picker__menu label {
  display: grid;
  gap: 6px;
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 800;
}

.stats-range-picker__menu input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--color-background);
  color: var(--color-text);
  font: inherit;
}

.stats-range-panel__comparison {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  color: var(--color-muted);
  font-size: 0.8125rem;
  text-align: center;
}

.stats-comparison-help__button {
  display: inline-grid;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0;
  background: var(--color-background);
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 900;
  line-height: 1;
}

.stats-comparison-help__button:hover,
.stats-comparison-help__button:focus-visible,
.stats-comparison-help__button[aria-expanded='true'] {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-text);
}

.stats-comparison-help__tooltip {
  position: absolute;
  top: calc(100% + 7px);
  left: 50%;
  z-index: 5;
  width: max-content;
  max-width: min(260px, calc(100vw - 48px));
  transform: translate(-50%, -4px);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 7px 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.8125rem;
  line-height: 1.4;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.stats-comparison-help__button:hover + .stats-comparison-help__tooltip,
.stats-comparison-help__button:focus-visible + .stats-comparison-help__tooltip,
.stats-comparison-help__tooltip--open {
  transform: translate(-50%, 0);
  opacity: 1;
}

.stats-overview__cards {
  display: grid;
  gap: 10px;
}

.stats-overview-card {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: stretch;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--category-color) 34%, var(--color-border));
  border-left: 5px solid var(--category-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--category-color) 6%, var(--color-surface));
}

.stats-overview-card--dragging {
  opacity: 0.55;
}

.stats-overview-card--drop-before,
.stats-overview-card--drop-after {
  overflow: visible;
}

.stats-overview-card--drop-before::before,
.stats-overview-card--drop-after::after {
  position: absolute;
  left: 8px;
  right: 8px;
  z-index: 1;
  height: 3px;
  border-radius: 999px;
  background: var(--color-primary);
  content: '';
}

.stats-overview-card--drop-before::before {
  top: -6px;
}

.stats-overview-card--drop-after::after {
  bottom: -6px;
}

.stats-overview-card__drag-handle {
  display: grid;
  place-items: center;
  color: var(--color-muted);
  cursor: grab;
  font-size: 0.875rem;
  letter-spacing: -0.18em;
  touch-action: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
}

.stats-overview-card__drag-handle:active {
  cursor: grabbing;
}

:global(body.stats-card-reordering) {
  user-select: none;
  -webkit-user-select: none;
}

.stats-overview-card__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  border: 0;
  padding: 14px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.stats-overview-card__content {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.stats-overview-card__content > strong {
  color: color-mix(in srgb, var(--category-color) 82%, var(--color-text));
}

.stats-overview-card__content > small,
.stats-manager__hint {
  color: var(--color-muted);
}

.stats-overview-card__primary {
  color: var(--color-text);
  font-size: 0.9375rem;
}

.stats-overview-card__primary b {
  margin-left: 4px;
  font-size: 1.05rem;
}

.stats-overview-card__date {
  color: var(--color-muted);
  font-size: 0.8125rem;
}

.stats-overview-card__empty-period {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.stats-overview-card__comparison {
  font-size: 0.8125rem;
}

.stats-overview-card__record-days {
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-weight: 500;
}

.stats-overview-card__dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--category-color);
}

.stats-manager__close {
  border: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.stats-overview__empty {
  margin: 0;
  padding: 32px 0;
  color: var(--color-muted);
  text-align: center;
}

.stats-manager__hint {
  margin: 0;
  font-size: 0.875rem;
}

.stats-manager__group {
  display: grid;
  gap: 8px;
}

.stats-manager__group h3 {
  margin: 0;
  font-size: 0.875rem;
}

.stats-manager__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stats-manager__option {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.stats-manager__option--selected {
  border-color: var(--category-color);
  background: color-mix(in srgb, var(--category-color) 12%, var(--color-surface));
}

.stats-manager__save {
  min-height: 44px;
}

@media (max-width: 560px) {
  .stats-overview__header :deep(.cat-switcher) {
    grid-column: 1;
  }

  .stats-overview__header-actions {
    grid-column: 2;
  }

  .stats-range-tabs {
    grid-template-columns: repeat(6, 72px);
  }

  .stats-overview-card {
    grid-template-columns: 32px minmax(0, 1fr);
  }

  .stats-overview-card__drag-handle {
    font-size: 1rem;
  }
}
</style>
