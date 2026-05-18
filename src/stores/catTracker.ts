import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  createDefaultCat,
  createDefaultCategories,
  DEFAULT_CAT_ID,
  ensureDefaultCategories,
} from '@/constants/defaultData'
import type {
  Cat,
  CatEvent,
  CreateCatEventInput,
  CreateCatInput,
  CreateCategoryInput,
  EventCategory,
  UpdateCatEventInput,
} from '@/types'
import { getIsoNow, isSameLocalDate } from '@/utils/datetime'
import { createId } from '@/utils/id'
import { readJson, writeJson } from '@/utils/storage'

const STORAGE_KEY = 'cat-log:v1'

interface CatTrackerState {
  cats: Cat[]
  categories: EventCategory[]
  events: CatEvent[]
  selectedCatId: string
}

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

function createInitialState(): CatTrackerState {
  const now = getIsoNow()

  return {
    cats: [createDefaultCat(now)],
    categories: createDefaultCategories(now),
    events: [],
    selectedCatId: DEFAULT_CAT_ID,
  }
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

function normalizeState(state: CatTrackerState): CatTrackerState {
  const fallbackState = createInitialState()
  const cats = state.cats.length > 0 ? state.cats : fallbackState.cats
  const categories =
    state.categories.length > 0
      ? ensureDefaultCategories(state.categories, getIsoNow())
      : fallbackState.categories
  const selectedCatId = cats.some((cat) => cat.id === state.selectedCatId)
    ? state.selectedCatId
    : cats[0]?.id ?? DEFAULT_CAT_ID

  return {
    cats,
    categories,
    events: state.events,
    selectedCatId,
  }
}

export const useCatTrackerStore = defineStore('catTracker', () => {
  const initialState = normalizeState(readJson<CatTrackerState>(STORAGE_KEY, createInitialState()))
  const today = new Date()

  const cats = ref<Cat[]>(initialState.cats)
  const categories = ref<EventCategory[]>(initialState.categories)
  const events = ref<CatEvent[]>(initialState.events)
  const selectedCatId = ref(initialState.selectedCatId)
  const selectedDate = ref(startOfDay(today))
  const visibleMonth = ref(startOfMonth(today))
  const isQuickRecordOpen = ref(false)
  const lastCreatedEventId = ref<string>()
  const editingEventId = ref<string>()
  const deleteConfirmEventId = ref<string>()

  const selectedCat = computed(() => cats.value.find((cat) => cat.id === selectedCatId.value))

  const quickActionCategories = computed(() =>
    categories.value.filter((category) => category.isQuickAction),
  )

  const todayEvents = computed(() =>
    events.value
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
  const successMessage = computed(() => {
    if (!lastCreatedEventId.value) {
      return ''
    }

    const event = selectedDateEvents.value.find((item) => item.id === lastCreatedEventId.value)
    const category = event ? categoriesById.value.get(event.categoryId) : undefined

    return category ? `已記錄：${category.name}` : '已記錄'
  })
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
      writeJson<CatTrackerState>(STORAGE_KEY, {
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

  function toggleQuickRecord(): void {
    isQuickRecordOpen.value = !isQuickRecordOpen.value
  }

  function closeQuickRecord(): void {
    isQuickRecordOpen.value = false
  }

  function clearLastCreatedEvent(): void {
    lastCreatedEventId.value = undefined
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

    lastCreatedEventId.value = event.id
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
      avatarUrl: input.avatarUrl,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    }

    cats.value.push(cat)
    selectedCatId.value = cat.id

    return cat
  }

  function createCategory(input: CreateCategoryInput): EventCategory {
    const now = getIsoNow()
    const category: EventCategory = {
      id: createId('category'),
      name: input.name,
      group: input.group,
      color: input.color,
      icon: input.icon,
      isDefault: false,
      isQuickAction: input.isQuickAction ?? false,
      createdAt: now,
      updatedAt: now,
    }

    categories.value.push(category)

    return category
  }

  function createEvent(input: CreateCatEventInput): CatEvent {
    const now = getIsoNow()
    const event: CatEvent = {
      id: createId('event'),
      catId: input.catId,
      categoryId: input.categoryId,
      occurredAt: input.occurredAt ?? now,
      severity: input.severity,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    }

    events.value.push(event)

    return event
  }

  function quickRecord(categoryId: string, occurredAt?: string): CatEvent | undefined {
    if (!selectedCat.value || !categoriesById.value.has(categoryId)) {
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

  return {
    cats,
    categories,
    events,
    selectedCatId,
    selectedDate,
    visibleMonth,
    isQuickRecordOpen,
    lastCreatedEventId,
    editingEventId,
    deleteConfirmEventId,
    selectedCat,
    quickActionCategories,
    todayEvents,
    catsById,
    categoriesById,
    eventsById,
    monthTitle,
    selectedDateTitle,
    calendarDays,
    selectedDateEvents,
    selectedDateEventListItems,
    successMessage,
    editingEvent,
    editingCategory,
    deleteConfirmEvent,
    selectCat,
    selectCalendarDate,
    showPreviousMonth,
    showNextMonth,
    toggleQuickRecord,
    closeQuickRecord,
    clearLastCreatedEvent,
    createCat,
    createCategory,
    createEvent,
    quickRecord,
    quickRecordForSelectedDate,
    updateEvent,
    deleteEvent,
    openEditEvent,
    closeEditEvent,
    openDeleteConfirm,
    cancelDeleteEvent,
    confirmDeleteEvent,
  }
})
