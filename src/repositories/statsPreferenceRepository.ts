import { supabase } from '@/lib/supabase'
import { readJson, writeJson } from '@/utils/storage'

const STORAGE_KEY = 'meownote:stats-preferences:v1'

export interface StatsPreference {
  categoryIds: string[]
}

type StoredStatsPreferences = Record<string, StatsPreference>

interface StatsPreferenceRow {
  category_ids: string[]
}

function normalizeCategoryIds(categoryIds: unknown): string[] {
  return Array.isArray(categoryIds)
    ? [...new Set(categoryIds.filter((categoryId) => typeof categoryId === 'string'))]
    : []
}

export function loadStatsPreference(scopeKey: string): StatsPreference {
  const preferences = readJson<StoredStatsPreferences>(STORAGE_KEY, {})
  const preference = preferences[scopeKey]

  return {
    categoryIds: normalizeCategoryIds(preference?.categoryIds),
  }
}

export function saveStatsPreference(scopeKey: string, preference: StatsPreference): void {
  const preferences = readJson<StoredStatsPreferences>(STORAGE_KEY, {})

  preferences[scopeKey] = {
    categoryIds: normalizeCategoryIds(preference.categoryIds),
  }

  writeJson(STORAGE_KEY, preferences)
}

export async function loadSyncedStatsPreference({
  scopeKey,
  userId,
  notebookId,
}: {
  scopeKey: string
  userId?: string
  notebookId?: string
}): Promise<StatsPreference> {
  const localPreference = loadStatsPreference(scopeKey)

  if (!supabase || !userId || !notebookId) {
    return localPreference
  }

  const { data, error } = await supabase
    .from('user_stat_preferences')
    .select('category_ids')
    .eq('user_id', userId)
    .eq('notebook_id', notebookId)
    .maybeSingle<StatsPreferenceRow>()

  if (error) {
    throw error
  }

  if (data) {
    const remotePreference = {
      categoryIds: normalizeCategoryIds(data.category_ids),
    }

    saveStatsPreference(scopeKey, remotePreference)
    return remotePreference
  }

  if (localPreference.categoryIds.length > 0) {
    await saveSyncedStatsPreference({
      scopeKey,
      userId,
      notebookId,
      preference: localPreference,
    })
  }

  return localPreference
}

export async function saveSyncedStatsPreference({
  scopeKey,
  userId,
  notebookId,
  preference,
}: {
  scopeKey: string
  userId?: string
  notebookId?: string
  preference: StatsPreference
}): Promise<void> {
  const normalizedPreference = {
    categoryIds: normalizeCategoryIds(preference.categoryIds),
  }

  saveStatsPreference(scopeKey, normalizedPreference)

  if (!supabase || !userId || !notebookId) {
    return
  }

  const { error } = await supabase.from('user_stat_preferences').upsert(
    {
      user_id: userId,
      notebook_id: notebookId,
      category_ids: normalizedPreference.categoryIds,
    },
    {
      onConflict: 'user_id,notebook_id',
    },
  )

  if (error) {
    throw error
  }
}
