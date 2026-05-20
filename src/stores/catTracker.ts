import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { CATEGORY_GROUP_ORDER } from '@/constants/defaultData'
import { catTrackerRepository, type CatTrackerState } from '@/repositories/catTrackerRepository'
import type {
  Cat,
  CatEvent,
  CreateCatEventInput,
  CreateCatInput,
  CreateCategoryInput,
  EventCategory,
  EventCategoryGroup,
  UpdateCatInput,
  UpdateCategoryInput,
  UpdateCatEventInput,
} from '@/types'
import { getIsoNow, isSameLocalDate } from '@/utils/datetime'
import { createId } from '@/utils/id'

type MainTab = 'calendar' | 'settings'

export interface CalendarDay {
  date: Date
  key: string
  dayNumber: number
  eventCount: number
  isCurrentMonth: boolean
  isSelected: boolean
  isToday: boolean
}

export interface EventListItem {
  event: CatEvent
  category?: EventCategory
  time: string
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
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

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatEventTime(dateTime: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateTime))
}

function sortCategories(categories: EventCategory[]): EventCategory[] {
  return [...categories].sort((a, b) => {
    const archivedOrder = Number(a.isArchived) - Number(b.isArchived)

    if (archivedOrder !== 0) {
      return archivedOrder
    }

    const sortOrder = a.sortOrder - b.sortOrder

    if (sortOrder !== 0) {
      return sortOrder
    }

    return a.createdAt.localeCompare(b.createdAt)
  })
}

