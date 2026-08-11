import { ensureDefaultCategories } from '@/constants/defaultData'
import type { Cat, CatEvent, EventCategory } from '@/types'
import { createId, isUuid } from '@/utils/id'
import { readJson, writeJson } from '@/utils/storage'

const STORAGE_KEY = 'meownote:v1'
const LEGACY_STORAGE_KEY = 'cat-log:v1'
const INDEXED_DB_NAME = 'meownote'
const INDEXED_DB_VERSION = 1
const INDEXED_DB_STORE_NAME = 'key-value'

export interface CatTrackerState {
  cats: Cat[]
  categories: EventCategory[]
  events: CatEvent[]
  selectedCatId: string
}

export interface CatTrackerRepository {
  loadState(): CatTrackerState
  loadStateAsync(): Promise<CatTrackerState>
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
      ? ensureDefaultCategories(state.categories)
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
    return loadLocalStorageState()
  }

  async loadStateAsync(): Promise<CatTrackerState> {
    const localStorageState = loadLocalStorageState()
    const indexedDbState = await readIndexedDbJson<CatTrackerState>(STORAGE_KEY).catch(
      () => undefined,
    )

    if (indexedDbState) {
      return normalizeState(indexedDbState)
    }

    await writeIndexedDbJson(STORAGE_KEY, localStorageState).catch(() => undefined)

    return localStorageState
  }

  saveState(state: CatTrackerState): void {
    const snapshot = cloneJson(state)

    void writeIndexedDbJson(STORAGE_KEY, snapshot).catch(() => {
      writeJson<CatTrackerState>(STORAGE_KEY, snapshot)
    })
  }
}

function loadLocalStorageState(): CatTrackerState {
  return normalizeState(
    readJson<CatTrackerState>(
      STORAGE_KEY,
      readJson<CatTrackerState>(LEGACY_STORAGE_KEY, createInitialState()),
    ),
  )
}

function readIndexedDbJson<T>(key: string): Promise<T | undefined> {
  return withIndexedDbStore('readonly', (store) => {
    const request = store.get(key)

    return requestToPromise<T | undefined>(request)
  })
}

function writeIndexedDbJson<T>(key: string, value: T): Promise<void> {
  return withIndexedDbStore('readwrite', (store) => {
    const request = store.put(value, key)

    return requestToPromise(request).then(() => undefined)
  })
}

async function withIndexedDbStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openIndexedDb()

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(INDEXED_DB_STORE_NAME, mode)
    const store = transaction.objectStore(INDEXED_DB_STORE_NAME)

    callback(store).then(resolve, reject)
    transaction.addEventListener('error', () => reject(transaction.error))
  }).finally(() => {
    database.close()
  })
}

function openIndexedDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION)

    request.addEventListener('upgradeneeded', () => {
      const database = request.result

      if (!database.objectStoreNames.contains(INDEXED_DB_STORE_NAME)) {
        database.createObjectStore(INDEXED_DB_STORE_NAME)
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const catTrackerRepository: CatTrackerRepository = new LocalStorageCatTrackerRepository()
