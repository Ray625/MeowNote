<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCatTrackerStore } from '@/stores/catTracker'

const catTrackerStore = useCatTrackerStore()
const { calendarDays, monthTitle, selectedCat } = storeToRefs(catTrackerStore)

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <section class="calendar-section" aria-labelledby="calendar-title">
    <div class="calendar-section__top">
      <strong class="cat-name">{{ selectedCat?.name ?? '我的貓' }}</strong>
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
      <h1 id="calendar-title" class="month-title">{{ monthTitle }}</h1>
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

.cat-name {
  min-width: 0;
  overflow: hidden;
  font-size: 1.125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.month-title {
  margin: 0;
  font-size: 1.25rem;
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
  color: var(--color-surface);
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
