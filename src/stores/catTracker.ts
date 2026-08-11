import { computed, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { CATEGORY_GROUP_ORDER } from '@/constants/defaultData'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import {
  applyCatUpdate,
  createCatRecord,
  deleteCatRecord,
  restoreCatRecord,
} from '@/domain/catTracker/cat'
import {
  applyCategoryReorder,
  createCategoryMutation,
  deleteCategoryRecord,
  restoreCategoryRecord,
  updateCategoryMutation,
} from '@/domain/catTracker/category'
import {
  createEventDraft,
  duplicateEventDraft,
} from '@/domain/catTracker/eventDraft'
import {
  applyEventUpdate,
  createEventRecord,
  removeEventById,
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
  getSyncDiagnosticErrorInfo,
  recordSyncDiagnostic,
} from '@/services/syncDiagnostics'
import {
  enqueueRemoteEventCreate,
  enqueueRemoteEventDelete,
  enqueueRemoteEventUpdate,
  getPendingRemoteEventCreateIds as getQueuedPendingRemoteEventCreateIds,
  getPendingRemoteEventCreates,
  getPendingRemoteEventDeleteIds as getQueuedPendingRemoteEventDeleteIds,
  getPendingRemoteEventDeletes,
  getPendingRemoteEventUpdate,
  getPendingRemoteEventUpdateIds as getQueuedPendingRemoteEventUpdateIds,
  getPendingRemoteEventUpdates,
  getRemoteEventSyncQueueSummary,
  markRemoteEventCreateAttempt,
  markRemoteEventCreateFailure,
  markRemoteEventDeleteAttempt,
  markRemoteEventDeleteFailure,
  markRemoteEventUpdateAttempt,
  markRemoteEventUpdateFailure,
  removeRemoteEventCreate,
  removeRemoteEventDelete,
  removeRemoteEventUpdate,
} from '@/services/remoteEventSyncQueue'
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
  const isPersistenceHydrated = ref(false)
  const remoteEventSyncQueueRevision = ref(0)
  const syncingCreatedEventIds = new Set<string>()
  const syncingUpdatedEventIds = new Set<string>()
  const syncingDeletedEventIds = new Set<string>()
  let hasLocalChangesBeforeHydration = false

  const needsFirstTimeSetup = computed(() => isPersistenceHydrated.value && cats.value.length === 0)
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
  const remoteEventSyncQueueSummary = computed(() => {
    remoteEventSyncQueueRevision.value

    return getRemoteEventSyncQueueSummary({
      notebookId: getRemoteNotebookId(),
      userId: remoteAuth.user.value?.id,
    })
  })

  watch(
    [cats, categories, events, selectedCatId],
    () => {
      if (!isPersistenceHydrated.value) {
        hasLocalChangesBeforeHydration = true
        return
      }

      catTrackerRepository.saveState({
        cats: cats.value,
        categories: categories.value,
        events: events.value,
        selectedCatId: selectedCatId.value,
      })
    },
    { deep: true },
  )

  void hydratePersistedState()

  async function hydratePersistedState(): Promise<void> {
    try {
      const state = await catTrackerRepository.loadStateAsync()

      if (!hasLocalChangesBeforeHydration) {
        replacePersistedState(state)
      }
    } finally {
      isPersistenceHydrated.value = true
      catTrackerRepository.saveState({
        cats: cats.value,
        categories: categories.value,
        events: events.value,
        selectedCatId: selectedCatId.value,
      })
    }
  }

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

    const category = createCategoryMutation(categories.value, input, getIsoNow())

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

    const result = updateCategoryMutation(categories.value, categoryId, input, getIsoNow())

    if (result.status === 'missing') {
      return undefined
    }

    markLocalChangeIfSignedOut()
    syncUpdatedCategory(result.category.id)

    return result.category
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

    const expectedUpdatedAt = event.updatedAt

    applyEventUpdate(event, input, getIsoNow())
    markLocalChangeIfSignedOut()

    if (shouldSyncRemoteEvent(event) && remoteAuth.user.value?.id) {
      if (!getPendingRemoteEventCreateIds().has(event.id)) {
    enqueueRemoteEventUpdate({
          eventId: event.id,
          notebookId: getRemoteNotebookId(),
          userId: remoteAuth.user.value.id,
          expectedUpdatedAt,
        })
        touchRemoteEventSyncQueue()

        void syncPendingUpdatedEvent(event.id)
      }
    }

    return event
  }

  async function deleteEvent(eventId: string): Promise<void> {
    const event = eventsById.value.get(eventId)

    if (event && !canModifyEvent(event)) {
      return
    }

    const shouldDeleteRemote = shouldSyncRemoteEventId(eventId)
    const expectedUpdatedAt = event?.updatedAt
    const notebookId = getRemoteNotebookId()
    const userId = remoteAuth.user.value?.id ?? ''
    const photoPaths = getEventPhotoStoragePaths(event?.photos ?? [])

    events.value = removeEventById(events.value, eventId)
    markLocalChangeIfSignedOut({
      deletedEvent: {
        id: eventId,
        createdBy: event?.createdBy,
      },
    })

    if (!shouldDeleteRemote || !userId) {
      return
    }

    if (getPendingRemoteEventCreateIds().has(eventId)) {
      removeRemoteEventCreate({
        eventId,
        notebookId,
        userId,
      })
      removeRemoteEventUpdate({
        eventId,
        notebookId,
        userId,
      })
      touchRemoteEventSyncQueue()
      return
    }

    removeRemoteEventUpdate({
      eventId,
      notebookId,
      userId,
    })
    enqueueRemoteEventDelete({
      eventId,
      notebookId,
      userId,
      expectedUpdatedAt,
      photoPaths,
    })
    touchRemoteEventSyncQueue()
    void syncPendingDeletedEvent(eventId)
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

    const updatedCategories = applyCategoryReorder(
      categories.value,
      categoryId,
      targetCategoryId,
      getIsoNow(),
      position,
    )

    if (updatedCategories.length === 0) {
      return
    }

    updatedCategories.forEach((category) => syncUpdatedCategory(category.id))
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
    const userId = remoteAuth.user.value?.id ?? ''

    if (!event || !shouldSyncRemoteEvent(event)) {
      return
    }

    enqueueRemoteEventCreate({
      eventId: event.id,
      notebookId,
      userId,
    })
    touchRemoteEventSyncQueue()

    void syncPendingCreatedEvent(event.id)
  }

  async function retryPendingRemoteEventCreates(): Promise<void> {
    const notebookId = getRemoteNotebookId()
    const userId = remoteAuth.user.value?.id

    if (!notebookId || !userId) {
      return
    }

    const pendingCreates = getPendingRemoteEventCreates({
      notebookId,
      userId,
    })

    for (const pendingCreate of pendingCreates) {
      if (!eventsById.value.has(pendingCreate.eventId)) {
        recordSyncDiagnostic('event-create-retry-missing-local-event', {
          eventId: pendingCreate.eventId,
          notebookId,
          userId,
        })
        continue
      }

      await syncPendingCreatedEvent(pendingCreate.eventId)
    }
  }

  function getPendingRemoteEventCreateIds(): Set<string> {
    return getQueuedPendingRemoteEventCreateIds({
      notebookId: getRemoteNotebookId(),
      userId: remoteAuth.user.value?.id,
    })
  }

  async function retryPendingRemoteEventUpdates(): Promise<void> {
    const notebookId = getRemoteNotebookId()
    const userId = remoteAuth.user.value?.id

    if (!notebookId || !userId) {
      return
    }

    const pendingUpdates = getPendingRemoteEventUpdates({
      notebookId,
      userId,
    })

    for (const pendingUpdate of pendingUpdates) {
      if (!eventsById.value.has(pendingUpdate.eventId)) {
        recordSyncDiagnostic('event-update-retry-missing-local-event', {
          eventId: pendingUpdate.eventId,
          notebookId,
          userId,
        })
        continue
      }

      await syncPendingUpdatedEvent(pendingUpdate.eventId)
    }
  }

  function getPendingRemoteEventUpdateIds(): Set<string> {
    return getQueuedPendingRemoteEventUpdateIds({
      notebookId: getRemoteNotebookId(),
      userId: remoteAuth.user.value?.id,
    })
  }

  async function retryPendingRemoteEventDeletes(): Promise<void> {
    const notebookId = getRemoteNotebookId()
    const userId = remoteAuth.user.value?.id

    if (!notebookId || !userId) {
      return
    }

    const pendingDeletes = getPendingRemoteEventDeletes({
      notebookId,
      userId,
    })

    for (const pendingDelete of pendingDeletes) {
      await syncPendingDeletedEvent(pendingDelete.eventId)
    }
  }

  function getPendingRemoteEventDeleteIds(): Set<string> {
    return getQueuedPendingRemoteEventDeleteIds({
      notebookId: getRemoteNotebookId(),
      userId: remoteAuth.user.value?.id,
    })
  }

  async function syncPendingCreatedEvent(localEventId: string): Promise<void> {
    const event = eventsById.value.get(localEventId)
    const notebookId = getRemoteNotebookId()
    const userId = remoteAuth.user.value?.id ?? ''

    if (!event || !shouldSyncRemoteEvent(event) || !userId) {
      return
    }

    if (syncingCreatedEventIds.has(event.id)) {
      return
    }

    syncingCreatedEventIds.add(event.id)
    markRemoteEventCreateAttempt({
      eventId: event.id,
      notebookId,
      userId,
    })

    recordSyncDiagnostic('event-create-start', {
      eventId: event.id,
      catId: event.catId,
      categoryId: event.categoryId,
      notebookId,
      userId: remoteAuth.user.value?.id,
      notebookRole: remoteAuth.activeNotebookRole.value,
      createdAt: event.createdAt,
      occurredAt: event.occurredAt,
    })

    try {
      const remoteEvent = await createRemoteCatEvent(event, notebookId, userId)
      const eventIndex = events.value.findIndex((item) => item.id === localEventId)

      if (eventIndex < 0) {
        return
      }

      events.value[eventIndex] = remoteEvent

      eventEditorStore.replaceEventId(localEventId, remoteEvent.id)

      removeRemoteEventCreate({
        eventId: localEventId,
        notebookId,
        userId,
      })
      touchRemoteEventSyncQueue()
      recordSyncDiagnostic('event-create-success', {
        eventId: remoteEvent.id,
        localEventId,
        notebookId,
        userId,
        notebookRole: remoteAuth.activeNotebookRole.value,
        createdAt: remoteEvent.createdAt,
        updatedAt: remoteEvent.updatedAt,
      })
      remoteEventSyncError.value = ''
    } catch (error: unknown) {
      const errorInfo = getSyncDiagnosticErrorInfo(error)

      markRemoteEventCreateFailure({
        eventId: event.id,
        notebookId,
        userId,
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
        },
      })
      touchRemoteEventSyncQueue()
      recordSyncDiagnostic('event-create-failure', {
        eventId: event.id,
        catId: event.catId,
        categoryId: event.categoryId,
        notebookId,
        userId,
        notebookRole: remoteAuth.activeNotebookRole.value,
        createdAt: event.createdAt,
        occurredAt: event.occurredAt,
        error: errorInfo,
      })
      setRemoteEventSyncError(getSyncErrorMessage(error, '事件同步失敗'))
    } finally {
      syncingCreatedEventIds.delete(event.id)
    }
  }

  async function syncPendingUpdatedEvent(eventId: string): Promise<void> {
    const event = eventsById.value.get(eventId)
    const notebookId = getRemoteNotebookId()
    const userId = remoteAuth.user.value?.id ?? ''
    const pendingUpdate = getPendingRemoteEventUpdate({
      eventId,
      notebookId,
      userId,
    })

    if (!event || !isRemoteUuid(event.id) || !shouldSyncRemoteEvent(event) || !userId) {
      return
    }

    if (!pendingUpdate || syncingUpdatedEventIds.has(event.id)) {
      return
    }

    syncingUpdatedEventIds.add(event.id)
    markRemoteEventUpdateAttempt({
      eventId: event.id,
      notebookId,
      userId,
    })

    recordSyncDiagnostic('event-update-start', {
      eventId: event.id,
      catId: event.catId,
      categoryId: event.categoryId,
      notebookId,
      userId,
      notebookRole: remoteAuth.activeNotebookRole.value,
      expectedUpdatedAt: pendingUpdate.expectedUpdatedAt,
      updatedAt: event.updatedAt,
      occurredAt: event.occurredAt,
    })

    try {
      const remoteEvent = await updateRemoteCatEvent(event, notebookId, pendingUpdate.expectedUpdatedAt)
      const eventIndex = events.value.findIndex((item) => item.id === eventId)

      if (eventIndex < 0) {
        return
      }

      events.value[eventIndex] = remoteEvent

      removeRemoteEventUpdate({
        eventId,
        notebookId,
        userId,
      })
      touchRemoteEventSyncQueue()
      recordSyncDiagnostic('event-update-success', {
        eventId: remoteEvent.id,
        notebookId,
        userId,
        notebookRole: remoteAuth.activeNotebookRole.value,
        updatedAt: remoteEvent.updatedAt,
      })
      remoteEventSyncError.value = ''
    } catch (error: unknown) {
      const errorInfo = getSyncDiagnosticErrorInfo(error)

      markRemoteEventUpdateFailure({
        eventId: event.id,
        notebookId,
        userId,
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
        },
      })
      touchRemoteEventSyncQueue()
      recordSyncDiagnostic('event-update-failure', {
        eventId: event.id,
        catId: event.catId,
        categoryId: event.categoryId,
        notebookId,
        userId,
        notebookRole: remoteAuth.activeNotebookRole.value,
        expectedUpdatedAt: pendingUpdate.expectedUpdatedAt,
        updatedAt: event.updatedAt,
        occurredAt: event.occurredAt,
        error: errorInfo,
      })
      setRemoteEventSyncError(
        error instanceof RemoteCatEventConflictError
          ? error.message
          : getSyncErrorMessage(error, '事件同步失敗'),
      )
    } finally {
      syncingUpdatedEventIds.delete(event.id)
    }
  }

  async function syncPendingDeletedEvent(eventId: string): Promise<void> {
    const notebookId = getRemoteNotebookId()
    const userId = remoteAuth.user.value?.id ?? ''
    const pendingDelete = getPendingRemoteEventDeletes({
      notebookId,
      userId,
    }).find((item) => item.eventId === eventId)

    if (!notebookId || !userId || !pendingDelete) {
      return
    }

    if (syncingDeletedEventIds.has(eventId)) {
      return
    }

    syncingDeletedEventIds.add(eventId)
    markRemoteEventDeleteAttempt({
      eventId,
      notebookId,
      userId,
    })

    recordSyncDiagnostic('event-delete-start', {
      eventId,
      notebookId,
      userId,
      notebookRole: remoteAuth.activeNotebookRole.value,
      expectedUpdatedAt: pendingDelete.expectedUpdatedAt,
    })

    try {
      await deleteRemoteCatEvent(eventId, notebookId, pendingDelete.expectedUpdatedAt)
      if (pendingDelete.photoPaths.length) {
        await deleteEventPhotoPaths(pendingDelete.photoPaths)
      }

      removeRemoteEventDelete({
        eventId,
        notebookId,
        userId,
      })
      touchRemoteEventSyncQueue()
      recordSyncDiagnostic('event-delete-success', {
        eventId,
        notebookId,
        userId,
        notebookRole: remoteAuth.activeNotebookRole.value,
      })
      remoteEventSyncError.value = ''
    } catch (error: unknown) {
      if (error instanceof RemoteCatEventConflictError) {
        removeRemoteEventDelete({
          eventId,
          notebookId,
          userId,
        })
        touchRemoteEventSyncQueue()
        recordSyncDiagnostic('event-delete-success', {
          eventId,
          notebookId,
          userId,
          notebookRole: remoteAuth.activeNotebookRole.value,
          resolvedConflict: true,
        })
        remoteEventSyncError.value = ''
        return
      }

      const errorInfo = getSyncDiagnosticErrorInfo(error)

      markRemoteEventDeleteFailure({
        eventId,
        notebookId,
        userId,
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
        },
      })
      touchRemoteEventSyncQueue()
      recordSyncDiagnostic('event-delete-failure', {
        eventId,
        notebookId,
        userId,
        notebookRole: remoteAuth.activeNotebookRole.value,
        expectedUpdatedAt: pendingDelete.expectedUpdatedAt,
        error: errorInfo,
      })
      setRemoteEventSyncError(getSyncErrorMessage(error, '事件同步失敗'))
    } finally {
      syncingDeletedEventIds.delete(eventId)
    }
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

  function touchRemoteEventSyncQueue(): void {
    remoteEventSyncQueueRevision.value += 1
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
    remoteEventSyncQueueSummary,
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
    retryPendingRemoteEventCreates,
    retryPendingRemoteEventUpdates,
    retryPendingRemoteEventDeletes,
    getPendingRemoteEventCreateIds,
    getPendingRemoteEventUpdateIds,
    getPendingRemoteEventDeleteIds,
    canModifyEvent,
    openEditEvent,
    closeEditEvent,
    openDeleteConfirm,
    cancelDeleteEvent,
    confirmDeleteEvent,
  }
})
