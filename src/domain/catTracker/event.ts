import type { CatEvent, CreateCatEventInput, EventPhoto, UpdateCatEventInput } from '@/types'
import { createId } from '@/utils/id'

export function createEventRecord(
  input: CreateCatEventInput,
  now: string,
  createdBy?: string,
): CatEvent {
  return {
    id: input.id ?? createId('event'),
    catId: input.catId,
    categoryId: input.categoryId,
    occurredAt: input.occurredAt ?? now,
    title: input.title,
    severity: input.severity,
    note: input.note,
    values: input.values,
    photos: input.photos ?? [],
    createdBy,
    createdAt: now,
    updatedAt: now,
  }
}

export function cloneEventRecord(event: CatEvent): CatEvent {
  return {
    ...event,
    values: event.values ? { ...event.values } : undefined,
    photos: cloneEventPhotos(event.photos),
  }
}

export function applyEventUpdate(
  event: CatEvent,
  input: UpdateCatEventInput,
  now: string,
): void {
  Object.assign(event, {
    ...input,
    updatedAt: now,
  })
}

export function removeEventById(events: CatEvent[], eventId: string): CatEvent[] {
  return events.filter((event) => event.id !== eventId)
}

export function restoreDeletedEvent(
  events: CatEvent[],
  deletedEvent: CatEvent,
  deletedEventIndex: number,
): CatEvent[] {
  const nextEvents = [...events]
  const insertIndex =
    deletedEventIndex >= 0 ? Math.min(deletedEventIndex, nextEvents.length) : nextEvents.length

  nextEvents.splice(insertIndex, 0, deletedEvent)
  return nextEvents
}

function cloneEventPhotos(photos?: EventPhoto[]): EventPhoto[] {
  return photos ? photos.map((photo) => ({ ...photo })) : []
}
