import { ensureDefaultCategories } from '@/constants/defaultData'
import type { Cat, CatEvent, EventCategory } from '@/types'
import { getIsoNow } from '@/utils/datetime'
import { createId, isUuid } from '@/utils/id'
import { readJson, writeJson } from '@/utils/storage'

const STORAGE_KEY = 'meownote:v1'
const LEGACY_STORAGE_KEY = 'cat-log:v1'

export interface CatTrackerState {
  cats: Cat[]
  categories: EventCategory[]
  events: CatEvent[]
  selectedCatId: string
}

export interface CatTrackerRepository {
  loadState(): CatTrackerState
  saveState(state: CatTrackerState): void
}

function createInitialState(): CatTrackerState {
  return {
    cats: [],
    categories: [],
    events: [],
    selectedCatId: '',
  }
}

function normalizeState(state: CatTrackerState): CatTrackerState {
  const fallbackState = createInitialState()
  const cats = state.cats.map(normalizeCat)
  const categories =
    state.categories.length > 0
      ? ensureDefaultCategories(state.categories, getIsoNow())
      : fallbackState.categories
  const selectedCatId = cats.some((cat) => cat.id === state.selectedCatId)
    ? state.selectedCatId
    : (cats[0]?.id ?? '')

  return {
    ...migrateLegacyIds({
      cats,
      categories,
      events: state.events,
      selectedCatId,
    }),
  }
}

function normalizeCat(cat: Cat): Cat {
  return {
    ...cat,
    isArchived: cat.isArchived ?? false,
  }
}

function migrateLegacyIds(state: CatTrackerState): CatTrackerState {
  const catIds = createLegacyIdMap(state.cats.map((cat) => cat.id))
  const categoryIds = createLegacyIdMap(state.categories.map((category) => category.id))
  const eventIds = createLegacyIdMap(state.events.map((event) => event.id))

  if (catIds.size === 0 && categoryIds.size === 0 && eventIds.size === 0) {
    return state
  }

  return {
    cats: state.cats.map((cat) => ({
      ...cat,
      id: catIds.get(cat.id) ?? cat.id,
    })),
    categories: state.categories.map((category) => ({
      ...category,
      id: categoryIds.get(category.id) ?? category.id,
    })),
    events: state.events.map((event) => ({
      ...event,
      id: eventIds.get(event.id) ?? event.id,
      catId: catIds.get(event.catId) ?? event.catId,
      categoryId: categoryIds.get(event.categoryId) ?? event.categoryId,
    })),
    selectedCatId: catIds.get(state.selectedCatId) ?? state.selectedCatId,
  }
}

function createLegacyIdMap(ids: string[]): Map<string, string> {
  return new Map(ids.filter((id) => id && !isUuid(id)).map((id) => [id, createId()] as const))
}

class LocalStorageCatTrackerRepository implements CatTrackerRepository {
  loadState(): CatTrackerState {
    return normalizeState(
      readJson<CatTrackerState>(
        STORAGE_KEY,
        readJson<CatTrackerState>(LEGACY_STORAGE_KEY, createInitialState()),
      ),
    )
  }

  saveState(state: CatTrackerState): void {
    writeJson<CatTrackerState>(STORAGE_KEY, state)
  }
}

export const catTrackerRepository: CatTrackerRepository = new LocalStorageCatTrackerRepository()
