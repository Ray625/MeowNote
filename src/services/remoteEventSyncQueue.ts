import { readJson, writeJson } from '@/utils/storage'

const REMOTE_EVENT_SYNC_QUEUE_STORAGE_KEY = 'meownote:remote-event-sync-queue'
const MAX_ATTEMPTS = 10

interface PendingRemoteEventBase {
  eventId: string
  notebookId: string
  userId: string
  attemptCount: number
  createdAt: string
  updatedAt: string
  lastAttemptAt?: string
  lastError?: {
    code?: string
    message?: string
  }
}

export interface PendingRemoteEventCreate extends PendingRemoteEventBase {
  operation: 'create'
}

export interface PendingRemoteEventUpdate extends PendingRemoteEventBase {
  operation: 'update'
  expectedUpdatedAt?: string
}

export interface PendingRemoteEventDelete extends PendingRemoteEventBase {
  operation: 'delete'
  expectedUpdatedAt?: string
  photoPaths: string[]
}

export type PendingRemoteEventSync =
  | PendingRemoteEventCreate
  | PendingRemoteEventUpdate
  | PendingRemoteEventDelete

export interface RemoteEventSyncQueueSummary {
  total: number
  creates: number
  updates: number
  deletes: number
  lastError?: {
    code?: string
    message?: string
  }
}

