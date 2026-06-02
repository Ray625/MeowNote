import { readJson, removeJson, writeJson } from '@/utils/storage'

const SIGNED_OUT_CACHE_STORAGE_KEY = 'meownote:signed-out-cache'

export interface SignedOutNotebookCacheMeta {
  userId: string
  notebookId: string
  notebookRole: string
  hasUnsyncedChanges: boolean
  deletedEvents: SignedOutDeletedEvent[]
  signedOutAt: string
  updatedAt: string
}

export interface SignedOutDeletedEvent {
  id: string
  createdBy?: string
}

export function rememberSignedOutNotebookCache(input: {
  userId: string
  notebookId: string
  notebookRole: string
}): void {
  if (!input.userId || !input.notebookId) {
    return
  }

  const now = new Date().toISOString()

  writeJson<SignedOutNotebookCacheMeta>(SIGNED_OUT_CACHE_STORAGE_KEY, {
    userId: input.userId,
    notebookId: input.notebookId,
    notebookRole: input.notebookRole,
    hasUnsyncedChanges: false,
    deletedEvents: [],
    signedOutAt: now,
    updatedAt: now,
  })
}

export function markSignedOutNotebookCacheDirty(input: {
  deletedEvent?: SignedOutDeletedEvent
} = {}): void {
  const meta = readJson<SignedOutNotebookCacheMeta | null>(SIGNED_OUT_CACHE_STORAGE_KEY, null)

  if (!meta) {
    return
  }

  const deletedEvents = input.deletedEvent
    ? upsertDeletedEvent(meta.deletedEvents ?? [], input.deletedEvent)
    : (meta.deletedEvents ?? [])

  writeJson<SignedOutNotebookCacheMeta>(SIGNED_OUT_CACHE_STORAGE_KEY, {
    ...meta,
    hasUnsyncedChanges: true,
    deletedEvents,
    updatedAt: new Date().toISOString(),
  })
}

function upsertDeletedEvent(
  deletedEvents: SignedOutDeletedEvent[],
  deletedEvent: SignedOutDeletedEvent,
): SignedOutDeletedEvent[] {
  if (!deletedEvent.id) {
    return deletedEvents
  }

  return [
    ...deletedEvents.filter((event) => event.id !== deletedEvent.id),
    deletedEvent,
  ]
}

export function getPendingSignedOutNotebookChanges(input: {
  userId: string | null
  notebookId: string
}): SignedOutNotebookCacheMeta | null {
  if (!input.userId || !input.notebookId) {
    return null
  }

  const meta = readJson<SignedOutNotebookCacheMeta | null>(SIGNED_OUT_CACHE_STORAGE_KEY, null)

  if (
    !meta?.hasUnsyncedChanges ||
    meta.userId !== input.userId ||
    meta.notebookId !== input.notebookId
  ) {
    return null
  }

  return meta
}

export function clearSignedOutNotebookCache(): void {
  removeJson(SIGNED_OUT_CACHE_STORAGE_KEY)
}
