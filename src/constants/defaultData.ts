import type { Cat, EventCategory, EventCategoryGroup } from '@/types'

export const DEFAULT_CAT_ID = 'default-cat'

export const CATEGORY_GROUP_ORDER: EventCategoryGroup[] = ['攝取', '排泄', '行為', '日常', '用藥']

export const DEFAULT_CATEGORY_DEFINITIONS = [
  { name: '濕食', group: '攝取', color: '#d9984a' },
  { name: '乾糧', group: '攝取', color: '#c98238' },
  { name: '飲水', group: '攝取', color: '#4f91c9' },
  { name: '排便', group: '排泄', color: '#9b6a3e' },
  { name: '排尿', group: '排泄', color: '#c7a13c' },
  { name: '嘔吐', group: '排泄', color: '#ea6a2a' },
  { name: '軟便', group: '排泄', color: '#d84b32' },
  { name: '腹瀉', group: '排泄', color: '#b9382f' },
  { name: '攻擊', group: '行為', color: '#7550b8' },
  { name: '嚎叫', group: '行為', color: '#3f7acb' },
  { name: '刷牙', group: '日常', color: '#6fa7b8' },
  { name: '剪指甲', group: '日常', color: '#4f9f8f' },
  { name: '外出', group: '日常', color: '#5f8f78' },
  { name: '夜擾', group: '日常', color: '#8a7cc5' },
  { name: '體外驅蟲', group: '用藥', color: '#2f9b63' },
  { name: '皮下點滴', group: '用藥', color: '#4ca56a' },
] as const satisfies ReadonlyArray<{
  name: string
  group: EventCategoryGroup
  color: string
}>

export const FUTURE_CATEGORY_NAMES = [
  '躲藏',
  '亂尿',
  '過度舔毛',
  '看診',
  '驅蟲',
  '疫苗',
  '外出訓練',
  '剪指甲訓練',
] as const

export const QUICK_CATEGORY_NAMES = DEFAULT_CATEGORY_DEFINITIONS.map(
  (category) => category.name,
) as Array<(typeof DEFAULT_CATEGORY_DEFINITIONS)[number]['name']>

export const DEFAULT_CATEGORY_COLORS = Object.fromEntries(
  DEFAULT_CATEGORY_DEFINITIONS.map((category) => [category.name, category.color]),
) as Record<(typeof DEFAULT_CATEGORY_DEFINITIONS)[number]['name'], string>

export function createDefaultCat(now: string): Cat {
  return {
    id: DEFAULT_CAT_ID,
    name: '我的貓',
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultCategories(now: string): EventCategory[] {
  return DEFAULT_CATEGORY_DEFINITIONS.map((category) => ({
    id: `default-category-${category.name}`,
    name: category.name,
    group: category.group,
    color: category.color,
    isDefault: true,
    isQuickAction: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }))
}

export function normalizeDefaultCategory(category: EventCategory): EventCategory {
  const defaultCategory = DEFAULT_CATEGORY_DEFINITIONS.find((item) => item.name === category.name)

  if (!defaultCategory) {
    return category
  }

  return {
    ...category,
    group: defaultCategory.group,
    color: category.color ?? defaultCategory.color,
    isDefault: category.isDefault || category.id === `default-category-${category.name}`,
    isArchived: category.isArchived ?? false,
    isQuickAction:
      (category.isQuickAction || category.id === `default-category-${category.name}`) &&
      !(category.isArchived ?? false),
  }
}

export function ensureDefaultCategories(categories: EventCategory[], now: string): EventCategory[] {
  const normalizedCategories = categories.map((category) => normalizeDefaultCategory(category))
  const existingNames = new Set(normalizedCategories.map((category) => category.name))
  const missingDefaultCategories = createDefaultCategories(now).filter(
    (category) => !existingNames.has(category.name),
  )

  return [...normalizedCategories, ...missingDefaultCategories]
}
