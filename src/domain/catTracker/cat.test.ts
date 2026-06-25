import { describe, expect, it } from 'vitest'
import {
  applyCatUpdate,
  createCatRecord,
  deleteCatRecord,
  getFallbackSelectedCatId,
  restoreCatRecord,
} from './cat'
import type { Cat } from '@/types'

const NOW = '2026-06-24T10:00:00.000Z'

function createCat(input: Partial<Cat> & Pick<Cat, 'id'>): Cat {
  return {
    id: input.id,
    name: input.name ?? input.id,
    avatarId: input.avatarId,
    birthday: input.birthday,
    sex: input.sex,
    weightKg: input.weightKg,
    isNeutered: input.isNeutered,
    note: input.note,
    isArchived: input.isArchived ?? false,
    createdAt: input.createdAt ?? NOW,
    updatedAt: input.updatedAt ?? NOW,
  }
}

describe('cat domain rules', () => {
  it('creates a cat record with timestamps and default active state', () => {
    const cat = createCatRecord(
      {
        name: '豬皮',
        avatarId: 'orange',
        birthday: '2018-06-25',
      },
      NOW,
    )

    expect(cat).toMatchObject({
      name: '豬皮',
      avatarId: 'orange',
      birthday: '2018-06-25',
      isArchived: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(cat.id).toBeTruthy()
  })

  it('applies cat updates with a new updatedAt value', () => {
    const cat = createCat({ id: 'cat-1', name: '豬皮' })

    applyCatUpdate(cat, { name: '豬皮二號', weightKg: 4.2 }, '2026-06-25T00:00:00.000Z')

    expect(cat.name).toBe('豬皮二號')
    expect(cat.weightKg).toBe(4.2)
    expect(cat.updatedAt).toBe('2026-06-25T00:00:00.000Z')
  })

  it('archives cats with usage instead of deleting them', () => {
    const cat = createCat({ id: 'cat-1', isArchived: false })
    const result = deleteCatRecord([cat], 'cat-1', 3, '2026-06-25T00:00:00.000Z')

    expect(result).toMatchObject({ status: 'archived', cat })
    expect(cat.isArchived).toBe(true)
    expect(cat.updatedAt).toBe('2026-06-25T00:00:00.000Z')
  })

  it('deletes cats without usage and returns the next active selection', () => {
    const deleted = createCat({ id: 'deleted' })
    const archived = createCat({ id: 'archived', isArchived: true })
    const next = createCat({ id: 'next' })
    const result = deleteCatRecord([deleted, archived, next], 'deleted', 0, NOW)

    expect(result).toMatchObject({
      status: 'deleted',
      fallbackSelectedCatId: 'next',
    })

    if (result.status === 'deleted') {
      expect(result.cats.map((cat) => cat.id)).toEqual(['archived', 'next'])
    }
  })

  it('restores archived cats', () => {
    const cat = createCat({ id: 'cat-1', isArchived: true })

    restoreCatRecord(cat, '2026-06-25T00:00:00.000Z')

    expect(cat.isArchived).toBe(false)
    expect(cat.updatedAt).toBe('2026-06-25T00:00:00.000Z')
  })

  it('selects the first active fallback cat', () => {
    expect(
      getFallbackSelectedCatId(
        [
          createCat({ id: 'archived', isArchived: true }),
          createCat({ id: 'excluded' }),
          createCat({ id: 'active' }),
        ],
        'excluded',
      ),
    ).toBe('active')
  })
})
