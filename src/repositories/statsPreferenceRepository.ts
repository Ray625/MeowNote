import { readJson, writeJson } from '@/utils/storage'

const STORAGE_KEY = 'meownote:stats-preferences:v1'

export interface StatsPreference {
  categoryIds: string[]
}

type StoredStatsPreferences = Record<string, StatsPreference>

export function loadStatsPreference(scopeKey: string): StatsPreference {
  const preferences = readJson<StoredStatsPreferences>(STORAGE_KEY, {})
  const preference = preferences[scopeKey]

  return {
    categoryIds: Array.isArray(preference?.categoryIds)
      ? preference.categoryIds.filter((categoryId) => typeof categoryId === 'string')
      : [],
  }
}

export function saveStatsPreference(scopeKey: string, preference: StatsPreference): void {
  const preferences = readJson<StoredStatsPreferences>(STORAGE_KEY, {})

  preferences[scopeKey] = {
    categoryIds: [...new Set(preference.categoryIds)],
  }

  writeJson(STORAGE_KEY, preferences)
}
