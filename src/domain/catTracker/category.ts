import { DEFAULT_CATEGORY_STATISTICS_MODE } from '@/constants/defaultData'
import type {
  CreateCategoryInput,
  EventCategory,
  EventCategoryGroup,
  UpdateCategoryInput,
} from '@/types'
import { createId } from '@/utils/id'
import { sortCategories } from './selectors'

export function getNextCategorySortOrder(
  categories: EventCategory[],
  group: EventCategoryGroup,
): number {
  const groupCategories = categories.filter((category) => category.group === group)

  if (groupCategories.length === 0) {
    return 0
  }

  return Math.max(...groupCategories.map((category) => category.sortOrder)) + 1
}

export function createCategoryRecord(
  input: CreateCategoryInput,
  now: string,
  sortOrder: number,
): EventCategory {
  const group = input.group ?? '飲食'

  return {
    id: createId('category'),
    name: input.name,
    group,
    colorId: input.colorId,
    icon: input.icon,
    isDefault: false,
    isQuickAction: input.isQuickAction ?? false,
    isArchived: input.isArchived ?? false,
    sortOrder: input.sortOrder ?? sortOrder,
    statisticsMode: input.statisticsMode ?? DEFAULT_CATEGORY_STATISTICS_MODE,
    templateId: input.templateId,
    valueLabel: input.valueLabel,
    valueMax: input.valueMax,
    valueUnit: input.valueUnit,
    createdAt: now,
    updatedAt: now,
  }
}

export function createCategoryUpdatePatch(
  category: EventCategory,
  input: UpdateCategoryInput,
  now: string,
  nextGroupSortOrder?: number,
): UpdateCategoryInput & Pick<EventCategory, 'updatedAt'> {
  const nextInput = { ...input }

  if (input.group && input.group !== category.group && typeof input.sortOrder !== 'number') {
    nextInput.sortOrder = nextGroupSortOrder
  }

  const nextStatisticsMode = nextInput.statisticsMode ?? category.statisticsMode

  return {
    ...nextInput,
    statisticsMode: nextStatisticsMode,
    valueLabel:
      nextStatisticsMode === 'count' ? undefined : (nextInput.valueLabel ?? category.valueLabel),
    valueMax:
      nextStatisticsMode === 'rating'
        ? (nextInput.valueMax ?? category.valueMax ?? 10)
        : undefined,
    valueUnit:
      nextStatisticsMode === 'count' || nextStatisticsMode === 'rating'
        ? undefined
        : (nextInput.valueUnit ?? category.valueUnit),
    updatedAt: now,
  }
}

export function archiveCategory(category: EventCategory, now: string): void {
  Object.assign(category, {
    isArchived: true,
    isQuickAction: false,
    updatedAt: now,
  })
}

export function restoreCategoryRecord(category: EventCategory, now: string): void {
  Object.assign(category, {
    isArchived: false,
    isQuickAction: true,
    updatedAt: now,
  })
}

export function getReorderedCategories(
  categories: EventCategory[],
  categoryId: string,
  targetCategoryId: string,
  position: 'before' | 'after' = 'before',
): EventCategory[] {
  const category = categories.find((item) => item.id === categoryId)
  const targetCategory = categories.find((item) => item.id === targetCategoryId)

  if (
    !category ||
    !targetCategory ||
    category.isArchived ||
    targetCategory.isArchived ||
    category.group !== targetCategory.group
  ) {
    return []
  }

  const groupCategories = sortCategories(
    categories.filter((item) => item.group === category.group && !item.isArchived),
  )
  const fromIndex = groupCategories.findIndex((item) => item.id === categoryId)
  const toIndex = groupCategories.findIndex((item) => item.id === targetCategoryId)

  if (fromIndex < 0 || toIndex < 0) {
    return []
  }

  const [movedCategory] = groupCategories.splice(fromIndex, 1)

  if (!movedCategory) {
    return []
  }

  const targetIndex = groupCategories.findIndex((item) => item.id === targetCategoryId)

  if (targetIndex < 0) {
    return []
  }

  groupCategories.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, movedCategory)

  return groupCategories
}
