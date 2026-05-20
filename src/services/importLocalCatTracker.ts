import { supabase } from '@/lib/supabase'
import {
  type ImportedIdMap,
  type SupabaseCatRow,
  type SupabaseEventCategoryRow,
  toInsertCatEventRow,
  toInsertCatRow,
  toInsertEventCategoryRow,
} from '@/repositories/supabaseCatTrackerMapper'
import type { Cat, CatEvent, EventCategory } from '@/types'

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
    const { data, error } = await supabase
      .from('cats')
      .insert(toInsertCatRow(cat, notebookId))
      .select('*')
      .single<SupabaseCatRow>()

    if (error) {
      throw error
    }

    idMap.catIds.set(cat.id, data.id)
  }

  for (const category of categories) {
    const { data, error } = await supabase
      .from('event_categories')
      .insert(toInsertEventCategoryRow(category, notebookId))
      .select('*')
      .single<SupabaseEventCategoryRow>()

    if (error) {
      throw error
    }

    idMap.categoryIds.set(category.id, data.id)
  }

  const eventRows = events
    .map((event) => toInsertCatEventRow(event, notebookId, idMap, createdBy))
    .filter((eventRow) => eventRow !== undefined)
  const eventsSkipped = events.length - eventRows.length

  if (eventRows.length > 0) {
    const { error } = await supabase.from('cat_events').insert(eventRows)

    if (error) {
      throw error
    }
  }

  return {
    catsImported: idMap.catIds.size,
    categoriesImported: idMap.categoryIds.size,
    eventsImported: eventRows.length,
    eventsSkipped,
  }
}

async function assertNotebookIsEmpty(notebookId: string): Promise<void> {
  const [catCount, categoryCount, eventCount] = await Promise.all([
    getNotebookTableCount('cats', notebookId),
    getNotebookTableCount('event_categories', notebookId),
    getNotebookTableCount('cat_events', notebookId),
  ])

  if (catCount + categoryCount + eventCount > 0) {
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
