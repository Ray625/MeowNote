import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { CATEGORY_GROUP_ORDER } from '@/constants/defaultData'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { catTrackerRepository, type CatTrackerState } from '@/repositories/catTrackerRepository'
import {
  canSyncRemoteEvent,
  createRemoteCatEvent,
  deleteRemoteCatEvent,
  isRemoteUuid,
  updateRemoteCatEvent,
} from '@/services/syncRemoteCatEvents'
import { createRemoteCat, deleteRemoteCat, updateRemoteCat } from '@/services/syncRemoteCats'
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
  const selectedDate = ref(startOfDay(today))
  const visibleMonth = ref(startOfMonth(today))
  const isQuickRecordOpen = ref(false)
  const editingEventId = ref<string>()
  const deleteConfirmEventId = ref<string>()
  const remoteEventSyncError = ref('')
  const remoteCatSyncError = ref('')

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
  const trimmedEventSearchQuery = computed(() => eventSearchQuery.value.trim().toLocaleLowerCase())
  const isEventSearchActive = computed(() => trimmedEventSearchQuery.value.length > 0)
  const visibleMonthEventGroups = computed<MonthlyEventGroup[]>(() => {
    const groups = new Map<string, MonthlyEventGroup>()
    const monthStart = startOfMonth(visibleMonth.value)
    const nextMonthStart = addMonths(monthStart, 1)
    const monthEvents = events.value
      .filter((event) => event.catId === selectedCatId.value)
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
    const matchedEvents = events.value
      .filter((event) => event.catId === selectedCatId.value)
      .filter((event) => {
        const title = event.title?.toLocaleLowerCase() ?? ''
        const note = event.note?.toLocaleLowerCase() ?? ''

        return title.includes(query) || note.includes(query)
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

    if (!isEventSearchOpen.value) {
      eventSearchQuery.value = ''
    }
  }

  function closeEventSearch(): void {
    isEventSearchOpen.value = false
    eventSearchQuery.value = ''
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
    syncCreatedCat(cat.id)

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
    syncUpdatedCat(cat.id)

    return cat
  }

  function deleteCat(catId: string): void {
    const cat = catsById.value.get(catId)

    if (!cat) {
      return
    }

    if (getCatUsageCount(catId) > 0) {
      Object.assign(cat, {
        isArchived: true,
        updatedAt: getIsoNow(),
      })

      syncUpdatedCat(cat.id)
      return
    }

    cats.value = cats.value.filter((item) => item.id !== catId)

    if (selectedCatId.value === catId) {
      selectedCatId.value = getFallbackSelectedCatId(catId)
    }

    syncDeletedCat(catId)
  }

  function restoreCat(catId: string): Cat | undefined {
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
      createdAt: now,
      updatedAt: now,
    }

    events.value.push(event)
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

  function updateEvent(eventId: string, input: UpdateCatEventInput): CatEvent | undefined {
    const event = eventsById.value.get(eventId)

    if (!event) {
      return undefined
    }

    Object.assign(event, {
      ...input,
      updatedAt: getIsoNow(),
    })
    syncUpdatedEvent(event.id)

    return event
  }

  function deleteEvent(eventId: string): void {
    const shouldDeleteRemote = shouldSyncRemoteEventId(eventId)

    events.value = events.value.filter((event) => event.id !== eventId)

    if (shouldDeleteRemote) {
      syncDeletedEvent(eventId)
    }
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

  function getRemoteNotebookId(): string {
    return remoteAuth.activeNotebookId.value
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

  function syncUpdatedEvent(eventId: string): void {
    const event = eventsById.value.get(eventId)
    const notebookId = getRemoteNotebookId()

    if (!event || !isRemoteUuid(event.id) || !shouldSyncRemoteEvent(event)) {
      return
    }

    void updateRemoteCatEvent(event, notebookId)
      .then((remoteEvent) => {
        const eventIndex = events.value.findIndex((item) => item.id === eventId)

        if (eventIndex >= 0) {
          events.value[eventIndex] = remoteEvent
        }

        remoteEventSyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteEventSyncError.value = getSyncErrorMessage(error, '事件同步失敗')
      })
  }

  function syncDeletedEvent(eventId: string): void {
    const notebookId = getRemoteNotebookId()

    if (!notebookId) {
      return
    }

    void deleteRemoteCatEvent(eventId, notebookId)
      .then(() => {
        remoteEventSyncError.value = ''
      })
      .catch((error: unknown) => {
        remoteEventSyncError.value = getSyncErrorMessage(error, '事件同步失敗')
      })
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
    selectedDate,
    visibleMonth,
    isQuickRecordOpen,
    editingEventId,
    deleteConfirmEventId,
    remoteEventSyncError,
    remoteCatSyncError,
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
    openEditEvent,
    closeEditEvent,
    openDeleteConfirm,
    cancelDeleteEvent,
    confirmDeleteEvent,
  }
})
