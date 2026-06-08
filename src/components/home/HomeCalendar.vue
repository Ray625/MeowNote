<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import CatSwitcher from '@/components/common/CatSwitcher.vue'
import TodayButton from '@/components/common/TodayButton.vue'
import EventFilterPopover from '@/components/home/EventFilterPopover.vue'
import { useClickOutside } from '@/composables/useClickOutside'
import { useCatTrackerStore } from '@/stores/catTracker'

const catTrackerStore = useCatTrackerStore()
const {
  calendarDays,
  calendarDisplayMode,
  eventFilterCategoryIds,
  eventSearchQuery,
  groupedEventFilterCategories,
  hasEventCategoryFilter,
  isEventFilterOpen,
  isEventSearchOpen,
  monthTitle,
  visibleMonth,
} = storeToRefs(catTrackerStore)
const isMonthPickerOpen = ref(false)
const isToolMenuOpen = ref(false)
const monthPickerRef = ref<HTMLElement>()
const toolMenuRef = ref<HTMLElement>()
const filterPopoverRef = ref<HTMLElement>()
const pickerYear = ref(visibleMonth.value.getFullYear())

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: new Intl.DateTimeFormat('zh-TW', { month: 'long' }).format(new Date(2024, index, 1)),
}))
const visibleMonthIndex = computed(() => visibleMonth.value.getMonth())
const activeFilterCount = computed(() => eventFilterCategoryIds.value.length)
const activeFilterCategories = computed(() =>
  groupedEventFilterCategories.value.flatMap((group) =>
    group.categories.filter((category) => eventFilterCategoryIds.value.includes(category.id)),
  ),
)

useClickOutside(monthPickerRef, () => {
  isMonthPickerOpen.value = false
})

useClickOutside(toolMenuRef, () => {
  isToolMenuOpen.value = false
})

useClickOutside(filterPopoverRef, (event) => {
  const eventTarget = event.target

  if (
    eventTarget instanceof Element &&
    eventTarget.closest('[data-event-filter-trigger="true"]')
  ) {
    return
  }

  catTrackerStore.closeEventFilter()
})

function syncMonthPicker(): void {
  pickerYear.value = visibleMonth.value.getFullYear()
}

function toggleMonthPicker(): void {
  if (!isMonthPickerOpen.value) {
    syncMonthPicker()
  }

  isMonthPickerOpen.value = !isMonthPickerOpen.value
}

function changePickerYear(delta: number): void {
  pickerYear.value += delta
}

function selectMonth(monthIndex: number): void {
  catTrackerStore.setVisibleMonth(pickerYear.value, monthIndex)
  isMonthPickerOpen.value = false
}

function toggleToolMenu(): void {
  isToolMenuOpen.value = !isToolMenuOpen.value
}

function openSearchFromTools(): void {
  catTrackerStore.openEventSearch()
  isToolMenuOpen.value = false
}

function openFilterFromTools(): void {
  catTrackerStore.toggleEventFilter()
  isToolMenuOpen.value = false
}
</script>

