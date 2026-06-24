import { describe, expect, it } from 'vitest'
import { canManageNotebookData, canModifyEventForNotebook } from './permissions'
import type { CatEvent } from '@/types'

function createEvent(createdBy?: string): CatEvent {
  return {
    id: 'event-1',
    catId: 'cat-1',
    categoryId: 'category-1',
    createdBy,
    occurredAt: '2026-06-24T10:00:00.000Z',
    createdAt: '2026-06-24T10:00:00.000Z',
    updatedAt: '2026-06-24T10:00:00.000Z',
  }
}

describe('cat tracker permissions', () => {
  it('allows local unsigned users to modify local data', () => {
    expect(
      canModifyEventForNotebook(createEvent(), {
        notebookId: '',
        role: '',
      }),
    ).toBe(true)

    expect(
      canManageNotebookData({
        notebookId: '',
        role: '',
      }),
    ).toBe(true)
  })

  it('allows notebook owners to modify any event and manage notebook data', () => {
    expect(
      canModifyEventForNotebook(createEvent('other-user'), {
        notebookId: 'notebook-1',
        userId: 'owner-user',
        role: 'owner',
      }),
    ).toBe(true)

    expect(
      canManageNotebookData({
        notebookId: 'notebook-1',
        userId: 'owner-user',
        role: 'owner',
      }),
    ).toBe(true)
  })

  it('allows editors to modify only their own events', () => {
    expect(
      canModifyEventForNotebook(createEvent('editor-user'), {
        notebookId: 'notebook-1',
        userId: 'editor-user',
        role: 'editor',
      }),
    ).toBe(true)

    expect(
      canModifyEventForNotebook(createEvent('owner-user'), {
        notebookId: 'notebook-1',
        userId: 'editor-user',
        role: 'editor',
      }),
    ).toBe(false)
  })

  it('does not allow editors to manage pets or categories', () => {
    expect(
      canManageNotebookData({
        notebookId: 'notebook-1',
        userId: 'editor-user',
        role: 'editor',
      }),
    ).toBe(false)
  })
})
