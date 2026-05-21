<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getCatAvatarOption } from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'

const catTrackerStore = useCatTrackerStore()
const { calendarDays, cats, monthTitle, selectedCat, selectedCatId, visibleMonth } =
  storeToRefs(catTrackerStore)
const isCatMenuOpen = ref(false)
const isMonthPickerOpen = ref(false)
const pickerYear = ref(visibleMonth.value.getFullYear())

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: new Intl.DateTimeFormat('zh-TW', { month: 'long' }).format(new Date(2024, index, 1)),
}))
const visibleMonthIndex = computed(() => visibleMonth.value.getMonth())

function toggleCatMenu(): void {
  isCatMenuOpen.value = !isCatMenuOpen.value
}

function selectCat(catId: string): void {
  catTrackerStore.selectCat(catId)
  isCatMenuOpen.value = false
}

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
</script>

<template>
  <section class="calendar-section" aria-labelledby="calendar-title">
    <div class="calendar-section__top">
      <div class="cat-switcher">
        <button
          class="selected-cat"
          type="button"
          :aria-expanded="isCatMenuOpen"
          aria-haspopup="listbox"
          @click="toggleCatMenu"
        >
          <span class="selected-cat__avatar selected-cat__avatar--plain" aria-hidden="true">
            <img
              :src="getCatAvatarOption(selectedCat?.avatarId).image"
              :alt="getCatAvatarOption(selectedCat?.avatarId).label"
            />
          </span>
          <strong class="cat-name">{{ selectedCat?.name ?? '我的貓' }}</strong>
          <span v-if="selectedCat?.isArchived" class="archived-badge">已停用</span>
          <span class="cat-switcher__chevron" aria-hidden="true">⌄</span>
        </button>

        <div v-if="isCatMenuOpen" class="cat-menu" role="listbox" aria-label="選擇寵物">
          <button
            v-for="cat in cats"
            :key="cat.id"
            class="cat-menu__item"
            :class="{
              'cat-menu__item--archived': cat.isArchived,
              'cat-menu__item--selected': selectedCatId === cat.id,
            }"
            type="button"
            role="option"
            :aria-selected="selectedCatId === cat.id"
            @click="selectCat(cat.id)"
          >
            <span class="selected-cat__avatar" aria-hidden="true">
              <img
                :src="getCatAvatarOption(cat.avatarId).image"
                :alt="getCatAvatarOption(cat.avatarId).label"
              />
            </span>
            <span>
              {{ cat.name }}
              <small v-if="cat.isArchived">已停用</small>
            </span>
            <span class="cat-menu__check" aria-hidden="true">{{
              selectedCatId === cat.id ? '✓' : ''
            }}</span>
          </button>
        </div>
      </div>
      <button
        class="ui-button ui-button--secondary today-button"
        type="button"
        @click="catTrackerStore.selectCalendarDate(new Date())"
      >
        今天
      </button>
    </div>

    <div class="calendar-header">
      <button
        class="ui-button ui-button--icon month-button"
        type="button"
        aria-label="上一個月"
        @click="catTrackerStore.showPreviousMonth"
      >
        ‹
      </button>
      <div class="month-picker">
        <h1 id="calendar-title" class="month-title">
          <button
            class="month-title-button"
            type="button"
            :aria-expanded="isMonthPickerOpen"
            aria-haspopup="dialog"
            @click="toggleMonthPicker"
          >
            <span>{{ monthTitle }}</span>
            <span class="month-title-button__chevron" aria-hidden="true">⌄</span>
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

    <div class="weekday-grid" aria-hidden="true">
      <span v-for="weekDay in weekDays" :key="weekDay">{{ weekDay }}</span>
    </div>

    <div class="calendar-grid" aria-label="月份日期">
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.cat-switcher {
  position: relative;
  min-width: 0;
}

.selected-cat {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.selected-cat:hover .cat-name {
  color: var(--color-primary-dark);
}

.selected-cat__avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 2px;
  background: var(--color-background);
}

.selected-cat__avatar--plain {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.selected-cat__avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cat-name {
  min-width: 0;
  overflow: hidden;
  font-size: 1.125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-switcher__chevron {
  color: var(--color-muted);
  font-size: 0.875rem;
  line-height: 1;
}

.archived-badge {
  flex: 0 0 auto;
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.cat-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 5;
  display: grid;
  min-width: 190px;
  max-width: min(280px, calc(100vw - 28px));
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.cat-menu__item {
  display: grid;
  grid-template-columns: 30px 1fr 18px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 6px 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.cat-menu__item:hover,
.cat-menu__item--selected {
  border-color: var(--color-border);
  background: var(--color-primary-light);
}

.cat-menu__item--archived {
  color: var(--color-muted);
}

.cat-menu__item--archived .selected-cat__avatar {
  opacity: 0.58;
}

.cat-menu__item span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-menu__item small {
  margin-left: 4px;
  color: var(--color-muted);
  font-size: 0.75rem;
}

.cat-menu__check {
  color: var(--color-primary);
  font-weight: 900;
  text-align: center;
}

.today-button {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 10px;
  font-size: 0.875rem;
}

.calendar-header {
  margin-top: 12px;
}

.month-picker {
  position: relative;
  min-width: 0;
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
  font-size: 1.35rem;
  line-height: 1;
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