export function enqueueRemoteEventCreate(input: {
  eventId: string
  notebookId: string
  userId: string
}): void {
  if (!input.eventId || !input.notebookId || !input.userId) {
    return
  }

  const now = new Date().toISOString()
  const queue = getRemoteEventSyncQueue()
  const existing = queue.find(
    (item) =>
      item.operation === 'create' &&
      item.eventId === input.eventId &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId,
  )

  if (existing) {
    writeRemoteEventSyncQueue(
      queue.map((item) =>
        item === existing
          ? {
              ...item,
              updatedAt: now,
            }
          : item,
      ),
    )
    return
  }

  writeRemoteEventSyncQueue([
    ...queue,
    {
      operation: 'create',
      eventId: input.eventId,
      notebookId: input.notebookId,
      userId: input.userId,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

export function enqueueRemoteEventUpdate(input: {
  eventId: string
  notebookId: string
  userId: string
  expectedUpdatedAt?: string
}): void {
  if (!input.eventId || !input.notebookId || !input.userId) {
    return
  }

  const now = new Date().toISOString()
  const queue = getRemoteEventSyncQueue()
  const existing = queue.find(
    (item) =>
      item.operation === 'update' &&
      item.eventId === input.eventId &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId,
  )

  if (existing) {
    writeRemoteEventSyncQueue(
      queue.map((item) =>
        item === existing
          ? {
              ...item,
              updatedAt: now,
            }
          : item,
      ),
    )
    return
  }

  writeRemoteEventSyncQueue([
    ...queue,
    {
      operation: 'update',
      eventId: input.eventId,
      notebookId: input.notebookId,
      userId: input.userId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

export function enqueueRemoteEventDelete(input: {
  eventId: string
  notebookId: string
  userId: string
  expectedUpdatedAt?: string
  photoPaths?: string[]
}): void {
  if (!input.eventId || !input.notebookId || !input.userId) {
    return
  }

  const now = new Date().toISOString()
  const queue = getRemoteEventSyncQueue()
  const existing = queue.find(
    (item) =>
      item.operation === 'delete' &&
      item.eventId === input.eventId &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId,
  )

  if (existing) {
    writeRemoteEventSyncQueue(
      queue.map((item) =>
        item === existing
          ? {
              ...item,
              expectedUpdatedAt: input.expectedUpdatedAt,
              photoPaths: input.photoPaths ?? [],
              updatedAt: now,
            }
          : item,
      ),
    )
    return
  }

  writeRemoteEventSyncQueue([
    ...queue,
    {
      operation: 'delete',
      eventId: input.eventId,
      notebookId: input.notebookId,
      userId: input.userId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      photoPaths: input.photoPaths ?? [],
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

export function markRemoteEventCreateAttempt(input: {
  eventId: string
  notebookId: string
  userId: string
}): void {
  updateRemoteEventCreate(input, (item) => ({
    ...item,
    attemptCount: item.attemptCount + 1,
    lastAttemptAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

export function markRemoteEventCreateFailure(input: {
  eventId: string
  notebookId: string
  userId: string
  error: {
    code?: string
    message?: string
  }
}): void {
  updateRemoteEventCreate(input, (item) => ({
    ...item,
    lastError: input.error,
    updatedAt: new Date().toISOString(),
  }))
}

export function markRemoteEventUpdateAttempt(input: {
  eventId: string
  notebookId: string
  userId: string
}): void {
  updateRemoteEventUpdate(input, (item) => ({
    ...item,
    attemptCount: item.attemptCount + 1,
    lastAttemptAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

export function markRemoteEventUpdateFailure(input: {
  eventId: string
  notebookId: string
  userId: string
  error: {
    code?: string
    message?: string
  }
}): void {
  updateRemoteEventUpdate(input, (item) => ({
    ...item,
    lastError: input.error,
    updatedAt: new Date().toISOString(),
  }))
}

export function markRemoteEventDeleteAttempt(input: {
  eventId: string
  notebookId: string
  userId: string
}): void {
  updateRemoteEventDelete(input, (item) => ({
    ...item,
    attemptCount: item.attemptCount + 1,
    lastAttemptAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

export function markRemoteEventDeleteFailure(input: {
  eventId: string
  notebookId: string
  userId: string
  error: {
    code?: string
    message?: string
  }
}): void {
  updateRemoteEventDelete(input, (item) => ({
    ...item,
    lastError: input.error,
    updatedAt: new Date().toISOString(),
  }))
}

export function removeRemoteEventCreate(input: {
  eventId: string
  notebookId: string
  userId: string
}): void {
  writeRemoteEventSyncQueue(
    getRemoteEventSyncQueue().filter(
      (item) =>
        item.operation !== 'create' ||
        item.eventId !== input.eventId ||
        item.notebookId !== input.notebookId ||
        item.userId !== input.userId,
    ),
  )
}

export function removeRemoteEventUpdate(input: {
  eventId: string
  notebookId: string
  userId: string
}): void {
  writeRemoteEventSyncQueue(
    getRemoteEventSyncQueue().filter(
      (item) =>
        item.operation !== 'update' ||
        item.eventId !== input.eventId ||
        item.notebookId !== input.notebookId ||
        item.userId !== input.userId,
    ),
  )
}

export function removeRemoteEventDelete(input: {
  eventId: string
  notebookId: string
  userId: string
}): void {
  writeRemoteEventSyncQueue(
    getRemoteEventSyncQueue().filter(
      (item) =>
        item.operation !== 'delete' ||
        item.eventId !== input.eventId ||
        item.notebookId !== input.notebookId ||
        item.userId !== input.userId,
    ),
  )
}

export function getPendingRemoteEventCreates(input: {
  notebookId: string
  userId?: string
}): PendingRemoteEventCreate[] {
  if (!input.notebookId || !input.userId) {
    return []
  }

  return getRemoteEventSyncQueue().filter(
    (item): item is PendingRemoteEventCreate =>
      item.operation === 'create' &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId &&
      item.attemptCount < MAX_ATTEMPTS,
  )
}

export function getPendingRemoteEventUpdates(input: {
  notebookId: string
  userId?: string
}): PendingRemoteEventUpdate[] {
  if (!input.notebookId || !input.userId) {
    return []
  }

  return getRemoteEventSyncQueue().filter(
    (item): item is PendingRemoteEventUpdate =>
      item.operation === 'update' &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId &&
      item.attemptCount < MAX_ATTEMPTS,
  )
}

export function getPendingRemoteEventDeletes(input: {
  notebookId: string
  userId?: string
}): PendingRemoteEventDelete[] {
  if (!input.notebookId || !input.userId) {
    return []
  }

  return getRemoteEventSyncQueue().filter(
    (item): item is PendingRemoteEventDelete =>
      item.operation === 'delete' &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId &&
      item.attemptCount < MAX_ATTEMPTS,
  )
}

export function getPendingRemoteEventUpdate(input: {
  eventId: string
  notebookId: string
  userId?: string
}): PendingRemoteEventUpdate | undefined {
  if (!input.eventId || !input.notebookId || !input.userId) {
    return undefined
  }

  return getRemoteEventSyncQueue().find(
    (item) =>
      item.operation === 'update' &&
      item.eventId === input.eventId &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId,
  ) as PendingRemoteEventUpdate | undefined
}

export function getPendingRemoteEventCreateIds(input: {
  notebookId: string
  userId?: string
}): Set<string> {
  if (!input.notebookId || !input.userId) {
    return new Set()
  }

  return new Set(
    getRemoteEventSyncQueue()
      .filter(
        (item) =>
          item.operation === 'create' &&
          item.notebookId === input.notebookId &&
          item.userId === input.userId,
      )
      .map((item) => item.eventId),
  )
}

export function getPendingRemoteEventUpdateIds(input: {
  notebookId: string
  userId?: string
}): Set<string> {
  if (!input.notebookId || !input.userId) {
    return new Set()
  }

  return new Set(
    getRemoteEventSyncQueue()
      .filter(
        (item) =>
          item.operation === 'update' &&
          item.notebookId === input.notebookId &&
          item.userId === input.userId,
      )
      .map((item) => item.eventId),
  )
}

export function getPendingRemoteEventDeleteIds(input: {
  notebookId: string
  userId?: string
}): Set<string> {
  if (!input.notebookId || !input.userId) {
    return new Set()
  }

  return new Set(
    getRemoteEventSyncQueue()
      .filter(
        (item) =>
          item.operation === 'delete' &&
          item.notebookId === input.notebookId &&
          item.userId === input.userId,
      )
      .map((item) => item.eventId),
  )
}

export function getRemoteEventSyncQueueSummary(input: {
  notebookId: string
  userId?: string
}): RemoteEventSyncQueueSummary {
  if (!input.notebookId || !input.userId) {
    return {
      total: 0,
      creates: 0,
      updates: 0,
      deletes: 0,
    }
  }

  const queue = getRemoteEventSyncQueue().filter(
    (item) => item.notebookId === input.notebookId && item.userId === input.userId,
  )
  const lastError = queue
    .filter((item) => item.lastError?.message || item.lastError?.code)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.lastError

  return {
    total: queue.length,
    creates: queue.filter((item) => item.operation === 'create').length,
    updates: queue.filter((item) => item.operation === 'update').length,
    deletes: queue.filter((item) => item.operation === 'delete').length,
    lastError,
  }
}

function updateRemoteEventCreate(
  input: {
    eventId: string
    notebookId: string
    userId: string
  },
  update: (item: PendingRemoteEventCreate) => PendingRemoteEventCreate,
): void {
  writeRemoteEventSyncQueue(
    getRemoteEventSyncQueue().map((item) =>
      item.operation === 'create' &&
      item.eventId === input.eventId &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId
        ? update(item)
        : item,
    ),
  )
}

function updateRemoteEventUpdate(
  input: {
    eventId: string
    notebookId: string
    userId: string
  },
  update: (item: PendingRemoteEventUpdate) => PendingRemoteEventUpdate,
): void {
  writeRemoteEventSyncQueue(
    getRemoteEventSyncQueue().map((item) =>
      item.operation === 'update' &&
      item.eventId === input.eventId &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId
        ? update(item)
        : item,
    ),
  )
}

function updateRemoteEventDelete(
  input: {
    eventId: string
    notebookId: string
    userId: string
  },
  update: (item: PendingRemoteEventDelete) => PendingRemoteEventDelete,
): void {
  writeRemoteEventSyncQueue(
    getRemoteEventSyncQueue().map((item) =>
      item.operation === 'delete' &&
      item.eventId === input.eventId &&
      item.notebookId === input.notebookId &&
      item.userId === input.userId
        ? update(item)
        : item,
    ),
  )
}

function getRemoteEventSyncQueue(): PendingRemoteEventSync[] {
  return readJson<PendingRemoteEventSync[]>(REMOTE_EVENT_SYNC_QUEUE_STORAGE_KEY, [])
}

function writeRemoteEventSyncQueue(queue: PendingRemoteEventSync[]): void {
  writeJson<PendingRemoteEventSync[]>(REMOTE_EVENT_SYNC_QUEUE_STORAGE_KEY, queue)
}
