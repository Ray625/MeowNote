import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEventDraft, duplicateEventDraft } from './eventDraft'
import type { CatEvent } from '@/types'

vi.mock('@/utils/datetime', () => ({
  getIsoNow: () => '2026-06-24T10:00:00.000Z',
}))

vi.mock('@/utils/id', () => ({
  createId: (prefix: string) => `${prefix}-id`,
}))

function createSourceEvent(): CatEvent {
  return {
    id: 'event-1',
    catId: 'cat-1',
    categoryId: 'category-1',
    occurredAt: '2026-06-01T08:00:00.000Z',
    title: '原本標題',
    severity: 2,
    note: '原本備註',
    values: { value: 7 },
    photos: [{ path: 'photos/original.webp', thumbnailPath: 'photos/thumbnail.webp' }],
    createdBy: 'owner-user',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  }
}

describe('event draft domain rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an unsaved event draft for a selected cat and category', () => {
    const draft = createEventDraft({
      catId: 'cat-1',
      categoryId: 'category-1',
      occurredAt: '2026-06-24T09:00:00.000Z',
      createdBy: 'user-1',
    })

    expect(draft).toEqual({
      id: 'event-draft-id',
      catId: 'cat-1',
      categoryId: 'category-1',
      occurredAt: '2026-06-24T09:00:00.000Z',
      createdBy: 'user-1',
      createdAt: '2026-06-24T10:00:00.000Z',
      updatedAt: '2026-06-24T10:00:00.000Z',
    })
  })

  it('uses the current time when no occurredAt is provided', () => {
    const draft = createEventDraft({
      catId: 'cat-1',
      categoryId: 'category-1',
    })

    expect(draft.occurredAt).toBe('2026-06-24T10:00:00.000Z')
  })

  it('duplicates editable details but intentionally does not copy photos', () => {
    const sourceEvent = createSourceEvent()
    const draft = duplicateEventDraft(sourceEvent, 'editor-user')

    expect(draft).toMatchObject({
      id: 'event-draft-id',
      catId: 'cat-1',
      categoryId: 'category-1',
      occurredAt: '2026-06-24T10:00:00.000Z',
      title: '原本標題',
      severity: 2,
      note: '原本備註',
      values: { value: 7 },
      createdBy: 'editor-user',
      createdAt: '2026-06-24T10:00:00.000Z',
      updatedAt: '2026-06-24T10:00:00.000Z',
    })
    expect(draft.values).not.toBe(sourceEvent.values)
    expect(draft.photos).toBeUndefined()
  })
})
