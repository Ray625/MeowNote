import { supabase } from '@/lib/supabase'
import {
  fromCatEventRow,
  fromCatRow,
  fromEventCategoryRow,
  type SupabaseCatEventRow,
  type SupabaseCatRow,
  type SupabaseEventCategoryRow,
} from '@/repositories/supabaseCatTrackerMapper'
import type { Cat, CatEvent, EventCategory } from '@/types'

const REMOTE_PAGE_SIZE = 1000

export interface RemoteCatTrackerState {
  cats: Cat[]
  categories: EventCategory[]
  events: CatEvent[]
  selectedCatId: string
}

export async function loadRemoteCatTracker(notebookId: string): Promise<RemoteCatTrackerState> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  if (!notebookId) {
    throw new Error('Notebook 尚未建立完成')
  }

  const [cats, categories, events] = await Promise.all([
    loadCats(notebookId),
    loadCategories(notebookId),
    loadEvents(notebookId),
  ])

  return {
    cats,
    categories,
    events,
    selectedCatId: cats.find((cat) => !cat.isArchived)?.id ?? cats[0]?.id ?? '',
  }
}

async function loadCats(notebookId: string): Promise<Cat[]> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const rows = await loadNotebookRows<SupabaseCatRow>('cats', notebookId, 'created_at')

  return rows.map(fromCatRow)
}

async function loadCategories(notebookId: string): Promise<EventCategory[]> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const rows = await loadNotebookRows<SupabaseEventCategoryRow>(
    'event_categories',
    notebookId,
    'sort_order',
  )

  return rows.map(fromEventCategoryRow)
}

async function loadEvents(notebookId: string): Promise<CatEvent[]> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const rows = await loadNotebookRows<SupabaseCatEventRow>('cat_events', notebookId, 'occurred_at')

  return rows.map(fromCatEventRow)
}

async function loadNotebookRows<Row>(
  tableName: 'cat_events' | 'cats' | 'event_categories',
  notebookId: string,
  orderColumn: string,
): Promise<Row[]> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const rows: Row[] = []

  for (let page = 0; ; page += 1) {
    const from = page * REMOTE_PAGE_SIZE
    const to = from + REMOTE_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('notebook_id', notebookId)
      .order(orderColumn, { ascending: true })
      .range(from, to)
      .returns<Row[]>()

    if (error) {
      throw error
    }

    rows.push(...data)

    if (data.length < REMOTE_PAGE_SIZE) {
      return rows
    }
  }
}
