import { describe, expect, it } from 'vitest'
import {
  applyEventUpdate,
  cloneEventRecord,
  createEventRecord,
  removeEventById,
  restoreDeletedEvent,
} from './event'
import type { CatEvent } from '@/types'

const NOW = '2026-06-24T10:00:00.000Z'

function createEvent(id: string): CatEvent {
  return {
    id,
    catId: 'cat-1',
    categoryId: 'category-1',
    occurredAt: NOW,
    values: { value: 10 },
    photos: [{ path: `${id}/original.webp`, thumbnailPath: `${id}/thumbnail.webp` }],
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('cat event domain rules', () => {
  it('creates a complete event record with timestamps and author', () => {
    const event = createEventRecord(
      {
        catId: 'cat-1',
        categoryId: 'category-1',
        note: '喝水',
        values: { value: 50 },
      },
      NOW,
      'user-1',
    )

    expect(event).toMatchObject({
      catId: 'cat-1',
      categoryId: 'category-1',
      note: '喝水',
      values: { value: 50 },
      photos: [],
      createdBy: 'user-1',
      occurredAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(event.id).toBeTruthy()
  })

  it('clones values and photos so rollback snapshots are isolated', () => {
    const event = createEvent('event-1')
    const clonedEvent = cloneEventRecord(event)

    expect(clonedEvent).toEqual(event)
    expect(clonedEvent).not.toBe(event)
    expect(clonedEvent.values).not.toBe(event.values)
    expect(clonedEvent.photos).not.toBe(event.photos)
    expect(clonedEvent.photos?.[0]).not.toBe(event.photos?.[0])
  })

  it('applies event updates with a new updatedAt value', () => {
    const event = createEvent('event-1')

    applyEventUpdate(event, { note: '更新備註', values: { value: 20 } }, '2026-06-25T00:00:00.000Z')

    expect(event.note).toBe('更新備註')
    expect(event.values).toEqual({ value: 20 })
    expect(event.updatedAt).toBe('2026-06-25T00:00:00.000Z')
  })

  it('removes and restores deleted events at the original index', () => {
    const firstEvent = createEvent('event-1')
    const secondEvent = createEvent('event-2')
    const thirdEvent = createEvent('event-3')
    const afterDelete = removeEventById([firstEvent, secondEvent, thirdEvent], 'event-2')

    expect(afterDelete.map((event) => event.id)).toEqual(['event-1', 'event-3'])

    const restored = restoreDeletedEvent(afterDelete, secondEvent, 1)

    expect(restored.map((event) => event.id)).toEqual(['event-1', 'event-2', 'event-3'])
  })
})
