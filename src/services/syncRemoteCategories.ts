import { supabase } from '@/lib/supabase'
import {
  fromEventCategoryRow,
  toInsertEventCategoryRow,
  type SupabaseEventCategoryRow,
} from '@/repositories/supabaseCatTrackerMapper'
import type { EventCategory } from '@/types'

export async function createRemoteCategory(
  category: EventCategory,
  notebookId: string,
): Promise<EventCategory> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('event_categories')
    .insert(toInsertEventCategoryRow(category, notebookId))
    .select('*')
    .single<SupabaseEventCategoryRow>()

  if (error) {
    throw error
  }

  return fromEventCategoryRow(data)
}

export async function updateRemoteCategory(
  category: EventCategory,
  notebookId: string,
): Promise<EventCategory> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('event_categories')
    .update({
      template_id: category.templateId ?? null,
      name: category.name,
      group_name: category.group ?? null,
      color_id: category.colorId ?? 'teal',
      icon: category.icon ?? null,
      is_default: category.isDefault,
      is_quick_action: category.isQuickAction,
      is_archived: category.isArchived,
      sort_order: category.sortOrder,
      statistics_mode: category.statisticsMode,
      value_label: category.valueLabel ?? null,
      value_max: category.valueMax ?? null,
      value_unit: category.valueUnit ?? null,
    })
    .eq('id', category.id)
    .eq('notebook_id', notebookId)
    .select('*')
    .single<SupabaseEventCategoryRow>()

  if (error) {
    throw error
  }

  return fromEventCategoryRow(data)
}

export async function deleteRemoteCategory(categoryId: string, notebookId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { error } = await supabase
    .from('event_categories')
    .delete()
    .eq('id', categoryId)
    .eq('notebook_id', notebookId)

  if (error) {
    throw error
  }
}