<template>
  <section class="calendar-section" aria-labelledby="calendar-title">
    <div v-if="isEventSearchOpen" class="calendar-search-top">
      <div class="calendar-search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="calendar-search-field__icon">
          <path
            d="M10.8 4.2a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2Zm-8.4 6.6a8.4 8.4 0 1 1 15.1 5.1l4 4a.9.9 0 0 1-1.3 1.3l-4-4A8.4 8.4 0 0 1 2.4 10.8Z"
            fill="currentColor"
          />
        </svg>
        <input
          v-model="eventSearchQuery"
          class="calendar-search-field__input"
          type="search"
          placeholder="搜尋標題或備註"
          autocomplete="off"
        />
      </div>
      <button
        class="ui-button ui-button--icon calendar-search-filter"
        :class="{ 'calendar-search-filter--active': hasEventCategoryFilter }"
        type="button"
        :aria-expanded="isEventFilterOpen"
        aria-haspopup="dialog"
        aria-label="篩選搜尋結果"
        data-event-filter-trigger="true"
        @click="catTrackerStore.toggleEventFilter"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="calendar-search-filter__icon">
          <path
            :d="
              hasEventCategoryFilter
                ? 'M4.1 5.2c.2-.4.5-.6.9-.6h14c.4 0 .7.2.9.6.2.3.1.7-.1 1l-5.5 6.9v4.6c0 .3-.2.7-.5.8l-3 1.7a.9.9 0 0 1-1.3-.8v-6.3L4.2 6.2a.9.9 0 0 1-.1-1Z'
                : 'M4.1 5.2c.2-.4.5-.6.9-.6h14c.4 0 .7.2.9.6.2.3.1.7-.1 1l-5.5 6.9v4.6c0 .3-.2.7-.5.8l-3 1.7a.9.9 0 0 1-1.3-.8v-6.3L4.2 6.2a.9.9 0 0 1-.1-1Zm2.8 1.2 4.2 5.4c.1.2.2.4.2.6v5.5l1.2-.7v-4.8c0-.2.1-.4.2-.6l4.4-5.4H6.9Z'
            "
            fill="currentColor"
          />
        </svg>
        <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
      </button>
      <button
        class="calendar-search-cancel"
        type="button"
        @click="catTrackerStore.closeEventSearch"
      >
        取消
      </button>
    </div>

    <div v-if="isEventSearchOpen && hasEventCategoryFilter" class="search-filter-summary">
      <div class="search-filter-summary__content">
        <span>已套用篩選</span>
        <div class="search-filter-chips" aria-label="目前篩選分類">
          <span v-for="category in activeFilterCategories" :key="category.id">
            {{ category.name }}
          </span>
        </div>
      </div>
      <button type="button" @click="catTrackerStore.clearEventCategoryFilter">清除</button>
    </div>

    <div v-if="!isEventSearchOpen" class="calendar-section__top">
      <CatSwitcher />
      <div class="calendar-mode-tabs" role="tablist" aria-label="紀錄檢視模式">
        <button
          class="calendar-mode-tab"
          :class="{ 'calendar-mode-tab--active': calendarDisplayMode === 'calendar' }"
          type="button"
          role="tab"
          :aria-selected="calendarDisplayMode === 'calendar'"
          @click="catTrackerStore.setCalendarDisplayMode('calendar')"
        >
          月曆
        </button>
        <button
          class="calendar-mode-tab"
          :class="{ 'calendar-mode-tab--active': calendarDisplayMode === 'list' }"
          type="button"
          role="tab"
          :aria-selected="calendarDisplayMode === 'list'"
          @click="catTrackerStore.setCalendarDisplayMode('list')"
        >
          清單
        </button>
      </div>
      <div class="calendar-top-tools">
        <div ref="toolMenuRef" class="calendar-tool-menu">
          <button
            class="ui-button ui-button--icon search-button"
            :class="{ 'search-button--active': hasEventCategoryFilter }"
            type="button"
            :aria-expanded="isToolMenuOpen"
            aria-haspopup="menu"
            aria-label="搜尋與篩選"
            @click="toggleToolMenu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="search-button__icon">
              <path
                d="M4 6.2a.9.9 0 0 1 .9-.9h14.2a.9.9 0 1 1 0 1.8H4.9a.9.9 0 0 1-.9-.9Zm0 5.8a.9.9 0 0 1 .9-.9h14.2a.9.9 0 1 1 0 1.8H4.9A.9.9 0 0 1 4 12Zm0 5.8a.9.9 0 0 1 .9-.9h14.2a.9.9 0 1 1 0 1.8H4.9a.9.9 0 0 1-.9-.9Z"
                fill="currentColor"
              />
            </svg>
            <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
          </button>

          <div v-if="isToolMenuOpen" class="calendar-tool-menu__panel" role="menu">
            <button type="button" role="menuitem" @click="openSearchFromTools">
              <svg viewBox="0 0 24 24" aria-hidden="true" class="tool-menu-icon">
                <path
                  d="M10.8 4.2a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2Zm-8.4 6.6a8.4 8.4 0 1 1 15.1 5.1l4 4a.9.9 0 0 1-1.3 1.3l-4-4A8.4 8.4 0 0 1 2.4 10.8Z"
                  fill="currentColor"
                />
              </svg>
              <span>搜尋</span>
            </button>
            <button
              type="button"
              role="menuitem"
              data-event-filter-trigger="true"
              @click="openFilterFromTools"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" class="tool-menu-icon">
                <path
                  :d="
                    hasEventCategoryFilter
                      ? 'M4.1 5.2c.2-.4.5-.6.9-.6h14c.4 0 .7.2.9.6.2.3.1.7-.1 1l-5.5 6.9v4.6c0 .3-.2.7-.5.8l-3 1.7a.9.9 0 0 1-1.3-.8v-6.3L4.2 6.2a.9.9 0 0 1-.1-1Z'
                      : 'M4.1 5.2c.2-.4.5-.6.9-.6h14c.4 0 .7.2.9.6.2.3.1.7-.1 1l-5.5 6.9v4.6c0 .3-.2.7-.5.8l-3 1.7a.9.9 0 0 1-1.3-.8v-6.3L4.2 6.2a.9.9 0 0 1-.1-1Zm2.8 1.2 4.2 5.4c.1.2.2.4.2.6v5.5l1.2-.7v-4.8c0-.2.1-.4.2-.6l4.4-5.4H6.9Z'
                  "
                  fill="currentColor"
                />
              </svg>
              <span>篩選</span>
              <span
                v-if="hasEventCategoryFilter"
                class="tool-menu-clear"
                role="button"
                aria-label="清除篩選"
                tabindex="0"
                @click.stop="catTrackerStore.clearEventCategoryFilter"
                @keydown.enter.stop.prevent="catTrackerStore.clearEventCategoryFilter"
                @keydown.space.stop.prevent="catTrackerStore.clearEventCategoryFilter"
              >
                ×
              </span>
            </button>
          </div>
        </div>
        <TodayButton @click="catTrackerStore.selectCalendarDate(new Date())" />
      </div>
    </div>

    <div v-if="isEventFilterOpen" ref="filterPopoverRef">
      <EventFilterPopover />
    </div>

    <div v-if="!isEventSearchOpen" class="calendar-header">
      <button
        class="ui-button ui-button--icon month-button"
        type="button"
        aria-label="上一個月"
        @click="catTrackerStore.showPreviousMonth"
      >
        ‹
      </button>
      <div ref="monthPickerRef" class="month-picker">
        <h1 id="calendar-title" class="month-title">
          <button
            class="month-title-button"
            type="button"
            :aria-expanded="isMonthPickerOpen"
            aria-haspopup="dialog"
            @click="toggleMonthPicker"
          >
            <span>{{ monthTitle }}</span>
            <span class="month-title-button__chevron" aria-hidden="true">▾</span>
          </button>
        </h1>

        <div v-if="isMonthPickerOpen" class="month-picker-menu" role="dialog" aria-label="切換年月">
          <div class="month-picker-menu__year">
            <button
              class="ui-button ui-button--icon month-picker-menu__year-button"
              type="button"
              aria-label="上一年"
              @click="changePickerYear(-1)"
            >
              ‹
            </button>
            <strong>{{ pickerYear }}年</strong>
            <button
              class="ui-button ui-button--icon month-picker-menu__year-button"
              type="button"
              aria-label="下一年"
              @click="changePickerYear(1)"
            >
              ›
            </button>
          </div>

          <div class="month-picker-menu__months" aria-label="選擇月份">
            <button
              v-for="month in monthOptions"
              :key="month.index"
              class="month-picker-menu__month"
              :class="{
                'month-picker-menu__month--selected':
                  pickerYear === visibleMonth.getFullYear() && month.index === visibleMonthIndex,
              }"
              type="button"
              @click="selectMonth(month.index)"
            >
              {{ month.label }}
            </button>
          </div>
        </div>
      </div>
      <button
        class="ui-button ui-button--icon month-button"
        type="button"
        aria-label="下一個月"
        @click="catTrackerStore.showNextMonth"
      >
        ›
      </button>
    </div>

    <div
      v-if="!isEventSearchOpen && calendarDisplayMode === 'calendar'"
      class="weekday-grid"
      aria-hidden="true"
    >
      <span v-for="weekDay in weekDays" :key="weekDay">{{ weekDay }}</span>
    </div>

    <div
      v-if="!isEventSearchOpen && calendarDisplayMode === 'calendar'"
      class="calendar-grid"
      aria-label="月份日期"
    >
      <button
        v-for="day in calendarDays"
        :key="day.key"
        class="calendar-day"
        :class="{
          'calendar-day--muted': !day.isCurrentMonth,
          'calendar-day--selected': day.isSelected,
          'calendar-day--today': day.isToday,
        }"
        type="button"
        @click="catTrackerStore.selectCalendarDate(day.date)"
      >
        <span class="calendar-day__number">{{ day.dayNumber }}</span>
        <span v-if="day.eventCount > 0" class="calendar-day__marker">
          {{ day.eventCount }}
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.calendar-section {
  position: relative;
  width: var(--content-width);
  flex: 0 0 auto;
  box-sizing: border-box;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  margin: 0 auto;
  background: var(--color-surface);
}

