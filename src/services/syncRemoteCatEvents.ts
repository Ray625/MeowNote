import { supabase } from '@/lib/supabase'
import { fromCatEventRow, type SupabaseCatEventRow } from '@/repositories/supabaseCatTrackerMapper'
import type { CatEvent } from '@/types'

export function isRemoteUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function canSyncRemoteEvent(event: CatEvent, notebookId: string): boolean {
  return Boolean(notebookId && isRemoteUuid(event.catId) && isRemoteUuid(event.categoryId))
}

export async function createRemoteCatEvent(
  event: CatEvent,
  notebookId: string,
  createdBy: string | null,
): Promise<CatEvent> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('cat_events')
    .insert({
      id: event.id,
      notebook_id: notebookId,
      cat_id: event.catId,
      category_id: event.categoryId,
      occurred_at: event.occurredAt,
      title: event.title ?? null,
      severity: event.severity ?? null,
      note: event.note ?? null,
      values: event.values ?? {},
      created_by: createdBy,
    })
    .select('*')
    .single<SupabaseCatEventRow>()

  if (error) {
    throw error
  }

  return fromCatEventRow(data)
}

export async function updateRemoteCatEvent(event: CatEvent, notebookId: string): Promise<CatEvent> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('cat_events')
    .update({
      cat_id: event.catId,
      category_id: event.categoryId,
      occurred_at: event.occurredAt,
      title: event.title ?? null,
      severity: event.severity ?? null,
      note: event.note ?? null,
      values: event.values ?? {},
    })
    .eq('id', event.id)
    .eq('notebook_id', notebookId)
    .select('*')
    .single<SupabaseCatEventRow>()

  if (error) {
    throw error
  }

  return fromCatEventRow(data)
}

export async function deleteRemoteCatEvent(eventId: string, notebookId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { error } = await supabase
    .from('cat_events')
    .delete()
    .eq('id', eventId)
    .eq('notebook_id', notebookId)

  if (error) {
    throw error
  }
}
