import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  applyDefaultCategoryColor,
  createDefaultCat,
  createDefaultCategories,
  DEFAULT_CAT_ID,
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

function createInitialState(): CatTrackerState {
  const now = getIsoNow()

  return {
    cats: [createDefaultCat(now)],
    categories: createDefaultCategories(now),
    events: [],
    selectedCatId: DEFAULT_CAT_ID,
  }
}

function normalizeState(state: CatTrackerState): CatTrackerState {
  const fallbackState = createInitialState()
  const cats = state.cats.length > 0 ? state.cats : fallbackState.cats
  const categories =
    state.categories.length > 0
      ? state.categories.map((category) => applyDefaultCategoryColor(category))
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

  const cats = ref<Cat[]>(initialState.cats)
  const categories = ref<EventCategory[]>(initialState.categories)
  const events = ref<CatEvent[]>(initialState.events)
  const selectedCatId = ref(initialState.selectedCatId)

  const selectedCat = computed(() => cats.value.find((cat) => cat.id === selectedCatId.value))

  const quickActionCategories = computed(() =>
    categories.value.filter((category) => category.isQuickAction),
  )

  const todayEvents = computed(() =>
    events.value
      .filter((event) => isSameLocalDate(event.occurredAt))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
  )

  const eventsById = computed(() => new Map(events.value.map((event) => [event.id, event])))
  const categoriesById = computed(
    () => new Map(categories.value.map((category) => [category.id, category])),
  )
  const catsById = computed(() => new Map(cats.value.map((cat) => [cat.id, cat])))

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

  function quickRecord(categoryId: string): CatEvent | undefined {
    if (!selectedCat.value || !categoriesById.value.has(categoryId)) {
      return undefined
    }

    return createEvent({
      catId: selectedCat.value.id,
      categoryId,
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
    selectedCat,
    quickActionCategories,
    todayEvents,
    catsById,
    categoriesById,
    eventsById,
    selectCat,
    createCat,
    createCategory,
    createEvent,
    quickRecord,
    updateEvent,
    deleteEvent,
  }
})