.calendar-section__top,
.calendar-header {
  display: grid;
  align-items: center;
  gap: 14px;
}

.calendar-section__top {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  min-height: 36px;
}

.calendar-section__top :deep(.cat-switcher),
.calendar-section__top :deep(.selected-cat),
.calendar-section__top :deep(.today-button),
.calendar-mode-tabs,
.calendar-top-tools,
.calendar-tool-menu,
.search-button {
  height: 36px;
}

.calendar-section__top :deep(.today-button),
.calendar-mode-tab,
.search-button {
  display: grid;
  align-items: center;
}

.calendar-section__top :deep(.selected-cat) {
  display: flex;
  align-items: center;
}

.calendar-section__top :deep(.today-button),
.calendar-mode-tab,
.search-button {
  justify-content: center;
  line-height: 1;
}

.calendar-section__top :deep(.today-button),
.search-button {
  min-height: 0;
}

.calendar-header {
  grid-template-columns: 44px minmax(0, 1fr) 44px;
}

.calendar-mode-tabs {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 116px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.calendar-mode-tab {
  min-height: 0;
  border: 0;
  padding: 0 10px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 800;
}

.calendar-mode-tab--active {
  background: var(--color-primary);
  color: var(--color-text);
}

@media (hover: hover) and (pointer: fine) {
  .calendar-mode-tab:not(.calendar-mode-tab--active):hover {
    background: var(--color-primary-light);
    color: var(--color-text);
  }
}

.calendar-top-tools {
  display: flex;
  align-items: stretch;
  justify-self: end;
  gap: 6px;
}

.calendar-tool-menu {
  position: relative;
}

.calendar-tool-menu__panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 7;
  display: grid;
  width: 124px;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.calendar-tool-menu__panel button {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 24px;
  min-height: 38px;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 800;
  text-align: left;
}

.calendar-tool-menu__panel button > span {
  min-width: 0;
}

.calendar-tool-menu__panel button:hover {
  border-color: var(--color-border-strong);
  background: var(--color-primary-light);
}

.calendar-tool-menu__panel small {
  color: var(--color-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.tool-menu-clear {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 6px;
  color: var(--color-muted);
  font-size: 1rem;
  line-height: 1;
}

.tool-menu-clear:hover {
  background: var(--color-background);
  color: var(--color-text);
}

.tool-menu-icon {
  width: 16px;
  height: 16px;
  color: var(--color-muted);
}

.search-button {
  position: relative;
  justify-self: end;
  width: 36px;
  min-width: 36px;
  padding: 0;
}

.search-button--active {
  border-color: var(--color-primary);
}

.search-button__icon {
  display: block;
  width: 16px;
  height: 16px;
  margin: 0 auto;
}

.filter-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 999px;
  padding: 0 4px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 0.6875rem;
  font-weight: 900;
  line-height: 1;
}

.calendar-search-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px auto;
  align-items: center;
  gap: 8px;
}

.calendar-search-field {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  min-width: 0;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 6px 0 10px;
  background: var(--color-background);
}

.calendar-search-field__icon {
  width: 16px;
  height: 16px;
  color: var(--color-muted);
}

.calendar-search-field__input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
}

