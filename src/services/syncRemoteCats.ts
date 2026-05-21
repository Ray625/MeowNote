import { supabase } from '@/lib/supabase'
import {
  fromCatRow,
  toInsertCatRow,
  type SupabaseCatRow,
} from '@/repositories/supabaseCatTrackerMapper'
import type { Cat } from '@/types'

export async function createRemoteCat(cat: Cat, notebookId: string): Promise<Cat> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('cats')
    .insert(toInsertCatRow(cat, notebookId))
    .select('*')
    .single<SupabaseCatRow>()

  if (error) {
    throw error
  }

  return fromCatRow(data)
}

export async function updateRemoteCat(cat: Cat, notebookId: string): Promise<Cat> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('cats')
    .update({
      name: cat.name,
      avatar_id: cat.avatarId ?? null,
      birthday: cat.birthday ?? null,
      sex: cat.sex ?? null,
      weight_kg: cat.weightKg ?? null,
      is_neutered: cat.isNeutered ?? null,
      note: cat.note ?? null,
      is_archived: cat.isArchived,
    })
    .eq('id', cat.id)
    .eq('notebook_id', notebookId)
    .select('*')
    .single<SupabaseCatRow>()

  if (error) {
    throw error
  }

  return fromCatRow(data)
}

export async function deleteRemoteCat(catId: string, notebookId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { error } = await supabase
    .from('cats')
    .delete()
    .eq('id', catId)
    .eq('notebook_id', notebookId)

  if (error) {
    throw error
  }
}