export const useCatTrackerStore = defineStore('catTracker', () => {
  const initialState = catTrackerRepository.loadState()
  const today = new Date()

  const cats = ref<Cat[]>(initialState.cats)
  const categories = ref<EventCategory[]>(initialState.categories)
  const events = ref<CatEvent[]>(initialState.events)
  const selectedCatId = ref(initialState.selectedCatId)
  const activeTab = ref<MainTab>('calendar')
  const selectedDate = ref(startOfDay(today))
  const visibleMonth = ref(startOfMonth(today))
  const isQuickRecordOpen = ref(false)
  const editingEventId = ref<string>()
  const deleteConfirmEventId = ref<string>()

  const needsFirstTimeSetup = computed(() => cats.value.length === 0)
  const selectedCat = computed(() => cats.value.find((cat) => cat.id === selectedCatId.value))

  const quickActionCategories = computed(() =>
    sortCategories(
      categories.value.filter((category) => category.isQuickAction && !category.isArchived),
    ),
  )
  const activeCategories = computed(() =>
    sortCategories(categories.value.filter((category) => !category.isArchived)),
  )
  const categoriesByGroup = computed(() =>
    CATEGORY_GROUP_ORDER.map((group) => ({
      group,
      categories: sortCategories(categories.value.filter((category) => category.group === group)),
    })),
  )
  const archivedCategories = computed(() =>
    categories.value.filter((category) => category.isArchived),
  )
  const categoryUsageCounts = computed(() => {
    const usageCounts = new Map<string, number>()

    for (const event of events.value) {
      usageCounts.set(event.categoryId, (usageCounts.get(event.categoryId) ?? 0) + 1)
    }

    return usageCounts
  })

  const todayEvents = computed(() =>
    events.value
      .filter((event) => event.catId === selectedCatId.value)
      .filter((event) => isSameLocalDate(event.occurredAt))
      .sort((a, b) => {
        const occurredAtOrder = a.occurredAt.localeCompare(b.occurredAt)

        if (occurredAtOrder !== 0) {
          return occurredAtOrder
        }

        return a.createdAt.localeCompare(b.createdAt)
      }),
  )

  const eventsById = computed(() => new Map(events.value.map((event) => [event.id, event])))
  const categoriesById = computed(
    () => new Map(categories.value.map((category) => [category.id, category])),
  )
  const catsById = computed(() => new Map(cats.value.map((cat) => [cat.id, cat])))
  const monthTitle = computed(() =>
    new Intl.DateTimeFormat('zh-TW', {
      month: 'long',
      year: 'numeric',
    }).format(visibleMonth.value),
  )
  const selectedDateTitle = computed(() =>
    new Intl.DateTimeFormat('zh-TW', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(selectedDate.value),
  )
  const eventCountByDate = computed(() => {
    const counts = new Map<string, number>()

    for (const event of events.value) {
      if (event.catId !== selectedCatId.value) {
        continue
      }

      const key = toDateKey(new Date(event.occurredAt))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    return counts
  })
  const calendarDays = computed<CalendarDay[]>(() => {
    const firstDay = startOfMonth(visibleMonth.value)
    const calendarStart = addDays(firstDay, -firstDay.getDay())

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(calendarStart, index)
      const key = toDateKey(date)

      return {
        date,
        key,
        dayNumber: date.getDate(),
        eventCount: eventCountByDate.value.get(key) ?? 0,
        isCurrentMonth: date.getMonth() === visibleMonth.value.getMonth(),
        isSelected: isSameDate(date, selectedDate.value),
        isToday: isSameDate(date, today),
      }
    })
  })
  const selectedDateEvents = computed(() =>
    events.value
      .filter((event) => event.catId === selectedCatId.value)
      .filter((event) => isSameDate(new Date(event.occurredAt), selectedDate.value))
      .sort((a, b) => {
        const occurredAtOrder = a.occurredAt.localeCompare(b.occurredAt)

        if (occurredAtOrder !== 0) {
          return occurredAtOrder
        }

        return a.createdAt.localeCompare(b.createdAt)
      }),
  )
  const selectedDateEventListItems = computed<EventListItem[]>(() =>
    selectedDateEvents.value.map((event) => ({
      event,
      category: categoriesById.value.get(event.categoryId),
      time: formatEventTime(event.occurredAt),
    })),
  )
  const editingEvent = computed(() =>
    editingEventId.value ? eventsById.value.get(editingEventId.value) : undefined,
  )
  const editingCategory = computed(() =>
    editingEvent.value ? categoriesById.value.get(editingEvent.value.categoryId) : undefined,
  )
  const deleteConfirmEvent = computed(() =>
    deleteConfirmEventId.value ? eventsById.value.get(deleteConfirmEventId.value) : undefined,
  )

  watch(
    [cats, categories, events, selectedCatId],
    () => {
      catTrackerRepository.saveState({
        cats: cats.value,
        categories: categories.value,
        events: events.value,
        selectedCatId: selectedCatId.value,
      })
    },
    { deep: true, immediate: true },
  )

  function selectCat(catId: string): void {
    if (!catsById.value.has(catId)) {
      return
    }

    selectedCatId.value = catId
    isQuickRecordOpen.value = false
    editingEventId.value = undefined
    deleteConfirmEventId.value = undefined
  }

  function selectCalendarDate(date: Date): void {
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
    isQuickRecordOpen.value = false
  }

  function getQuickRecordOccurredAt(): string {
    const now = new Date()
    const occurredAt = new Date(selectedDate.value)

    occurredAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())

    return occurredAt.toISOString()
  }

  function quickRecordForSelectedDate(categoryId: string): CatEvent | undefined {
    const event = quickRecord(categoryId, getQuickRecordOccurredAt())

    if (!event) {
      return undefined
    }

    isQuickRecordOpen.value = false

    return event
  }

  function openEditEvent(eventId: string): void {
    if (!eventsById.value.has(eventId)) {
      return
    }

    editingEventId.value = eventId
  }

  function closeEditEvent(): void {
    editingEventId.value = undefined
    deleteConfirmEventId.value = undefined
  }

  function openDeleteConfirm(eventId: string): void {
    if (!eventsById.value.has(eventId)) {
      return
    }

    deleteConfirmEventId.value = eventId
  }

  function cancelDeleteEvent(): void {
    deleteConfirmEventId.value = undefined
  }

  function confirmDeleteEvent(): void {
    if (!deleteConfirmEvent.value) {
      return
    }

    const deletedEventId = deleteConfirmEvent.value.id

    deleteEvent(deletedEventId)
    deleteConfirmEventId.value = undefined

    if (editingEventId.value === deletedEventId) {
      closeEditEvent()
    }
  }

  function createCat(input: CreateCatInput): Cat {
    const now = getIsoNow()
    const cat: Cat = {
      id: createId('cat'),
      name: input.name,
      avatarId: input.avatarId,
      birthday: input.birthday,
      sex: input.sex,
      weightKg: input.weightKg,
      isNeutered: input.isNeutered,
      note: input.note,
      isArchived: input.isArchived ?? false,
      createdAt: now,
      updatedAt: now,
    }

    cats.value.push(cat)
    selectedCatId.value = cat.id

    return cat
  }

  function updateCat(catId: string, input: UpdateCatInput): Cat | undefined {
    const cat = catsById.value.get(catId)

    if (!cat) {
      return undefined
    }

    Object.assign(cat, {
      ...input,
      updatedAt: getIsoNow(),
    })

    return cat
  }

  function replacePersistedState(state: CatTrackerState): void {
    cats.value = state.cats
    categories.value = state.categories
    events.value = state.events
    selectedCatId.value = state.cats.some((cat) => cat.id === state.selectedCatId)
      ? state.selectedCatId
      : (state.cats.find((cat) => !cat.isArchived)?.id ?? state.cats[0]?.id ?? '')

    if (selectedCatId.value) {
      isQuickRecordOpen.value = false
      editingEventId.value = undefined
      deleteConfirmEventId.value = undefined
    }
  }

  function createCategory(input: CreateCategoryInput): EventCategory {
    const now = getIsoNow()
    const group = input.group ?? '飲食'
    const category: EventCategory = {
      id: createId('category'),
      name: input.name,
      group,
      colorId: input.colorId,
      icon: input.icon,
      isDefault: false,
      isQuickAction: input.isQuickAction ?? false,
      isArchived: input.isArchived ?? false,
      sortOrder: input.sortOrder ?? getNextCategorySortOrder(group),
      createdAt: now,
      updatedAt: now,
    }

    categories.value.push(category)

    return category
  }

  function updateCategory(
    categoryId: string,
    input: UpdateCategoryInput,
  ): EventCategory | undefined {
    const category = categoriesById.value.get(categoryId)

    if (!category) {
      return undefined
    }

    const nextInput = {
      ...input,
    }

    if (input.group && input.group !== category.group && typeof input.sortOrder !== 'number') {
      nextInput.sortOrder = getNextCategorySortOrder(input.group)
    }

    Object.assign(category, {
      ...nextInput,
      updatedAt: getIsoNow(),
    })

    return category
  }

  function getCategoryUsageCount(categoryId: string): number {
    return categoryUsageCounts.value.get(categoryId) ?? 0
  }

  function createEvent(input: CreateCatEventInput): CatEvent {
    const now = getIsoNow()
    const event: CatEvent = {
      id: createId('event'),
      catId: input.catId,
      categoryId: input.categoryId,
      occurredAt: input.occurredAt ?? now,
      title: input.title,
      severity: input.severity,
      note: input.note,
      values: input.values,
      createdAt: now,
      updatedAt: now,
    }

    events.value.push(event)

    return event
  }

  function quickRecord(categoryId: string, occurredAt?: string): CatEvent | undefined {
    const category = categoriesById.value.get(categoryId)

    if (!selectedCat.value || !category || category.isArchived) {
      return undefined
    }

    return createEvent({
      catId: selectedCat.value.id,
      categoryId,
      occurredAt,
    })
  }

  function updateEvent(eventId: string, input: UpdateCatEventInput): CatEvent | undefined {
    const event = eventsById.value.get(eventId)

    if (!event) {
      return undefined
    }

    Object.assign(event, {
      ...input,
      updatedAt: getIsoNow(),
    })

    return event
  }

  function deleteEvent(eventId: string): void {
    events.value = events.value.filter((event) => event.id !== eventId)
  }

  function deleteCategory(categoryId: string): void {
    const category = categoriesById.value.get(categoryId)

    if (!category) {
      return
    }

    if (getCategoryUsageCount(categoryId) > 0) {
      Object.assign(category, {
        isArchived: true,
        isQuickAction: false,
        updatedAt: getIsoNow(),
      })

      return
    }

    categories.value = categories.value.filter((item) => item.id !== categoryId)
  }

  function restoreCategory(categoryId: string): EventCategory | undefined {
    const category = categoriesById.value.get(categoryId)

    if (!category) {
      return undefined
    }

    Object.assign(category, {
      isArchived: false,
      isQuickAction: true,
      updatedAt: getIsoNow(),
    })

    return category
  }

  function reorderCategory(
    categoryId: string,
    targetCategoryId: string,
    position: 'before' | 'after' = 'before',
  ): void {
    if (categoryId === targetCategoryId) {
      return
    }

    const category = categoriesById.value.get(categoryId)
    const targetCategory = categoriesById.value.get(targetCategoryId)

    if (
      !category ||
      !targetCategory ||
      category.isArchived ||
      targetCategory.isArchived ||
      category.group !== targetCategory.group
    ) {
      return
    }

    const group = category.group
    const groupCategories = sortCategories(
      categories.value.filter((item) => item.group === group && !item.isArchived),
    )
    const fromIndex = groupCategories.findIndex((item) => item.id === categoryId)
    const toIndex = groupCategories.findIndex((item) => item.id === targetCategoryId)

    if (fromIndex < 0 || toIndex < 0) {
      return
    }

    const [movedCategory] = groupCategories.splice(fromIndex, 1)

    if (!movedCategory) {
      return
    }

    const targetIndex = groupCategories.findIndex((item) => item.id === targetCategoryId)

    if (targetIndex < 0) {
      return
    }

    groupCategories.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, movedCategory)

    const now = getIsoNow()
    groupCategories.forEach((item, index) => {
      Object.assign(item, {
        sortOrder: index,
        updatedAt: now,
      })
    })
  }

  function getNextCategorySortOrder(group: EventCategoryGroup): number {
    const groupCategories = categories.value.filter((category) => category.group === group)

    if (groupCategories.length === 0) {
      return 0
    }

    return Math.max(...groupCategories.map((category) => category.sortOrder)) + 1
  }

  return {
    cats,
    categories,
    events,
    selectedCatId,
    activeTab,
    selectedDate,
    visibleMonth,
    isQuickRecordOpen,
    editingEventId,
    deleteConfirmEventId,
    needsFirstTimeSetup,
    selectedCat,
    quickActionCategories,
    activeCategories,
    categoriesByGroup,
    archivedCategories,
    categoryUsageCounts,
    todayEvents,
    catsById,
    categoriesById,
    eventsById,
    monthTitle,
    selectedDateTitle,
    calendarDays,
    selectedDateEvents,
    selectedDateEventListItems,
    editingEvent,
    editingCategory,
    deleteConfirmEvent,
    selectCat,
    selectCalendarDate,
    showPreviousMonth,
    showNextMonth,
    setVisibleMonth,
    toggleQuickRecord,
    closeQuickRecord,
    setActiveTab,
    createCat,
    updateCat,
    replacePersistedState,
    createCategory,
    updateCategory,
    getCategoryUsageCount,
    createEvent,
    quickRecord,
    quickRecordForSelectedDate,
    updateEvent,
    deleteEvent,
    deleteCategory,
    restoreCategory,
    reorderCategory,
    openEditEvent,
    closeEditEvent,
    openDeleteConfirm,
    cancelDeleteEvent,
    confirmDeleteEvent,
  }
})