.calendar-search-filter {
  position: relative;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 0;
  padding: 0;
}

.calendar-search-filter--active {
  border-color: var(--color-primary);
}

.calendar-search-filter__icon {
  width: 16px;
  height: 16px;
  margin: 0 auto;
}

.calendar-search-cancel {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.search-filter-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-top: 8px;
  background: var(--color-background);
}

.search-filter-summary__content {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.search-filter-summary__content > span {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.search-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.search-filter-chips span {
  padding: 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 800;
}

.search-filter-summary button {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 900;
}

.calendar-header {
  margin-top: 12px;
}

.month-picker {
  position: relative;
  justify-self: center;
  min-width: 0;
  text-align: center;
}

.month-title-button {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
}

.month-title-button:hover {
  color: var(--color-primary-dark);
}

.month-title {
  margin: 0;
  font-size: 1.25rem;
}

.month-title-button__chevron {
  color: var(--color-muted);
  font-size: 0.875rem;
  line-height: 1;
}

.month-picker-menu {
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

.month-picker-menu__year {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.month-picker-menu__year-button {
  width: 36px;
  height: 36px;
  font-size: 1.25rem;
}

.month-picker-menu__months {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.month-picker-menu__month {
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

.month-picker-menu__month:hover,
.month-picker-menu__month--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.month-button {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  font-size: 1.35rem;
  line-height: 1;
}

.month-button:first-child {
  justify-self: start;
}

.month-button:last-child {
  justify-self: end;
}

.weekday-grid,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-grid {
  gap: 6px;
  margin-top: 12px;
  color: var(--color-muted);
  font-size: 0.8125rem;
  text-align: center;
}

.calendar-grid {
  grid-template-rows: repeat(6, minmax(0, 1fr));
  aspect-ratio: 6 / 5.4;
  border: 0.5px solid var(--color-border);
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
}

.calendar-day {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: center;
  border: 0;
  border-right: 0.5px solid var(--color-border);
  border-bottom: 0.5px solid var(--color-border);
  border-radius: 0;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
}

.calendar-day:hover {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
}

.calendar-day--muted {
  color: var(--color-muted);
}

.calendar-day--today {
  box-shadow: inset 0 0 0 1px var(--color-focus);
}

.calendar-day--selected {
  background: var(--color-primary-light);
  box-shadow: inset 0 0 0 1px var(--color-primary);
  color: var(--color-text);
}

.calendar-day__marker {
  position: absolute;
  right: 5px;
  bottom: 4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 0.625rem;
  line-height: 14px;
}

.calendar-day:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

@media (max-width: 560px) {
  .calendar-section {
    padding: 10px;
  }

  .calendar-header {
    margin-top: 10px;
  }
}
</style>
