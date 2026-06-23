import type { CatEvent } from '@/types'
import { getIsoNow } from '@/utils/datetime'
import { createId } from '@/utils/id'

export function createEventDraft({
  catId,
  categoryId,
  occurredAt,
  createdBy,
}: {
  catId: string
  categoryId: string
  occurredAt?: string
  createdBy?: string
}): CatEvent {
  const now = getIsoNow()

  return {
    id: createId('event-draft'),
    catId,
    categoryId,
    occurredAt: occurredAt ?? now,
    createdBy,
    createdAt: now,
    updatedAt: now,
  }
}

export function duplicateEventDraft(sourceEvent: CatEvent, createdBy?: string): CatEvent {
  const now = getIsoNow()

  return {
    id: createId('event-draft'),
    catId: sourceEvent.catId,
    categoryId: sourceEvent.categoryId,
    occurredAt: now,
    title: sourceEvent.title,
    severity: sourceEvent.severity,
    note: sourceEvent.note,
    values: sourceEvent.values ? { ...sourceEvent.values } : undefined,
    createdBy,
    createdAt: now,
    updatedAt: now,
  }
}
