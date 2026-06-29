import { computed, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { CATEGORY_GROUP_ORDER } from '@/constants/defaultData'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import {
  applyCatUpdate,
  createCatRecord,
  deleteCatRecord,
  getFallbackSelectedCatId,
  restoreCatRecord,
} from '@/domain/catTracker/cat'
import {
  createCategoryRecord,
  createCategoryUpdatePatch,
  deleteCategoryRecord,
  getNextCategorySortOrder,
  getReorderedCategories,
  restoreCategoryRecord,
} from '@/domain/catTracker/category'
import {
  createEventDraft,
  duplicateEventDraft,
} from '@/domain/catTracker/eventDraft'
import {
  applyEventUpdate,
  cloneEventRecord,
  createEventRecord,
  removeEventById,
  restoreDeletedEvent,
} from '@/domain/catTracker/event'
import {
  canManageNotebookData as canManageNotebookDataForContext,
  canModifyEventForNotebook,
} from '@/domain/catTracker/permissions'
import {
  createCalendarDays,
  createEventCountByDate,
  createEventListItems,
  createSearchedEventGroups,
  createUsageCounts,
  createVisibleMonthEventGroups,
  getCategoriesWithEventsForCat,
  getEventsForDate,
  getFilteredEventsForCat,
  sortCategories,
  type CalendarDay,
  type EventListItem,
  type MonthlyEventGroup,
} from '@/domain/catTracker/selectors'
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
import { deleteEventPhotoPaths, getEventPhotoStoragePaths } from '@/services/eventPhotoStorage'
import { createRemoteCat, deleteRemoteCat, updateRemoteCat } from '@/services/syncRemoteCats'
import {
  createRemoteCategory,
  deleteRemoteCategory,
  updateRemoteCategory,
} from '@/services/syncRemoteCategories'
import { useCalendarViewStore } from '@/stores/calendarView'
import { useEventEditorStore } from '@/stores/eventEditor'
import type {
  Cat,
  CatEvent,
  CreateCatEventInput,
  CreateCatInput,
  CreateCategoryInput,
  EventCategory,
  UpdateCatInput,
  UpdateCategoryInput,
  UpdateCatEventInput,
} from '@/types'
import { getIsoNow, isSameLocalDate } from '@/utils/datetime'

export type { CalendarDay, EventListItem, MonthlyEventGroup }

export const useCatTrackerStore = defineStore('catTracker', () => {
  const initialState = catTrackerRepository.loadState()
  const remoteAuth = useRemoteAuth()
  const calendarViewStore = useCalendarViewStore()
  const eventEditorStore = useEventEditorStore()
  const { deleteConfirmEventId, draftEvent, editingEventId } = storeToRefs(eventEditorStore)
  const {
    activeTab,
    calendarDisplayMode,
    eventFilterCategoryIds,
    eventSearchQuery,
    isEventFilterOpen,
    isEventSearchOpen,
    isQuickRecordOpen,
    selectedDate,
    visibleMonth,
  } = storeToRefs(calendarViewStore)
  const today = new Date()

  const cats = ref<Cat[]>(initialState.cats)
  const categories = ref<EventCategory[]>(initialState.categories)
  const events = ref<CatEvent[]>(initialState.events)
  const selectedCatId = ref(initialState.selectedCatId)
  const remoteEventSyncError = ref('')
  const remoteEventSyncErrorKey = ref(0)
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
  const categoryUsageCounts = computed(() =>
    createUsageCounts(events.value, (event) => event.categoryId),
  )
  const catUsageCounts = computed(() => createUsageCounts(events.value, (event) => event.catId))

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
  const hasEventCategoryFilter = computed(() => eventFilterCategoryIds.value.length > 0)
  const filteredSelectedCatEvents = computed(() =>
    getFilteredEventsForCat(events.value, selectedCatId.value, eventFilterCategoryIds.value),
  )
  const eventFilterCategories = computed(() =>
    getCategoriesWithEventsForCat(events.value, categories.value, selectedCatId.value),
  )
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
  const eventCountByDate = computed(() => createEventCountByDate(filteredSelectedCatEvents.value))
  const calendarDays = computed<CalendarDay[]>(() =>
    createCalendarDays({
      visibleMonth: visibleMonth.value,
      selectedDate: selectedDate.value,
      today,
      eventCountByDate: eventCountByDate.value,
    }),
  )
  const selectedDateEvents = computed(() =>
    getEventsForDate(filteredSelectedCatEvents.value, selectedDate.value),
  )
  const selectedDateEventListItems = computed<EventListItem[]>(() =>
    createEventListItems(selectedDateEvents.value, categoriesById.value),
  )
  const trimmedEventSearchQuery = computed(() => eventSearchQuery.value.trim().toLocaleLowerCase())
  const isEventSearchActive = computed(() => trimmedEventSearchQuery.value.length > 0)
  const visibleMonthEventGroups = computed<MonthlyEventGroup[]>(() => {
    return createVisibleMonthEventGroups(
      filteredSelectedCatEvents.value,
      visibleMonth.value,
      categoriesById.value,
    )
  })
  const searchedEventGroups = computed<MonthlyEventGroup[]>(() => {
    return createSearchedEventGroups({
      events: filteredSelectedCatEvents.value,
      categoriesById: categoriesById.value,
      query: trimmedEventSearchQuery.value,
    })
  })
  const editingEvent = computed(
    () =>
      draftEvent.value ??
      (editingEventId.value ? eventsById.value.get(editingEventId.value) : undefined),
  )
  const isCreatingEventDraft = computed(() => Boolean(draftEvent.value))
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
    calendarViewStore.closeQuickRecord()
    eventEditorStore.close()
  }

  function selectCalendarDate(date: Date): void {
    calendarViewStore.selectDate(date)
  }

  function showPreviousMonth(): void {
    calendarViewStore.showPreviousMonth()
  }

  function showNextMonth(): void {
    calendarViewStore.showNextMonth()
  }

  function setVisibleMonth(year: number, monthIndex: number): void {
    calendarViewStore.setVisibleMonth(year, monthIndex)
  }

  function toggleQuickRecord(): void {
    calendarViewStore.toggleQuickRecord()
  }

  function closeQuickRecord(): void {
    calendarViewStore.closeQuickRecord()
  }

  function setActiveTab(tab: Parameters<typeof calendarViewStore.setActiveTab>[0]): void {
    calendarViewStore.setActiveTab(tab)
  }

  function setCalendarDisplayMode(
    mode: Parameters<typeof calendarViewStore.setCalendarDisplayMode>[0],
  ): void {
    calendarViewStore.setCalendarDisplayMode(mode)
  }

  function toggleEventSearch(): void {
    calendarViewStore.toggleEventSearch()
  }

  function closeEventSearch(): void {
    calendarViewStore.closeEventSearch()
  }

  function openEventSearch(): void {
    calendarViewStore.openEventSearch()
  }

  function toggleEventFilter(): void {
    calendarViewStore.toggleEventFilter()
  }

  function closeEventFilter(): void {
    calendarViewStore.closeEventFilter()
  }

  function toggleEventFilterCategory(categoryId: string): void {
    calendarViewStore.toggleEventFilterCategory(categoryId)
  }

  function clearEventCategoryFilter(): void {
    calendarViewStore.clearEventCategoryFilter()
  }

  function getQuickRecordOccurredAt(): string {
    const now = new Date()
    const occurredAt = new Date(selectedDate.value)

    occurredAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())

    return occurredAt.toISOString()
  }

  function quickRecordForSelectedDate(categoryId: string): CatEvent | undefined {
    const event = openCreateEventDraft(categoryId, getQuickRecordOccurredAt())

    if (!event) {
      return undefined
    }

    calendarViewStore.closeQuickRecord()
    return event
  }

  function openCreateEventDraft(categoryId: string, occurredAt?: string): CatEvent | undefined {
    const category = categoriesById.value.get(categoryId)

    if (!selectedCat.value || selectedCat.value.isArchived || !category || category.isArchived) {
      return undefined
    }

    const event = createEventDraft({
      catId: selectedCat.value.id,
      categoryId,
      occurredAt,
      createdBy: remoteAuth.user.value?.id,
    })

    eventEditorStore.openDraft(event)
    return event
  }

  function duplicateEventAsDraft(eventId: string): CatEvent | undefined {
    const sourceEvent = eventsById.value.get(eventId)
    const category = sourceEvent ? categoriesById.value.get(sourceEvent.categoryId) : undefined
    const sourceCat = sourceEvent ? catsById.value.get(sourceEvent.catId) : undefined

    if (!sourceEvent || !sourceCat || sourceCat.isArchived || !category || category.isArchived) {
      return undefined
    }

    // Future media/attachments should not be copied; they describe the original moment.
    const event = duplicateEventDraft(sourceEvent, remoteAuth.user.value?.id)

    eventEditorStore.openDraft(event)
    return event
  }

  function openEditEvent(eventId: string): void {
    const event = eventsById.value.get(eventId)

    if (!event) {
      return
    }

    eventEditorStore.openExisting(eventId)
  }

  function closeEditEvent(): void {
    eventEditorStore.close()
  }

  function openDeleteConfirm(eventId: string): void {
    const event = eventsById.value.get(eventId)

    if (!event || !canModifyEvent(event)) {
      return
    }

    eventEditorStore.requestDelete(eventId)
  }

  function cancelDeleteEvent(): void {
    eventEditorStore.cancelDelete()
  }

  async function confirmDeleteEvent(): Promise<void> {
    if (!deleteConfirmEvent.value) {
      return
    }

    const deletedEventId = deleteConfirmEvent.value.id

    try {
      await deleteEvent(deletedEventId)
      eventEditorStore.cancelDelete()

      if (editingEventId.value === deletedEventId) {
        closeEditEvent()
      }
    } catch {
      eventEditorStore.cancelDelete()
    }
  }

  function createCat(input: CreateCatInput): Cat {
    if (!canManageNotebookData()) {
      throw new Error('只有 Notebook 擁有者可以新增寵物')
    }

    const cat = createCatRecord(input, getIsoNow())

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

    applyCatUpdate(cat, input, getIsoNow())
    markLocalChangeIfSignedOut()
    syncUpdatedCat(cat.id)

    return cat
  }

  function deleteCat(catId: string): void {
    if (!canManageNotebookData()) {
      return
    }

    const result = deleteCatRecord(cats.value, catId, getCatUsageCount(catId), getIsoNow())

    if (result.status === 'missing') {
      return
    }

    if (result.status === 'archived') {
      markLocalChangeIfSignedOut()
      syncUpdatedCat(result.cat.id)
      return
    }

    cats.value = result.cats

    if (selectedCatId.value === catId) {
      selectedCatId.value = result.fallbackSelectedCatId
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

    restoreCatRecord(cat, getIsoNow())

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
      calendarViewStore.closeQuickRecord()
      eventEditorStore.close()
    }
  }

  function createCategory(input: CreateCategoryInput): EventCategory {
    if (!canManageNotebookData()) {
      throw new Error('只有 Notebook 擁有者可以新增分類')
    }

    const group = input.group ?? '飲食'
    const category = createCategoryRecord(
      input,
      getIsoNow(),
      getNextCategorySortOrder(categories.value, group),
    )

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

    Object.assign(
      category,
      createCategoryUpdatePatch(
        category,
        input,
        getIsoNow(),
        input.group ? getNextCategorySortOrder(categories.value, input.group) : undefined,
      ),
    )

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
    const event = createEventRecord(input, now, remoteAuth.user.value?.id)

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

    const previousEvent = cloneEventRecord(event)
    const expectedUpdatedAt = event.updatedAt

    applyEventUpdate(event, input, getIsoNow())
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
    const deletedEvent = event ? cloneEventRecord(event) : undefined

    events.value = removeEventById(events.value, eventId)
    markLocalChangeIfSignedOut({
      deletedEvent: {
        id: eventId,
        createdBy: event?.createdBy,
      },
    })

    if (shouldDeleteRemote) {
      try {
        await syncDeletedEvent(
          eventId,
          expectedUpdatedAt,
          getEventPhotoStoragePaths(event?.photos ?? []),
        )
      } catch (error) {
        if (deletedEvent) {
          events.value = restoreDeletedEvent(events.value, deletedEvent, deletedEventIndex)
        }

        throw error
      }
    }
  }

  function deleteCategory(categoryId: string): void {
    if (!canManageNotebookData()) {
      return
    }

    const result = deleteCategoryRecord(
      categories.value,
      categoryId,
      getCategoryUsageCount(categoryId),
      getIsoNow(),
    )

    if (result.status === 'missing') {
      return
    }

    if (result.status === 'archived') {
      markLocalChangeIfSignedOut()
      syncUpdatedCategory(result.category.id)

      return
    }

    categories.value = result.categories
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

    restoreCategoryRecord(category, getIsoNow())

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

    const groupCategories = getReorderedCategories(
      categories.value,
      categoryId,
      targetCategoryId,
      position,
    )

    if (groupCategories.length === 0) {
      return
    }

    const now = getIsoNow()
    groupCategories.forEach((item, index) => {
      Object.assign(item, {
        sortOrder: index,
        updatedAt: now,
      })
      syncUpdatedCategory(item.id)
    })
  }

  function getRemoteNotebookId(): string {
    return remoteAuth.activeNotebookId.value
  }

  function markLocalChangeIfSignedOut(
    input?: Parameters<typeof markSignedOutNotebookCacheDirty>[0],
  ): void {
    if (!remoteAuth.user.value) {
      markSignedOutNotebookCacheDirty(input)
    }
  }

  function canModifyEvent(event: CatEvent): boolean {
    return canModifyEventForNotebook(event, {
      notebookId: getRemoteNotebookId(),
      userId: remoteAuth.user.value?.id,
      role: remoteAuth.activeNotebookRole.value,
    })
  }

  function canManageNotebookData(): boolean {
    return canManageNotebookDataForContext({
      notebookId: getRemoteNotebookId(),
      userId: remoteAuth.user.value?.id,
      role: remoteAuth.activeNotebookRole.value,
    })
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

        eventEditorStore.replaceEventId(localEventId, remoteEvent.id)

        remoteEventSyncError.value = ''
      })
      .catch((error: unknown) => {
        setRemoteEventSyncError(getSyncErrorMessage(error, '事件同步失敗'))
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
      setRemoteEventSyncError(
        error instanceof RemoteCatEventConflictError
          ? error.message
          : getSyncErrorMessage(error, '事件同步失敗'),
      )
      throw error
    }
  }

  async function syncDeletedEvent(
    eventId: string,
    expectedUpdatedAt?: string,
    photoPaths: string[] = [],
  ): Promise<void> {
    const notebookId = getRemoteNotebookId()

    if (!notebookId) {
      return
    }

    try {
      await deleteRemoteCatEvent(eventId, notebookId, expectedUpdatedAt)
      if (photoPaths.length) {
        await deleteEventPhotoPaths(photoPaths)
      }
      remoteEventSyncError.value = ''
    } catch (error: unknown) {
      setRemoteEventSyncError(
        error instanceof RemoteCatEventConflictError
          ? error.message
          : getSyncErrorMessage(error, '事件同步失敗'),
      )
      throw error
    }
  }

  function setRemoteEventSyncError(message: string): void {
    remoteEventSyncError.value = message
    remoteEventSyncErrorKey.value += 1
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
    remoteEventSyncErrorKey,
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
    isCreatingEventDraft,
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
    duplicateEventAsDraft,
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
