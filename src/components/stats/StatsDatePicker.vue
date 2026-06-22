<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'
import {
  formatStatsOverviewDateInput,
  parseStatsOverviewDateInput,
} from '@/services/statsOverviewRange'

const props = defineProps<{
  title: string
  modelValue: string
  maxDate: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const pickerRef = ref<HTMLElement>()
const isOpen = ref(false)
const viewYear = ref(0)
const viewMonth = ref(0)
const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const selectedDate = computed(() => parseStatsOverviewDateInput(props.modelValue))
const maxDate = computed(() => parseStatsOverviewDateInput(props.maxDate))
const monthTitle = computed(() => `${viewYear.value}年${viewMonth.value + 1}月`)
const calendarDays = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1)
  const leadingBlankCount = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()

  return [
    ...Array.from({ length: leadingBlankCount }, (_, index) => ({
      key: `blank-${index}`,
      date: null,
      label: '',
    })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(viewYear.value, viewMonth.value, index + 1)

      return {
        key: formatStatsOverviewDateInput(date),
        date,
        label: String(index + 1),
      }
    }),
  ]
})
const canShowNextMonth = computed(() => {
  if (!maxDate.value) {
    return true
  }

  return new Date(viewYear.value, viewMonth.value + 1, 1) <= maxDate.value
})

useClickOutside(pickerRef, () => {
  isOpen.value = false
})

watch(
  () => props.modelValue,
  () => {
    if (!isOpen.value) {
      syncViewMonth()
    }
  },
  { immediate: true },
)

function toggle(): void {
  if (!isOpen.value) {
    syncViewMonth()
  }

  isOpen.value = !isOpen.value
}

function syncViewMonth(): void {
  const date = selectedDate.value ?? maxDate.value ?? new Date()

  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
}

function changeMonth(delta: -1 | 1): void {
  if (delta > 0 && !canShowNextMonth.value) {
    return
  }

  const next = new Date(viewYear.value, viewMonth.value + delta, 1)

  viewYear.value = next.getFullYear()
  viewMonth.value = next.getMonth()
}

function selectDate(date: Date | null): void {
  if (!date || isFutureDate(date)) {
    return
  }

  emit('update:modelValue', formatStatsOverviewDateInput(date))
  isOpen.value = false
}

function isSelected(date: Date | null): boolean {
  return Boolean(
    date &&
      selectedDate.value &&
      formatStatsOverviewDateInput(date) === formatStatsOverviewDateInput(selectedDate.value),
  )
}

function isToday(date: Date | null): boolean {
  return Boolean(
    date && formatStatsOverviewDateInput(date) === formatStatsOverviewDateInput(new Date()),
  )
}

function isFutureDate(date: Date): boolean {
  return Boolean(maxDate.value && date > maxDate.value)
}
</script>

<template>
  <div ref="pickerRef" class="stats-date-picker">
    <button
      class="stats-date-picker__trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span>{{ title }}</span>
      <span class="stats-date-picker__chevron" aria-hidden="true">▾</span>
    </button>

    <div
      v-if="isOpen"
      class="stats-date-picker__menu"
      role="dialog"
      aria-label="選擇區間結束日期"
    >
      <div class="stats-date-picker__month-nav">
        <button type="button" aria-label="上一個月" @click="changeMonth(-1)">‹</button>
        <strong>{{ monthTitle }}</strong>
        <button
          type="button"
          aria-label="下一個月"
          :disabled="!canShowNextMonth"
          @click="changeMonth(1)"
        >
          ›
        </button>
      </div>

      <div class="stats-date-picker__weekdays" aria-hidden="true">
        <span v-for="weekDay in weekDays" :key="weekDay">{{ weekDay }}</span>
      </div>

      <div class="stats-date-picker__days">
        <button
          v-for="day in calendarDays"
          :key="day.key"
          type="button"
          :class="{
            'stats-date-picker__day--blank': !day.date,
            'stats-date-picker__day--selected': isSelected(day.date),
            'stats-date-picker__day--today': isToday(day.date),
          }"
          :disabled="!day.date || (day.date ? isFutureDate(day.date) : true)"
          @click="selectDate(day.date)"
        >
          {{ day.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-date-picker {
  position: relative;
  min-width: 0;
}

.stats-date-picker__trigger {
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

.stats-date-picker__trigger span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-date-picker__chevron {
  color: var(--color-muted);
  font-size: 0.75rem;
}

.stats-date-picker__menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 30;
  display: grid;
  width: min(320px, calc(100vw - 32px));
  gap: 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
  transform: translateX(-50%);
}

.stats-date-picker__month-nav {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 38px;
  align-items: center;
  gap: 8px;
}

.stats-date-picker__month-nav strong {
  text-align: center;
}

.stats-date-picker__month-nav button {
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 1.25rem;
  font-weight: 800;
}

.stats-date-picker__weekdays,
.stats-date-picker__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.stats-date-picker__weekdays span {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
  text-align: center;
}

.stats-date-picker__days button {
  aspect-ratio: 1;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
}

.stats-date-picker__days button:disabled {
  color: var(--color-disabled-text);
  cursor: default;
}

.stats-date-picker__days .stats-date-picker__day--blank {
  visibility: hidden;
}

.stats-date-picker__days .stats-date-picker__day--today {
  border-color: var(--color-primary);
}

.stats-date-picker__days .stats-date-picker__day--selected {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

@media (hover: hover) and (pointer: fine) {
  .stats-date-picker__month-nav button:not(:disabled):hover,
  .stats-date-picker__days button:not(:disabled):hover {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
    color: var(--color-text);
  }

  .stats-date-picker__days .stats-date-picker__day--selected:hover {
    background: var(--color-primary);
    color: var(--color-on-primary);
  }
}
</style>
