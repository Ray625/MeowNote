import { createDefaultCategories, ensureDefaultCategories } from '@/constants/defaultData'
import type { Cat, CatEvent, EventCategory } from '@/types'
import { getIsoNow } from '@/utils/datetime'
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
  const now = getIsoNow()

  return {
    cats: [],
    categories: createDefaultCategories(now),
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
    cats,
    categories,
    events: state.events,
    selectedCatId,
  }
}

function normalizeCat(cat: Cat): Cat {
  return {
    ...cat,
    isArchived: cat.isArchived ?? false,
  }
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
