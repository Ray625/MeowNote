import { readonly, ref } from 'vue'
import { importLocalCatTracker, isRemoteNotebookEmpty } from '@/services/importLocalCatTracker'
import { loadRemoteCatTracker } from '@/services/loadRemoteCatTracker'
import {
  clearSignedOutNotebookCache,
  getPendingSignedOutNotebookChanges,
  type SignedOutNotebookCacheMeta,
} from '@/services/localUnsyncedChanges'
import { mergeUnsyncedLocalCatTracker } from '@/services/mergeUnsyncedLocalCatTracker'
import { recordSyncDiagnostic } from '@/services/syncDiagnostics'
import type { useCatTrackerStore } from '@/stores/catTracker'
import type { CatEvent } from '@/types'
import { readJson, writeJson } from '@/utils/storage'

const DEFAULT_MIN_REFRESH_INTERVAL_MS = 60_000
const REFRESH_REASON_INTERVAL_MS = {
  bootstrap: 0,
  foreground: 60_000,
  online: 30_000,
  view: 120_000,
  manual: 0,
} as const
const LOCAL_IMPORT_CONSIDERED_USERS_STORAGE_KEY = 'meownote:local-import-considered-users'

const isRefreshingRemoteData = ref(false)
const isBootstrappingRemoteData = ref(false)
const remoteRefreshError = ref('')
const pendingUnsyncedLocalChanges = ref<SignedOutNotebookCacheMeta | null>(null)
const notebookIdsSkippingLocalImport = new Set<string>()
const lastRefreshAtByNotebookId = new Map<string, number>()

type RemoteRefreshReason = keyof typeof REFRESH_REASON_INTERVAL_MS

interface BootstrapRemoteCatTrackerOptions {
  notebookRole?: string
  userId: string | null
}

