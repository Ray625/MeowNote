import { readonly, ref } from 'vue'
import { importLocalCatTracker, isRemoteNotebookEmpty } from '@/services/importLocalCatTracker'
import { loadRemoteCatTracker } from '@/services/loadRemoteCatTracker'
import {
  clearSignedOutNotebookCache,
  getPendingSignedOutNotebookChanges,
  type SignedOutNotebookCacheMeta,
} from '@/services/localUnsyncedChanges'
import { mergeUnsyncedLocalCatTracker } from '@/services/mergeUnsyncedLocalCatTracker'
import type { useCatTrackerStore } from '@/stores/catTracker'
import { readJson, writeJson } from '@/utils/storage'

const MIN_REFRESH_INTERVAL_MS = 30_000
const LOCAL_IMPORT_CONSIDERED_USERS_STORAGE_KEY = 'meownote:local-import-considered-users'

const isRefreshingRemoteData = ref(false)
const isBootstrappingRemoteData = ref(false)
const remoteRefreshError = ref('')
const pendingUnsyncedLocalChanges = ref<SignedOutNotebookCacheMeta | null>(null)
const notebookIdsSkippingLocalImport = new Set<string>()
let lastRefreshAt = 0

interface BootstrapRemoteCatTrackerOptions {
  notebookRole?: string
  userId: string | null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string') {
      return message
    }
  }

  return '刷新雲端資料失敗'
}

export function skipNextLocalImportForNotebook(notebookId: string): void {
  if (notebookId) {
    notebookIdsSkippingLocalImport.add(notebookId)
  }
}

function hasConsideredLocalImport(userId: string | null): boolean {
  if (!userId) {
    return true
  }

  return readJson<string[]>(LOCAL_IMPORT_CONSIDERED_USERS_STORAGE_KEY, []).includes(userId)
}

function markLocalImportConsidered(userId: string | null): void {
  if (!userId) {
    return
  }

  const consideredUserIds = readJson<string[]>(LOCAL_IMPORT_CONSIDERED_USERS_STORAGE_KEY, [])

  if (consideredUserIds.includes(userId)) {
    return
  }

  writeJson(LOCAL_IMPORT_CONSIDERED_USERS_STORAGE_KEY, [...consideredUserIds, userId])
}

export function useRemoteCatTrackerRefresh() {
  async function bootstrapRemoteCatTracker(
    catTrackerStore: ReturnType<typeof useCatTrackerStore>,
    notebookId: string,
    options: BootstrapRemoteCatTrackerOptions,
  ): Promise<void> {
    if (!notebookId || isBootstrappingRemoteData.value) {
      return
    }

    isBootstrappingRemoteData.value = true

    try {
      const localCats = [...catTrackerStore.cats]
      const localCategories = [...catTrackerStore.categories]
      const localEvents = [...catTrackerStore.events]
      const pendingSignedOutChanges = getPendingSignedOutNotebookChanges({
        userId: options.userId,
        notebookId,
      })

      if (pendingSignedOutChanges) {
        pendingUnsyncedLocalChanges.value = pendingSignedOutChanges
        remoteRefreshError.value = ''
        return
      }

      if (pendingUnsyncedLocalChanges.value?.notebookId !== notebookId) {
        pendingUnsyncedLocalChanges.value = null
      }

      const hasLocalUserData = localCats.length > 0 || localEvents.length > 0
      const shouldSkipLocalImport = notebookIdsSkippingLocalImport.has(notebookId)
      const canImportLocalData =
        !shouldSkipLocalImport &&
        options.notebookRole === 'owner' &&
        !hasConsideredLocalImport(options.userId)

      if (canImportLocalData && hasLocalUserData && (await isRemoteNotebookEmpty(notebookId))) {
        await importLocalCatTracker({
          notebookId,
          cats: localCats,
          categories: localCategories,
          events: localEvents,
          createdBy: options.userId,
        })
      }

      notebookIdsSkippingLocalImport.delete(notebookId)
      await refreshRemoteCatTracker(catTrackerStore, notebookId, { force: true })
      markLocalImportConsidered(options.userId)
    } catch (error) {
      remoteRefreshError.value = getErrorMessage(error)
    } finally {
      isBootstrappingRemoteData.value = false
    }
  }

  async function refreshRemoteCatTracker(
    catTrackerStore: ReturnType<typeof useCatTrackerStore>,
    notebookId: string,
    options: { force?: boolean } = {},
  ): Promise<void> {
    if (!notebookId || isRefreshingRemoteData.value) {
      return
    }

    if (pendingUnsyncedLocalChanges.value?.notebookId === notebookId) {
      return
    }

    const now = Date.now()

    if (!options.force && now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
      return
    }

    isRefreshingRemoteData.value = true

    try {
      const remoteState = await loadRemoteCatTracker(notebookId)
      catTrackerStore.replacePersistedState(remoteState)
      lastRefreshAt = Date.now()
      remoteRefreshError.value = ''
    } catch (error) {
      remoteRefreshError.value = getErrorMessage(error)
    } finally {
      isRefreshingRemoteData.value = false
    }
  }

  async function mergePendingLocalChangesToRemote(
    catTrackerStore: ReturnType<typeof useCatTrackerStore>,
  ): Promise<void> {
    const pendingChanges = pendingUnsyncedLocalChanges.value

    if (!pendingChanges || isBootstrappingRemoteData.value) {
      return
    }

    isBootstrappingRemoteData.value = true

    try {
      await mergeUnsyncedLocalCatTracker({
        notebookId: pendingChanges.notebookId,
        cats: [...catTrackerStore.cats],
        categories: [...catTrackerStore.categories],
        events: [...catTrackerStore.events],
        deletedEvents: pendingChanges.deletedEvents ?? [],
        createdBy: pendingChanges.userId,
        notebookRole: pendingChanges.notebookRole,
      })
      pendingUnsyncedLocalChanges.value = null
      clearSignedOutNotebookCache()
      await refreshRemoteCatTracker(catTrackerStore, pendingChanges.notebookId, { force: true })
      remoteRefreshError.value = ''
    } catch (error) {
      remoteRefreshError.value = getErrorMessage(error)
    } finally {
      isBootstrappingRemoteData.value = false
    }
  }

  async function replacePendingLocalChangesWithRemote(
    catTrackerStore: ReturnType<typeof useCatTrackerStore>,
  ): Promise<void> {
    const pendingChanges = pendingUnsyncedLocalChanges.value

    if (!pendingChanges) {
      return
    }

    pendingUnsyncedLocalChanges.value = null
    clearSignedOutNotebookCache()
    await refreshRemoteCatTracker(catTrackerStore, pendingChanges.notebookId, { force: true })
  }

  return {
    bootstrapRemoteCatTracker,
    isBootstrappingRemoteData: readonly(isBootstrappingRemoteData),
    isRefreshingRemoteData: readonly(isRefreshingRemoteData),
    mergePendingLocalChangesToRemote,
    pendingUnsyncedLocalChanges: readonly(pendingUnsyncedLocalChanges),
    remoteRefreshError: readonly(remoteRefreshError),
    replacePendingLocalChangesWithRemote,
    refreshRemoteCatTracker,
  }
}
