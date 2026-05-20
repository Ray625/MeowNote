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

  const { data, error } = await supabase
    .from('cats')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: true })
    .returns<SupabaseCatRow[]>()

  if (error) {
    throw error
  }

  return data.map(fromCatRow)
}

async function loadCategories(notebookId: string): Promise<EventCategory[]> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('event_categories')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('sort_order', { ascending: true })
    .returns<SupabaseEventCategoryRow[]>()

  if (error) {
    throw error
  }

  return data.map(fromEventCategoryRow)
}

async function loadEvents(notebookId: string): Promise<CatEvent[]> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('cat_events')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('occurred_at', { ascending: true })
    .returns<SupabaseCatEventRow[]>()

  if (error) {
    throw error
  }

  return data.map(fromCatEventRow)
}
