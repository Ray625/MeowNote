import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { CATEGORY_GROUP_ORDER, DEFAULT_CATEGORY_STATISTICS_MODE } from '@/constants/defaultData'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { catTrackerRepository, type CatTrackerState } from '@/repositories/catTrackerRepository'
import { markSignedOutNotebookCacheDirty } from '@/services/localUnsyncedChanges'
import {
  canSyncRemoteEvent,
  createRemoteCatEvent,
  deleteRemoteCatEvent,
  isRemoteUuid,
  RemoteCatEventConflictError,
  updateRemoteCatEvent,
} from '@/services/syncRemoteCatEvents'
import { createRemoteCat, deleteRemoteCat, updateRemoteCat } from '@/services/syncRemoteCats'
import {
  createRemoteCategory,
  deleteRemoteCategory,
  updateRemoteCategory,
} from '@/services/syncRemoteCategories'
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
import { getEventValueText } from '@/utils/eventValues'
import { createId } from '@/utils/id'

type MainTab = 'notebook' | 'calendar' | 'stats' | 'settings'
type CalendarDisplayMode = 'calendar' | 'list'

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
  dateText?: string
  time: string
}

export interface MonthlyEventGroup {
  key: string
  title: string
  items: EventListItem[]
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

function formatMonthEventGroupTitle(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

function formatSearchEventGroupTitle(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatSearchEventDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

function compareEventsForGroupedList(a: CatEvent, b: CatEvent): number {
  const dateOrder = toDateKey(new Date(b.occurredAt)).localeCompare(
    toDateKey(new Date(a.occurredAt)),
  )

  if (dateOrder !== 0) {
    return dateOrder
  }

  return a.occurredAt.localeCompare(b.occurredAt)
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
  const remoteAuth = useRemoteAuth()
  const today = new Date()

  const cats = ref<Cat[]>(initialState.cats)
  const categories = ref<EventCategory[]>(initialState.categories)
  const events = ref<CatEvent[]>(initialState.events)
  const selectedCatId = ref(initialState.selectedCatId)
  const activeTab = ref<MainTab>('calendar')
  const calendarDisplayMode = ref<CalendarDisplayMode>('calendar')
  const isEventSearchOpen = ref(false)
  const eventSearchQuery = ref('')
  const isEventFilterOpen = ref(false)
  const eventFilterCategoryIds = ref<string[]>([])
  const selectedDate = ref(startOfDay(today))
  const visibleMonth = ref(startOfMonth(today))
  const isQuickRecordOpen = ref(false)
  const editingEventId = ref<string>()
  const deleteConfirmEventId = ref<string>()
  const remoteEventSyncError = ref('')
  const remoteCatSyncError = ref('')
  const remoteCategorySyncError = ref('')

  const needsFirstTimeSetup = computed(() => cats.value.length === 0)
  const selectedCat = computed(() => cats.value.find((cat) => cat.id === selectedCatId.value))
  const canCreateEventForSelectedCat = computed(() =>
    Boolean(selectedCat.value && !selectedCat.value.isArchived),
  )

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
  const catUsageCounts = computed(() => {
    const usageCounts = new Map<string, number>()

    for (const event of events.value) {
      usageCounts.set(event.catId, (usageCounts.get(event.catId) ?? 0) + 1)
    }

    return usageCounts
  })

  const todayEvents = computed(() =>
    filteredSelectedCatEvents.value
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
  const eventFilterCategoryIdSet = computed(() => new Set(eventFilterCategoryIds.value))
  const hasEventCategoryFilter = computed(() => eventFilterCategoryIds.value.length > 0)
  const filteredSelectedCatEvents = computed(() =>
    events.value
      .filter((event) => event.catId === selectedCatId.value)
      .filter(
        (event) =>
          !hasEventCategoryFilter.value || eventFilterCategoryIdSet.value.has(event.categoryId),
      ),
  )
  const eventFilterCategories = computed(() => {
    const categoryIds = new Set(
      events.value
        .filter((event) => event.catId === selectedCatId.value)
        .map((event) => event.categoryId),
    )

    return sortCategories(categories.value.filter((category) => categoryIds.has(category.id)))
  })
  const groupedEventFilterCategories = computed(() =>
    CATEGORY_GROUP_ORDER.map((group) => ({
      group,
      categories: eventFilterCategories.value.filter((category) => category.group === group),
    })).filter((item) => item.categories.length > 0),
  )
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

    for (const event of filteredSelectedCatEvents.value) {
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
    filteredSelectedCatEvents.value
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
  const trimmedEventSearchQuery = computed(() => eventSearchQuery.value.trim().toLocaleLowerCase())
  const isEventSearchActive = computed(() => trimmedEventSearchQuery.value.length > 0)
  const visibleMonthEventGroups = computed<MonthlyEventGroup[]>(() => {
    const groups = new Map<string, MonthlyEventGroup>()
    const monthStart = startOfMonth(visibleMonth.value)
    const nextMonthStart = addMonths(monthStart, 1)
    const monthEvents = filteredSelectedCatEvents.value
      .filter((event) => {
        const occurredAt = new Date(event.occurredAt)

        return occurredAt >= monthStart && occurredAt < nextMonthStart
      })
      .sort(compareEventsForGroupedList)

    return groupEventsByDate(monthEvents)
  })
  const searchedEventGroups = computed<MonthlyEventGroup[]>(() => {
    if (!isEventSearchActive.value) {
      return []
    }

    const query = trimmedEventSearchQuery.value
    const matchedEvents = filteredSelectedCatEvents.value
      .filter((event) => {
        const category = categoriesById.value.get(event.categoryId)
        const categoryName = category?.name.toLocaleLowerCase() ?? ''
        const valueText = getEventValueText(event, category).toLocaleLowerCase()
        const title = event.title?.toLocaleLowerCase() ?? ''
        const note = event.note?.toLocaleLowerCase() ?? ''

        return (
          categoryName.includes(query) ||
          valueText.includes(query) ||
          title.includes(query) ||
          note.includes(query)
        )
      })
      .sort(compareEventsForGroupedList)

    return groupEventsByMonth(matchedEvents)
  })

  function groupEventsByDate(groupedEvents: CatEvent[]): MonthlyEventGroup[] {
    const groups = new Map<string, MonthlyEventGroup>()

    for (const event of groupedEvents) {
      const occurredAt = new Date(event.occurredAt)
      const key = toDateKey(occurredAt)
      const group = groups.get(key) ?? {
        key,
        title: formatMonthEventGroupTitle(occurredAt),
        items: [],
      }

      group.items.push({
        event,
        category: categoriesById.value.get(event.categoryId),
        time: formatEventTime(event.occurredAt),
      })
      groups.set(key, group)
    }

    return [...groups.values()]
  }

  function groupEventsByMonth(groupedEvents: CatEvent[]): MonthlyEventGroup[] {
    const groups = new Map<string, MonthlyEventGroup>()

    for (const event of groupedEvents) {
      const occurredAt = new Date(event.occurredAt)
      const key = `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, '0')}`
      const group = groups.get(key) ?? {
        key,
        title: formatSearchEventGroupTitle(occurredAt),
        items: [],
      }

      group.items.push({
        event,
        category: categoriesById.value.get(event.categoryId),
        dateText: formatSearchEventDate(occurredAt),
        time: formatEventTime(event.occurredAt),
      })
      groups.set(key, group)
    }

    return [...groups.values()]
  }
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
    const cat = catsById.value.get(catId)

    if (!cat) {
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

  function setCalendarDisplayMode(mode: CalendarDisplayMode): void {
    calendarDisplayMode.value = mode
    isQuickRecordOpen.value = false
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

  function closeEventSearch(): void {
    isEventSearchOpen.value = false
    isEventFilterOpen.value = false
    eventSearchQuery.value = ''
  }

  function openEventSearch(): void {
    isEventSearchOpen.value = true
    isEventFilterOpen.value = false
  }

  function toggleEventFilter(): void {
    isEventFilterOpen.value = !isEventFilterOpen.value
  }

  function closeEventFilter(): void {
    isEventFilterOpen.value = false
  }

  function toggleEventFilterCategory(categoryId: string): void {
    eventFilterCategoryIds.value = eventFilterCategoryIdSet.value.has(categoryId)
      ? eventFilterCategoryIds.value.filter((id) => id !== categoryId)
      : [...eventFilterCategoryIds.value, categoryId]
  }

  function clearEventCategoryFilter(): void {
    eventFilterCategoryIds.value = []
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

    const category = categoriesById.value.get(categoryId)

    if (category && category.statisticsMode !== 'count') {
      openEditEvent(event.id)
    }

    return event
  }

  function openEditEvent(eventId: string): void {
    const event = eventsById.value.get(eventId)

    if (!event) {
      return
    }

    editingEventId.value = eventId
  }

  function closeEditEvent(): void {
    editingEventId.value = undefined
    deleteConfirmEventId.value = undefined
  }

  function openDeleteConfirm(eventId: string): void {
    const event = eventsById.value.get(eventId)

    if (!event || !canModifyEvent(event)) {
      return
    }

    deleteConfirmEventId.value = eventId
  }

  function cancelDeleteEvent(): void {
    deleteConfirmEventId.value = undefined
  }

  async function confirmDeleteEvent(): Promise<void> {
    if (!deleteConfirmEvent.value) {
      return
    }

    const deletedEventId = deleteConfirmEvent.value.id

    try {
      await deleteEvent(deletedEventId)
      deleteConfirmEventId.value = undefined

      if (editingEventId.value === deletedEventId) {
        closeEditEvent()
      }
    } catch {
      deleteConfirmEventId.value = undefined
    }
  }

  function createCat(input: CreateCatInput): Cat {
    if (!canManageNotebookData()) {
      throw new Error('只有 Notebook 擁有者可以新增寵物')
    }

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
    markLocalChangeIfSignedOut()
    syncCreatedCat(cat.id)

    return cat
  }

  function updateCat(catId: string, input: UpdateCatInput): Cat | undefined {
    if (!canManageNotebookData()) {
      return undefined
    }

    const cat = catsById.value.get(catId)

    if (!cat) {
      return undefined
    }

    Object.assign(cat, {
      ...input,
      updatedAt: getIsoNow(),
    })
    markLocalChangeIfSignedOut()
    syncUpdatedCat(cat.id)

    return cat
  }

  function deleteCat(catId: string): void {
    if (!canManageNotebookData()) {
      return
    }

    const cat = catsById.value.get(catId)

    if (!cat) {
      return
    }

    if (getCatUsageCount(catId) > 0) {
      Object.assign(cat, {
        isArchived: true,
        updatedAt: getIsoNow(),
      })

      markLocalChangeIfSignedOut()
      syncUpdatedCat(cat.id)
      return
    }

    cats.value = cats.value.filter((item) => item.id !== catId)

    if (selectedCatId.value === catId) {
      selectedCatId.value = getFallbackSelectedCatId(catId)
    }

    markLocalChangeIfSignedOut()
    syncDeletedCat(catId)
  }

  function restoreCat(catId: string): Cat | undefined {
    if (!canManageNotebookData()) {
      return undefined
    }

    const cat = catsById.value.get(catId)

    if (!cat) {
      return undefined
    }

    Object.assign(cat, {
      isArchived: false,
      updatedAt: getIsoNow(),
    })

    if (!selectedCatId.value) {
      selectedCatId.value = cat.id
    }

    markLocalChangeIfSignedOut()
    syncUpdatedCat(cat.id)

    return cat
  }

  function replacePersistedState(state: CatTrackerState): void {
    cats.value = state.cats
    categories.value = state.categories
    events.value = state.events
    selectedCatId.value = state.cats.some((cat) => cat.id === state.selectedCatId)
      ? state.selectedCatId
      : (state.cats.find((cat) => !cat.isArchived)?.id ?? '')

    if (selectedCatId.value) {
      isQuickRecordOpen.value = false
      editingEventId.value = undefined
      deleteConfirmEventId.value = undefined
    }
  }

  function createCategory(input: CreateCategoryInput): EventCategory {
    if (!canManageNotebookData()) {
      throw new Error('只有 Notebook 擁有者可以新增分類')
    }

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
      statisticsMode: input.statisticsMode ?? DEFAULT_CATEGORY_STATISTICS_MODE,
      templateId: input.templateId,
      valueLabel: input.valueLabel,
      valueMax: input.valueMax,
      valueUnit: input.valueUnit,
      createdAt: now,
      updatedAt: now,
    }

    categories.value.push(category)
    markLocalChangeIfSignedOut()
    syncCreatedCategory(category.id)

    return category
  }

  function updateCategory(
    categoryId: string,
    input: UpdateCategoryInput,
  ): EventCategory | undefined {
    if (!canManageNotebookData()) {
      return undefined
    }

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

    const nextStatisticsMode = nextInput.statisticsMode ?? category.statisticsMode

    Object.assign(category, {
      ...nextInput,
      statisticsMode: nextStatisticsMode,
      valueLabel:
        nextStatisticsMode === 'count' ? undefined : (nextInput.valueLabel ?? category.valueLabel),
      valueMax:
        nextStatisticsMode === 'rating' ? (nextInput.valueMax ?? category.valueMax ?? 10) : undefined,
      valueUnit:
        nextStatisticsMode === 'count' || nextStatisticsMode === 'rating'
          ? undefined
          : (nextInput.valueUnit ?? category.valueUnit),
      updatedAt: getIsoNow(),
    })

    markLocalChangeIfSignedOut()
    syncUpdatedCategory(category.id)

    return category
  }

  function getCategoryUsageCount(categoryId: string): number {
    return categoryUsageCounts.value.get(categoryId) ?? 0
  }

  function getCatUsageCount(catId: string): number {
    return catUsageCounts.value.get(catId) ?? 0
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
      createdBy: remoteAuth.user.value?.id,
      createdAt: now,
      updatedAt: now,
    }

    events.value.push(event)
    markLocalChangeIfSignedOut()
    syncCreatedEvent(event.id)

    return event
  }

  function quickRecord(categoryId: string, occurredAt?: string): CatEvent | undefined {
    const category = categoriesById.value.get(categoryId)

    if (!selectedCat.value || selectedCat.value.isArchived || !category || category.isArchived) {
      return undefined
    }

    return createEvent({
      catId: selectedCat.value.id,
      categoryId,
      occurredAt,
    })
  }

  async function updateEvent(
    eventId: string,
    input: UpdateCatEventInput,
  ): Promise<CatEvent | undefined> {
    const event = eventsById.value.get(eventId)

    if (!event || !canModifyEvent(event)) {
      return undefined
    }

    const previousEvent: CatEvent = {
      ...event,
      values: event.values ? { ...event.values } : undefined,
    }
    const expectedUpdatedAt = event.updatedAt

    Object.assign(event, {
      ...input,
      updatedAt: getIsoNow(),
    })
    markLocalChangeIfSignedOut()

    try {
      return (await syncUpdatedEvent(event.id, expectedUpdatedAt)) ?? event
    } catch (error) {
      const eventIndex = events.value.findIndex((item) => item.id === eventId)

      if (eventIndex >= 0) {
        events.value[eventIndex] = previousEvent
      }

      throw error
    }
  }

  async function deleteEvent(eventId: string): Promise<void> {
    const event = eventsById.value.get(eventId)

    if (event && !canModifyEvent(event)) {
      return
    }

    const shouldDeleteRemote = shouldSyncRemoteEventId(eventId)
    const expectedUpdatedAt = event?.updatedAt
    const deletedEventIndex = events.value.findIndex((item) => item.id === eventId)
    const deletedEvent = event
      ? {
          ...event,
          values: event.values ? { ...event.values } : undefined,
        }
      : undefined

    events.value = events.value.filter((event) => event.id !== eventId)
    markLocalChangeIfSignedOut({
      deletedEvent: {
        id: eventId,
        createdBy: event?.createdBy,
      },
    })

    if (shouldDeleteRemote) {
      try {
        await syncDeletedEvent(eventId, expectedUpdatedAt)
      } catch (error) {
        if (deletedEvent) {
          const nextEvents = [...events.value]
          const insertIndex =
            deletedEventIndex >= 0 ? Math.min(deletedEventIndex, nextEvents.length) : nextEvents.length

          nextEvents.splice(insertIndex, 0, deletedEvent)
          events.value = nextEvents
        }

        throw error
      }
    }
  }

  function deleteCategory(categoryId: string): void {
    if (!canManageNotebookData()) {
      return
    }

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

      markLocalChangeIfSignedOut()
      syncUpdatedCategory(category.id)

      return
    }

    categories.value = categories.value.filter((item) => item.id !== categoryId)
    markLocalChangeIfSignedOut()
    syncDeletedCategory(categoryId)
  }

  function restoreCategory(categoryId: string): EventCategory | undefined {
    if (!canManageNotebookData()) {
      return undefined
    }

    const category = categoriesById.value.get(categoryId)

    if (!category) {
      return undefined
    }

    Object.assign(category, {
      isArchived: false,
      isQuickAction: true,
      updatedAt: getIsoNow(),
    })

    syncUpdatedCategory(category.id)
    markLocalChangeIfSignedOut()

    return category
  }

  function reorderCategory(
    categoryId: string,
    targetCategoryId: string,
    position: 'before' | 'after' = 'before',
  ): void {
    if (!canManageNotebookData()) {
      return
    }

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
      syncUpdatedCategory(item.id)
    })
  }

  function getNextCategorySortOrder(group: EventCategoryGroup): number {
    const groupCategories = categories.value.filter((category) => category.group === group)

    if (groupCategories.length === 0) {
      return 0
    }

    return Math.max(...groupCategories.map((category) => category.sortOrder)) + 1
  }

  function getRemoteNotebookId(): string {
    return remoteAuth.activeNotebookId.value
  }

  function markLocalChangeIfSignedOut(input?: Parameters<typeof markSignedOutNotebookCacheDirty>[0]): void {
    if (!remoteAuth.user.value) {
      markSignedOutNotebookCacheDirty(input)
    }
  }

  function canModifyEvent(event: CatEvent): boolean {
    const notebookId = getRemoteNotebookId()
    const currentUserId = remoteAuth.user.value?.id
    const notebookRole = remoteAuth.activeNotebookRole.value

    if (!notebookId || !currentUserId) {
      return true
    }

    if (notebookRole === 'owner') {
      return true
    }

    return event.createdBy === currentUserId
  }

  function canManageNotebookData(): boolean {
    const notebookId = getRemoteNotebookId()
    const currentUserId = remoteAuth.user.value?.id

    if (!notebookId || !currentUserId) {
      return true
    }

    return (
      !remoteAuth.activeNotebookRole.value ||
      remoteAuth.activeNotebookRole.value === 'owner'
    )
  }

  function getFallbackSelectedCatId(excludedCatId?: string): string {
    return cats.value.find((cat) => !cat.isArchived && cat.id !== excludedCatId)?.id ?? ''
  }

  function syncCreatedCat(localCatId: string): void {
    const cat = catsById.value.get(localCatId)
    const notebookId = getRemoteNotebookId()

    if (!cat || !notebookId) {
      return
    }

    void createRemoteCat(cat, notebookId)
      .then((remoteCat) => {
        const catIndex = cats.value.findIndex((item) => item.id === localCatId)

        if (catIndex < 0) {
          return
        }

        if (localCatId !== remoteCat.id) {
          replaceCatId(localCatId, remoteCat.id)
        }

        cats.value[catIndex] = remoteCat
        remoteCatSyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteCatSyncError.value = getSyncErrorMessage(error, '寵物同步失敗')
      })
  }

  function syncUpdatedCat(catId: string): void {
    const cat = catsById.value.get(catId)
    const notebookId = getRemoteNotebookId()

    if (!cat || !notebookId || !isRemoteUuid(cat.id)) {
      return
    }

    void updateRemoteCat(cat, notebookId)
      .then((remoteCat) => {
        const catIndex = cats.value.findIndex((item) => item.id === catId)

        if (catIndex >= 0) {
          cats.value[catIndex] = remoteCat
        }

        remoteCatSyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteCatSyncError.value = getSyncErrorMessage(error, '寵物同步失敗')
      })
  }

  function syncDeletedCat(catId: string): void {
    const notebookId = getRemoteNotebookId()

    if (!notebookId || !isRemoteUuid(catId)) {
      return
    }

    void deleteRemoteCat(catId, notebookId)
      .then(() => {
        remoteCatSyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteCatSyncError.value = getSyncErrorMessage(error, '寵物同步失敗')
      })
  }

  function replaceCatId(previousCatId: string, nextCatId: string): void {
    if (previousCatId === nextCatId) {
      return
    }

    if (selectedCatId.value === previousCatId) {
      selectedCatId.value = nextCatId
    }

    events.value.forEach((event) => {
      if (event.catId === previousCatId) {
        Object.assign(event, {
          catId: nextCatId,
          updatedAt: getIsoNow(),
        })
      }
    })
  }

  function shouldSyncRemoteEvent(event: CatEvent): boolean {
    return canSyncRemoteEvent(event, getRemoteNotebookId())
  }

  function shouldSyncRemoteEventId(eventId: string): boolean {
    return Boolean(getRemoteNotebookId() && isRemoteUuid(eventId))
  }

  function shouldSyncRemoteCategory(category: EventCategory): boolean {
    return Boolean(getRemoteNotebookId() && isRemoteUuid(category.id))
  }

  function syncCreatedCategory(localCategoryId: string): void {
    const category = categoriesById.value.get(localCategoryId)
    const notebookId = getRemoteNotebookId()

    if (!category || !notebookId || !isRemoteUuid(category.id)) {
      return
    }

    void createRemoteCategory(category, notebookId)
      .then((remoteCategory) => {
        const categoryIndex = categories.value.findIndex((item) => item.id === localCategoryId)

        if (categoryIndex >= 0) {
          categories.value[categoryIndex] = remoteCategory
        }

        remoteCategorySyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteCategorySyncError.value = getSyncErrorMessage(error, '分類同步失敗')
      })
  }

  function syncUpdatedCategory(categoryId: string): void {
    const category = categoriesById.value.get(categoryId)
    const notebookId = getRemoteNotebookId()

    if (!category || !notebookId || !shouldSyncRemoteCategory(category)) {
      return
    }

    void updateRemoteCategory(category, notebookId)
      .then((remoteCategory) => {
        const categoryIndex = categories.value.findIndex((item) => item.id === categoryId)

        if (categoryIndex >= 0) {
          categories.value[categoryIndex] = remoteCategory
        }

        remoteCategorySyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteCategorySyncError.value = getSyncErrorMessage(error, '分類同步失敗')
      })
  }

  function syncDeletedCategory(categoryId: string): void {
    const notebookId = getRemoteNotebookId()

    if (!notebookId || !isRemoteUuid(categoryId)) {
      return
    }

    void deleteRemoteCategory(categoryId, notebookId)
      .then(() => {
        remoteCategorySyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteCategorySyncError.value = getSyncErrorMessage(error, '分類同步失敗')
      })
  }

  function syncCreatedEvent(localEventId: string): void {
    const event = eventsById.value.get(localEventId)
    const notebookId = getRemoteNotebookId()

    if (!event || !shouldSyncRemoteEvent(event)) {
      return
    }

    void createRemoteCatEvent(event, notebookId, remoteAuth.user.value?.id ?? null)
      .then((remoteEvent) => {
        const eventIndex = events.value.findIndex((item) => item.id === localEventId)

        if (eventIndex < 0) {
          return
        }

        events.value[eventIndex] = remoteEvent

        if (editingEventId.value === localEventId) {
          editingEventId.value = remoteEvent.id
        }

        if (deleteConfirmEventId.value === localEventId) {
          deleteConfirmEventId.value = remoteEvent.id
        }

        remoteEventSyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteEventSyncError.value = getSyncErrorMessage(error, '事件同步失敗')
      })
  }

  async function syncUpdatedEvent(
    eventId: string,
    expectedUpdatedAt?: string,
  ): Promise<CatEvent | undefined> {
    const event = eventsById.value.get(eventId)
    const notebookId = getRemoteNotebookId()

    if (!event || !isRemoteUuid(event.id) || !shouldSyncRemoteEvent(event)) {
      return undefined
    }

    try {
      const remoteEvent = await updateRemoteCatEvent(event, notebookId, expectedUpdatedAt)
      const eventIndex = events.value.findIndex((item) => item.id === eventId)

      if (eventIndex >= 0) {
        events.value[eventIndex] = remoteEvent
      }

      remoteEventSyncError.value = ''
      return remoteEvent
    } catch (error: unknown) {
      remoteEventSyncError.value =
        error instanceof RemoteCatEventConflictError
          ? error.message
          : getSyncErrorMessage(error, '事件同步失敗')
      throw error
    }
  }

  async function syncDeletedEvent(eventId: string, expectedUpdatedAt?: string): Promise<void> {
    const notebookId = getRemoteNotebookId()

    if (!notebookId) {
      return
    }

    try {
      await deleteRemoteCatEvent(eventId, notebookId, expectedUpdatedAt)
      remoteEventSyncError.value = ''
    } catch (error: unknown) {
      remoteEventSyncError.value =
        error instanceof RemoteCatEventConflictError
          ? error.message
          : getSyncErrorMessage(error, '事件同步失敗')
      throw error
    }
  }

  function getSyncErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === 'object' && error && 'message' in error) {
      const message = (error as { message?: unknown }).message

      if (typeof message === 'string') {
        return message
      }
    }

    return fallback
  }

