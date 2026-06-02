import { supabase } from '@/lib/supabase'
import {
  toInsertCatEventRow,
  toInsertCatRow,
  toInsertEventCategoryRow,
  type ImportedIdMap,
} from '@/repositories/supabaseCatTrackerMapper'
import type { SignedOutDeletedEvent } from '@/services/localUnsyncedChanges'
import type { Cat, CatEvent, EventCategory } from '@/types'

interface MergeUnsyncedLocalCatTrackerInput {
  notebookId: string
  cats: Cat[]
  categories: EventCategory[]
  events: CatEvent[]
  deletedEvents: SignedOutDeletedEvent[]
  createdBy: string | null
  notebookRole: string
}

export interface MergeUnsyncedLocalCatTrackerResult {
  catsMerged: number
  categoriesMerged: number
  eventsMerged: number
  eventsDeleted: number
  eventsSkipped: number
}

export async function mergeUnsyncedLocalCatTracker({
  notebookId,
  cats,
  categories,
  events,
  deletedEvents,
  createdBy,
  notebookRole,
}: MergeUnsyncedLocalCatTrackerInput): Promise<MergeUnsyncedLocalCatTrackerResult> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  if (!notebookId) {
    throw new Error('Notebook 尚未建立完成')
  }

  const canManageNotebookData = notebookRole === 'owner'
  let catsMerged = 0
  let categoriesMerged = 0

  if (canManageNotebookData) {
    for (const cat of cats) {
      const { error } = await supabase
        .from('cats')
        .upsert(toInsertCatRow(cat, notebookId), { onConflict: 'id' })

      if (error) {
        throw error
      }

      catsMerged += 1
    }

    for (const category of categories) {
      const { error } = await supabase
        .from('event_categories')
        .upsert(toInsertEventCategoryRow(category, notebookId), { onConflict: 'id' })

      if (error) {
        throw error
      }

      categoriesMerged += 1
    }
  }

  const idMap: ImportedIdMap = {
    catIds: new Map(cats.map((cat) => [cat.id, cat.id])),
    categoryIds: new Map(categories.map((category) => [category.id, category.id])),
  }
  let eventsMerged = 0
  let eventsSkipped = 0

  for (const event of events) {
    if (!canManageNotebookData && event.createdBy && event.createdBy !== createdBy) {
      eventsSkipped += 1
      continue
    }

    const eventRow = toInsertCatEventRow(event, notebookId, idMap, event.createdBy ?? createdBy)

    if (!eventRow) {
      eventsSkipped += 1
      continue
    }

    const { error } = await supabase
      .from('cat_events')
      .upsert(eventRow, { onConflict: 'id' })

    if (error) {
      throw error
    }

    eventsMerged += 1
  }

  let eventsDeleted = 0

  for (const deletedEvent of deletedEvents) {
    if (!canManageNotebookData && deletedEvent.createdBy && deletedEvent.createdBy !== createdBy) {
      eventsSkipped += 1
      continue
    }

    const { error } = await supabase
      .from('cat_events')
      .delete()
      .eq('id', deletedEvent.id)
      .eq('notebook_id', notebookId)

    if (error) {
      throw error
    }

    eventsDeleted += 1
  }

  return {
    catsMerged,
    categoriesMerged,
    eventsMerged,
    eventsDeleted,
    eventsSkipped,
  }
}
