import { describe, expect, it } from 'vitest'
import {
  archiveCategory,
  createCategoryRecord,
  createCategoryUpdatePatch,
  deleteCategoryRecord,
  getNextCategorySortOrder,
  getReorderedCategories,
  restoreCategoryRecord,
} from './category'
import type { EventCategory } from '@/types'

const NOW = '2026-06-24T10:00:00.000Z'

function createCategory(input: Partial<EventCategory> & Pick<EventCategory, 'id'>): EventCategory {
  return {
    id: input.id,
    name: input.name ?? input.id,
    group: input.group ?? '健康',
    colorId: input.colorId ?? 'teal',
    isDefault: false,
    isQuickAction: input.isQuickAction ?? true,
    isArchived: input.isArchived ?? false,
    sortOrder: input.sortOrder ?? 0,
    statisticsMode: input.statisticsMode ?? 'count',
    valueLabel: input.valueLabel,
    valueMax: input.valueMax,
    valueUnit: input.valueUnit,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('category domain rules', () => {
  it('calculates next sort order within a group', () => {
    expect(
      getNextCategorySortOrder(
        [
          createCategory({ id: 'a', group: '健康', sortOrder: 0 }),
          createCategory({ id: 'b', group: '健康', sortOrder: 3 }),
          createCategory({ id: 'c', group: '飲食', sortOrder: 9 }),
        ],
        '健康',
      ),
    ).toBe(4)
  })

  it('clears numeric metadata when changing to count mode', () => {
    const category = createCategory({
      id: 'water',
      statisticsMode: 'sum',
      valueLabel: '飲水量',
      valueUnit: 'ml',
    })
    const patch = createCategoryUpdatePatch(category, { statisticsMode: 'count' }, NOW)

    expect(patch).toMatchObject({
      statisticsMode: 'count',
      valueLabel: undefined,
      valueMax: undefined,
      valueUnit: undefined,
    })
  })

  it('sets rating max default and clears unit for rating mode', () => {
    const category = createCategory({
      id: 'energy',
      statisticsMode: 'count',
    })
    const patch = createCategoryUpdatePatch(
      category,
      {
        statisticsMode: 'rating',
        valueLabel: '評分',
        valueUnit: 'kg',
      },
      NOW,
    )

    expect(patch).toMatchObject({
      statisticsMode: 'rating',
      valueLabel: '評分',
      valueMax: 10,
      valueUnit: undefined,
    })
  })

  it('forces newly created rating categories to 10 points', () => {
    const category = createCategoryRecord(
      {
        name: '精神狀態',
        statisticsMode: 'rating',
        valueLabel: '評分',
        valueMax: 5,
        valueUnit: '分',
      },
      NOW,
      0,
    )

    expect(category).toMatchObject({
      statisticsMode: 'rating',
      valueLabel: '評分',
      valueMax: 10,
      valueUnit: undefined,
    })
  })

  it('preserves legacy rating max when editing an existing rating category', () => {
    const category = createCategory({
      id: 'legacy-rating',
      statisticsMode: 'rating',
      valueLabel: '評分',
      valueMax: 5,
    })
    const patch = createCategoryUpdatePatch(category, { name: '舊評分' }, NOW)

    expect(patch).toMatchObject({
      statisticsMode: 'rating',
      valueMax: 5,
      valueUnit: undefined,
    })
  })

  it('archives categories with usage by hiding quick action', () => {
    const category = createCategory({ id: 'vomit', isQuickAction: true })

    archiveCategory(category, '2026-06-25T00:00:00.000Z')

    expect(category.isArchived).toBe(true)
    expect(category.isQuickAction).toBe(false)
    expect(category.updatedAt).toBe('2026-06-25T00:00:00.000Z')
  })

  it('archives categories with usage instead of deleting them', () => {
    const category = createCategory({ id: 'vomit', isQuickAction: true })
    const result = deleteCategoryRecord(
      [category],
      'vomit',
      2,
      '2026-06-25T00:00:00.000Z',
    )

    expect(result).toMatchObject({ status: 'archived', category })
    expect(category.isArchived).toBe(true)
    expect(category.isQuickAction).toBe(false)
    expect(category.updatedAt).toBe('2026-06-25T00:00:00.000Z')
  })

  it('deletes categories without usage', () => {
    const result = deleteCategoryRecord(
      [
        createCategory({ id: 'water' }),
        createCategory({ id: 'vomit' }),
      ],
      'vomit',
      0,
      NOW,
    )

    expect(result).toMatchObject({ status: 'deleted' })

    if (result.status === 'deleted') {
      expect(result.categories.map((category) => category.id)).toEqual(['water'])
    }
  })

  it('restores categories as active quick actions', () => {
    const category = createCategory({ id: 'vomit', isArchived: true, isQuickAction: false })

    restoreCategoryRecord(category, '2026-06-25T00:00:00.000Z')

    expect(category.isArchived).toBe(false)
    expect(category.isQuickAction).toBe(true)
    expect(category.updatedAt).toBe('2026-06-25T00:00:00.000Z')
  })

  it('reorders active categories inside the same group', () => {
    const reordered = getReorderedCategories(
      [
        createCategory({ id: 'a', group: '健康', sortOrder: 0 }),
        createCategory({ id: 'b', group: '健康', sortOrder: 1 }),
        createCategory({ id: 'c', group: '健康', sortOrder: 2 }),
      ],
      'c',
      'a',
      'before',
    )

    expect(reordered.map((category) => category.id)).toEqual(['c', 'a', 'b'])
  })
})
