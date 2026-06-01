import { supabase } from '@/lib/supabase'
import {
  type ImportedIdMap,
  type SupabaseCatRow,
  type SupabaseEventCategoryRow,
  toInsertCatEventRow,
  toInsertCatRow,
  toInsertEventCategoryRow,
  type InsertCatEventRow,
  type InsertCatRow,
  type InsertEventCategoryRow,
} from '@/repositories/supabaseCatTrackerMapper'
import type { Cat, CatEvent, EventCategory } from '@/types'
import { createId } from '@/utils/id'

interface ImportLocalCatTrackerInput {
  notebookId: string
  cats: Cat[]
  categories: EventCategory[]
  events: CatEvent[]
  createdBy: string | null
}

export interface ImportLocalCatTrackerResult {
  catsImported: number
  categoriesImported: number
  eventsImported: number
  eventsSkipped: number
}

export async function importLocalCatTracker({
  notebookId,
  cats,
  categories,
  events,
  createdBy,
}: ImportLocalCatTrackerInput): Promise<ImportLocalCatTrackerResult> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  if (!notebookId) {
    throw new Error('Notebook 尚未建立完成')
  }

  await assertNotebookIsEmpty(notebookId)

  const idMap: ImportedIdMap = {
    catIds: new Map(),
    categoryIds: new Map(),
  }

  for (const cat of cats) {
    const data = await insertCatWithUniqueId(toInsertCatRow(cat, notebookId))

    idMap.catIds.set(cat.id, data.id)
  }

  for (const category of categories) {
    const data = await insertCategoryWithUniqueId(toInsertEventCategoryRow(category, notebookId))

    idMap.categoryIds.set(category.id, data.id)
  }

  const eventRows = events
    .map((event) => toInsertCatEventRow(event, notebookId, idMap, createdBy))
    .filter((eventRow) => eventRow !== undefined)
  const eventsSkipped = events.length - eventRows.length

  let eventsImported = 0

  for (const eventRow of eventRows) {
    await insertEventWithUniqueId(eventRow)
    eventsImported += 1
  }

  return {
    catsImported: idMap.catIds.size,
    categoriesImported: idMap.categoryIds.size,
    eventsImported,
    eventsSkipped,
  }
}

async function insertCatWithUniqueId(row: InsertCatRow): Promise<SupabaseCatRow> {
  const { data, error } = await supabase!
    .from('cats')
    .insert(row)
    .select('*')
    .single<SupabaseCatRow>()

  if (!error) {
    return data
  }

  if (!isUniqueConstraintError(error)) {
    throw error
  }

  const retryRow = {
    ...row,
    id: createId('cat'),
  }
  const retry = await supabase!
    .from('cats')
    .insert(retryRow)
    .select('*')
    .single<SupabaseCatRow>()

  if (retry.error) {
    throw retry.error
  }

  return retry.data
}

async function insertCategoryWithUniqueId(row: InsertEventCategoryRow): Promise<SupabaseEventCategoryRow> {
  const { data, error } = await supabase!
    .from('event_categories')
    .insert(row)
    .select('*')
    .single<SupabaseEventCategoryRow>()

  if (!error) {
    return data
  }

  if (!isUniqueConstraintError(error)) {
    throw error
  }

  const retryRow = {
    ...row,
    id: createId('category'),
  }
  const retry = await supabase!
    .from('event_categories')
    .insert(retryRow)
    .select('*')
    .single<SupabaseEventCategoryRow>()

  if (retry.error) {
    throw retry.error
  }

  return retry.data
}

async function insertEventWithUniqueId(row: InsertCatEventRow): Promise<void> {
  const { error } = await supabase!.from('cat_events').insert(row)

  if (!error) {
    return
  }

  if (!isUniqueConstraintError(error)) {
    throw error
  }

  const retryRow = {
    ...row,
    id: createId('event'),
  }
  const retry = await supabase!.from('cat_events').insert(retryRow)

  if (retry.error) {
    throw retry.error
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505',
  )
}

export async function isRemoteNotebookEmpty(notebookId: string): Promise<boolean> {
  const [catCount, categoryCount, eventCount] = await Promise.all([
    getNotebookTableCount('cats', notebookId),
    getNotebookTableCount('event_categories', notebookId),
    getNotebookTableCount('cat_events', notebookId),
  ])

  return catCount + categoryCount + eventCount === 0
}

async function assertNotebookIsEmpty(notebookId: string): Promise<void> {
  if (!(await isRemoteNotebookEmpty(notebookId))) {
    throw new Error('遠端同步空間已有資料，為避免重複匯入，已取消匯入。')
  }
}

async function getNotebookTableCount(
  tableName: 'cats' | 'cat_events' | 'event_categories',
  notebookId: string,
): Promise<number> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { count, error } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('notebook_id', notebookId)

  if (error) {
    throw error
  }

  return count ?? 0
}
