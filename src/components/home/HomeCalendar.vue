<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getCatAvatarOption } from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'

const catTrackerStore = useCatTrackerStore()
const { calendarDays, cats, monthTitle, selectedCat, selectedCatId } = storeToRefs(catTrackerStore)
const isCatMenuOpen = ref(false)

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

function toggleCatMenu(): void {
  isCatMenuOpen.value = !isCatMenuOpen.value
}

function selectCat(catId: string): void {
  catTrackerStore.selectCat(catId)
  isCatMenuOpen.value = false
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
          <span class="cat-switcher__chevron" aria-hidden="true">⌄</span>
        </button>

        <div v-if="isCatMenuOpen" class="cat-menu" role="listbox" aria-label="選擇寵物">
          <button
            v-for="cat in cats"
            :key="cat.id"
            class="cat-menu__item"
            :class="{ 'cat-menu__item--selected': selectedCatId === cat.id }"
            type="button"
            role="option"
            :aria-selected="selectedCatId === cat.id"
            @click="selectCat(cat.id)"
          >
            <span class="selected-cat__avatar" aria-hidden="true">
              <img :src="getCatAvatarOption(cat.avatarId).image" :alt="getCatAvatarOption(cat.avatarId).label" />
            </span>
            <span>{{ cat.name }}</span>
            <span class="cat-menu__check" aria-hidden="true">{{ selectedCatId === cat.id ? '✓' : '' }}</span>
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

.cat-menu__item span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
