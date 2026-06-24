import { ref } from 'vue'
import { defineStore } from 'pinia'
import { addMonths, startOfDay, startOfMonth } from '@/domain/catTracker/date'

export type MainTab = 'notebook' | 'calendar' | 'stats' | 'settings'
export type CalendarDisplayMode = 'calendar' | 'list'

export const useCalendarViewStore = defineStore('calendarView', () => {
  const today = new Date()

  const activeTab = ref<MainTab>('calendar')
  const calendarDisplayMode = ref<CalendarDisplayMode>('calendar')
  const isEventSearchOpen = ref(false)
  const eventSearchQuery = ref('')
  const isEventFilterOpen = ref(false)
  const eventFilterCategoryIds = ref<string[]>([])
  const selectedDate = ref(startOfDay(today))
  const visibleMonth = ref(startOfMonth(today))
  const isQuickRecordOpen = ref(false)

  function selectDate(date: Date): void {
    selectedDate.value = startOfDay(date)

    if (date.getMonth() !== visibleMonth.value.getMonth()) {
      visibleMonth.value = startOfMonth(date)
    }
  }

  function showPreviousMonth(): void {
    visibleMonth.value = addMonths(visibleMonth.value, -1)
  }

  function showNextMonth(): void {
    visibleMonth.value = addMonths(visibleMonth.value, 1)
  }

  function setVisibleMonth(year: number, monthIndex: number): void {
    visibleMonth.value = startOfMonth(new Date(year, monthIndex, 1))
  }

  function toggleQuickRecord(): void {
    isQuickRecordOpen.value = !isQuickRecordOpen.value
  }

  function closeQuickRecord(): void {
    isQuickRecordOpen.value = false
  }

  function setActiveTab(tab: MainTab): void {
    activeTab.value = tab
    closeQuickRecord()
  }

  function setCalendarDisplayMode(mode: CalendarDisplayMode): void {
    calendarDisplayMode.value = mode
    closeQuickRecord()
  }

  function toggleEventSearch(): void {
    isEventSearchOpen.value = !isEventSearchOpen.value

    if (isEventSearchOpen.value) {
      isEventFilterOpen.value = false
    }

    if (!isEventSearchOpen.value) {
      eventSearchQuery.value = ''
    }
  }

  function openEventSearch(): void {
    isEventSearchOpen.value = true
    isEventFilterOpen.value = false
  }

  function closeEventSearch(): void {
    isEventSearchOpen.value = false
    isEventFilterOpen.value = false
    eventSearchQuery.value = ''
  }

  function toggleEventFilter(): void {
    isEventFilterOpen.value = !isEventFilterOpen.value
  }

  function closeEventFilter(): void {
    isEventFilterOpen.value = false
  }

  function toggleEventFilterCategory(categoryId: string): void {
    eventFilterCategoryIds.value = eventFilterCategoryIds.value.includes(categoryId)
      ? eventFilterCategoryIds.value.filter((id) => id !== categoryId)
      : [...eventFilterCategoryIds.value, categoryId]
  }

  function clearEventCategoryFilter(): void {
    eventFilterCategoryIds.value = []
  }

  return {
    activeTab,
    calendarDisplayMode,
    isEventSearchOpen,
    eventSearchQuery,
    isEventFilterOpen,
    eventFilterCategoryIds,
    selectedDate,
    visibleMonth,
    isQuickRecordOpen,
    selectDate,
    showPreviousMonth,
    showNextMonth,
    setVisibleMonth,
    toggleQuickRecord,
    closeQuickRecord,
    setActiveTab,
    setCalendarDisplayMode,
    toggleEventSearch,
    openEventSearch,
    closeEventSearch,
    toggleEventFilter,
    closeEventFilter,
    toggleEventFilterCategory,
    clearEventCategoryFilter,
  }
})