interface RefreshRemoteCatTrackerOptions {
  force?: boolean
  minIntervalMs?: number
  reason?: RemoteRefreshReason
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
      await refreshRemoteCatTracker(catTrackerStore, notebookId, { force: true, reason: 'bootstrap' })
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
    options: RefreshRemoteCatTrackerOptions = {},
  ): Promise<void> {
    if (!notebookId || isRefreshingRemoteData.value) {
      return
    }

    if (pendingUnsyncedLocalChanges.value?.notebookId === notebookId) {
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return
    }

    const now = Date.now()
    const minIntervalMs =
      options.minIntervalMs ??
      REFRESH_REASON_INTERVAL_MS[options.reason ?? 'manual'] ??
      DEFAULT_MIN_REFRESH_INTERVAL_MS
    const lastRefreshAt = lastRefreshAtByNotebookId.get(notebookId) ?? 0

    if (!options.force && now - lastRefreshAt < minIntervalMs) {
      return
    }

    isRefreshingRemoteData.value = true

    try {
      await catTrackerStore.retryPendingRemoteEventCreates()
      await catTrackerStore.retryPendingRemoteEventUpdates()
      await catTrackerStore.retryPendingRemoteEventDeletes()
      const remoteState = await loadRemoteCatTracker(notebookId)
      const remoteEventIds = new Set(remoteState.events.map((event) => event.id))
      const pendingRemoteEventCreateIds = catTrackerStore.getPendingRemoteEventCreateIds()
      const pendingRemoteEventUpdateIds = catTrackerStore.getPendingRemoteEventUpdateIds()
      const pendingRemoteEventDeleteIds = catTrackerStore.getPendingRemoteEventDeleteIds()
      const localEventsMissingFromRemote = catTrackerStore.events.filter(
        (event) => !remoteEventIds.has(event.id),
      )
      const protectedLocalUpdatedEvents = catTrackerStore.events.filter(
        (event) => remoteEventIds.has(event.id) && pendingRemoteEventUpdateIds.has(event.id),
      )
      const protectedLocalEvents = localEventsMissingFromRemote.filter((event) =>
        pendingRemoteEventCreateIds.has(event.id) || shouldPreserveLocalEvent(event, lastRefreshAt),
      )
      const remoteEventsHiddenByLocalDeletes = remoteState.events.filter((event) =>
        pendingRemoteEventDeleteIds.has(event.id),
      )

      if (localEventsMissingFromRemote.length > 0) {
        recordSyncDiagnostic('remote-refresh-overwrite-risk', {
          notebookId,
          reason: options.reason,
          localEventCount: catTrackerStore.events.length,
          remoteEventCount: remoteState.events.length,
          missingLocalEventCount: localEventsMissingFromRemote.length,
          missingLocalEvents: localEventsMissingFromRemote.slice(0, 10).map((event) => ({
            id: event.id,
            catId: event.catId,
            categoryId: event.categoryId,
            createdBy: event.createdBy,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
            occurredAt: event.occurredAt,
          })),
        })
      }

      if (protectedLocalEvents.length > 0) {
        recordSyncDiagnostic('remote-refresh-local-events-preserved', {
          notebookId,
          reason: options.reason,
          lastRefreshAt: new Date(lastRefreshAt).toISOString(),
          preservedLocalEventCount: protectedLocalEvents.length,
          preservedLocalEvents: protectedLocalEvents.slice(0, 10).map((event) => ({
            id: event.id,
            catId: event.catId,
            categoryId: event.categoryId,
            createdBy: event.createdBy,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
            occurredAt: event.occurredAt,
          })),
        })
      }

      if (protectedLocalUpdatedEvents.length > 0) {
        recordSyncDiagnostic('remote-refresh-local-updates-preserved', {
          notebookId,
          reason: options.reason,
          preservedLocalUpdateCount: protectedLocalUpdatedEvents.length,
          preservedLocalUpdates: protectedLocalUpdatedEvents.slice(0, 10).map((event) => ({
            id: event.id,
            catId: event.catId,
            categoryId: event.categoryId,
            createdBy: event.createdBy,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
            occurredAt: event.occurredAt,
          })),
        })
      }

      if (remoteEventsHiddenByLocalDeletes.length > 0) {
        recordSyncDiagnostic('remote-refresh-local-deletes-preserved', {
          notebookId,
          reason: options.reason,
          preservedLocalDeleteCount: remoteEventsHiddenByLocalDeletes.length,
          preservedLocalDeletes: remoteEventsHiddenByLocalDeletes.slice(0, 10).map((event) => ({
            id: event.id,
            catId: event.catId,
            categoryId: event.categoryId,
            createdBy: event.createdBy,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
            occurredAt: event.occurredAt,
          })),
        })
      }

      catTrackerStore.replacePersistedState({
        ...remoteState,
        events: mergeRemoteEventsWithProtectedLocalEvents({
          remoteEvents: remoteState.events,
          protectedLocalCreatedEvents: protectedLocalEvents,
          protectedLocalUpdatedEvents,
          pendingRemoteEventDeleteIds,
        }),
      })
      lastRefreshAtByNotebookId.set(notebookId, Date.now())
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
      await refreshRemoteCatTracker(catTrackerStore, pendingChanges.notebookId, {
        force: true,
        reason: 'bootstrap',
      })
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
    await refreshRemoteCatTracker(catTrackerStore, pendingChanges.notebookId, {
      force: true,
      reason: 'bootstrap',
    })
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

function mergeRemoteEventsWithProtectedLocalEvents(input: {
  remoteEvents: CatEvent[]
  protectedLocalCreatedEvents: CatEvent[]
  protectedLocalUpdatedEvents: CatEvent[]
  pendingRemoteEventDeleteIds: Set<string>
}): CatEvent[] {
  if (
    input.protectedLocalCreatedEvents.length === 0 &&
    input.protectedLocalUpdatedEvents.length === 0 &&
    input.pendingRemoteEventDeleteIds.size === 0
  ) {
    return input.remoteEvents
  }

  const protectedUpdatedEventsById = new Map(
    input.protectedLocalUpdatedEvents.map((event) => [event.id, event]),
  )
  const remoteEvents = input.remoteEvents
    .filter((event) => !input.pendingRemoteEventDeleteIds.has(event.id))
    .map((event) => protectedUpdatedEventsById.get(event.id) ?? event)

  if (input.protectedLocalCreatedEvents.length === 0) {
    return remoteEvents
  }

  return [...remoteEvents, ...input.protectedLocalCreatedEvents].sort((a, b) => {
    const occurredAtOrder = a.occurredAt.localeCompare(b.occurredAt)

    if (occurredAtOrder !== 0) {
      return occurredAtOrder
    }

    return a.createdAt.localeCompare(b.createdAt)
  })
}

function shouldPreserveLocalEvent(event: CatEvent, lastRefreshAt: number): boolean {
  if (lastRefreshAt <= 0) {
    return false
  }

  return getTimestamp(event.createdAt) > lastRefreshAt
}

function getTimestamp(value: string): number {
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : 0
}