  return {
    cats,
    categories,
    events,
    selectedCatId,
    activeTab,
    calendarDisplayMode,
    isEventSearchOpen,
    eventSearchQuery,
    isEventFilterOpen,
    eventFilterCategoryIds,
    selectedDate,
    visibleMonth,
    isQuickRecordOpen,
    editingEventId,
    deleteConfirmEventId,
    remoteEventSyncError,
    remoteCatSyncError,
    remoteCategorySyncError,
    needsFirstTimeSetup,
    selectedCat,
    canCreateEventForSelectedCat,
    quickActionCategories,
    activeCategories,
    categoriesByGroup,
    archivedCategories,
    categoryUsageCounts,
    catUsageCounts,
    todayEvents,
    catsById,
    categoriesById,
    eventsById,
    hasEventCategoryFilter,
    eventFilterCategories,
    groupedEventFilterCategories,
    monthTitle,
    selectedDateTitle,
    calendarDays,
    selectedDateEvents,
    selectedDateEventListItems,
    visibleMonthEventGroups,
    searchedEventGroups,
    isEventSearchActive,
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
    setCalendarDisplayMode,
    toggleEventSearch,
    closeEventSearch,
    openEventSearch,
    toggleEventFilter,
    closeEventFilter,
    toggleEventFilterCategory,
    clearEventCategoryFilter,
    createCat,
    updateCat,
    deleteCat,
    restoreCat,
    replacePersistedState,
    createCategory,
    updateCategory,
    getCategoryUsageCount,
    getCatUsageCount,
    createEvent,
    quickRecord,
    quickRecordForSelectedDate,
    updateEvent,
    deleteEvent,
    deleteCategory,
    restoreCategory,
    reorderCategory,
    canModifyEvent,
    openEditEvent,
    closeEditEvent,
    openDeleteConfirm,
    cancelDeleteEvent,
    confirmDeleteEvent,
  }
})
