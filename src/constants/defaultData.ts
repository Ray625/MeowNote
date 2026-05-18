import type { Cat, CategoryColorId, EventCategory, EventCategoryGroup } from '@/types'

export const DEFAULT_CAT_ID = 'default-cat'

export const CATEGORY_GROUP_ORDER: EventCategoryGroup[] = ['攝取', '排泄', '行為', '日常', '用藥']

export const CATEGORY_COLOR_OPTIONS = [
  {
    id: 'red',
    label: '紅色',
    value: '#D6453D',
    background: '#FDECEA',
    border: '#E5A29C',
  },
  {
    id: 'orange',
    label: '橘色',
    value: '#E9823A',
    background: '#FFF3EA',
    border: '#E8B48D',
  },
  {
    id: 'amber',
    label: '琥珀',
    value: '#C98A00',
    background: '#FFF7E0',
    border: '#E1C37A',
  },
  {
    id: 'green',
    label: '綠色',
    value: '#2E8B57',
    background: '#EAF7F0',
    border: '#9ACDB2',
  },
  {
    id: 'teal',
    label: '藍綠',
    value: '#148F8B',
    background: '#E7F6F5',
    border: '#8FCBC8',
  },
  {
    id: 'blue',
    label: '藍色',
    value: '#2F74C0',
    background: '#EAF2FD',
    border: '#9DBCE8',
  },
  {
    id: 'purple',
    label: '紫色',
    value: '#7353B8',
    background: '#F0ECFA',
    border: '#B8A7DF',
  },
  {
    id: 'pink',
    label: '粉紅',
    value: '#D9367C',
    background: '#FDEAF2',
    border: '#E7A0BF',
  },
] as const

export const DEFAULT_CATEGORY_COLOR_ID = 'teal' satisfies CategoryColorId

export const DEFAULT_CATEGORY_DEFINITIONS = [
  { name: '濕食', group: '攝取', colorId: 'orange' },
  { name: '乾糧', group: '攝取', colorId: 'amber' },
  { name: '飲水', group: '攝取', colorId: 'blue' },
  { name: '排便', group: '排泄', colorId: 'green' },
  { name: '排尿', group: '排泄', colorId: 'amber' },
  { name: '嘔吐', group: '排泄', colorId: 'orange' },
  { name: '軟便', group: '排泄', colorId: 'red' },
  { name: '腹瀉', group: '排泄', colorId: 'pink' },
  { name: '攻擊', group: '行為', colorId: 'purple' },
  { name: '嚎叫', group: '行為', colorId: 'blue' },
  { name: '刷牙', group: '日常', colorId: 'teal' },
  { name: '剪指甲', group: '日常', colorId: 'green' },
  { name: '外出', group: '日常', colorId: 'blue' },
  { name: '夜擾', group: '日常', colorId: 'purple' },
  { name: '體外驅蟲', group: '用藥', colorId: 'green' },
  { name: '皮下點滴', group: '用藥', colorId: 'teal' },
] as const satisfies ReadonlyArray<{
  name: string
  group: EventCategoryGroup
  colorId: CategoryColorId
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

export function createDefaultCat(now: string): Cat {
  return {
    id: DEFAULT_CAT_ID,
    name: '我的貓',
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultCategories(now: string): EventCategory[] {
  return DEFAULT_CATEGORY_DEFINITIONS.map((category, index) => ({
    id: `default-category-${category.name}`,
    name: category.name,
    group: category.group,
    colorId: category.colorId,
    isDefault: true,
    isQuickAction: true,
    isArchived: false,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  }))
}

export function normalizeDefaultCategory(category: EventCategory): EventCategory {
  const defaultCategory = DEFAULT_CATEGORY_DEFINITIONS.find((item) => item.name === category.name)

  if (!defaultCategory) {
    return {
      ...category,
      colorId: getCategoryColorId(category.colorId),
      isArchived: category.isArchived ?? false,
    }
  }

  return {
    ...category,
    group: defaultCategory.group,
    colorId: getCategoryColorId(category.colorId, defaultCategory.colorId),
    isDefault: category.isDefault || category.id === `default-category-${category.name}`,
    isArchived: category.isArchived ?? false,
    sortOrder: category.sortOrder ?? DEFAULT_CATEGORY_DEFINITIONS.indexOf(defaultCategory),
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

  return normalizeCategorySortOrders([...normalizedCategories, ...missingDefaultCategories])
}

function normalizeCategorySortOrders(categories: EventCategory[]): EventCategory[] {
  const nextSortOrderByGroup = new Map<EventCategoryGroup, number>()

  return categories.map((category, index) => {
    if (typeof category.sortOrder === 'number') {
      return category
    }

    const group = category.group ?? '攝取'
    const nextSortOrder = nextSortOrderByGroup.get(group) ?? index
    nextSortOrderByGroup.set(group, nextSortOrder + 1)

    return {
      ...category,
      sortOrder: nextSortOrder,
    }
  })
}

export function getCategoryColorOption(colorId?: CategoryColorId | string) {
  return CATEGORY_COLOR_OPTIONS.find((option) => option.id === colorId) ?? getDefaultCategoryColorOption()
}

export function getDefaultCategoryColorOption() {
  return CATEGORY_COLOR_OPTIONS.find((option) => option.id === DEFAULT_CATEGORY_COLOR_ID) ?? CATEGORY_COLOR_OPTIONS[0]
}

export function getCategoryColorValue(category?: Pick<EventCategory, 'colorId'>): string {
  return getCategoryColorOption(getCategoryColorId(category?.colorId)).value
}

export function getCategoryColorId(
  colorId?: CategoryColorId | string,
  fallbackColorId: CategoryColorId = DEFAULT_CATEGORY_COLOR_ID,
): CategoryColorId {
  if (colorId && CATEGORY_COLOR_OPTIONS.some((option) => option.id === colorId)) {
    return colorId as CategoryColorId
  }

  return fallbackColorId
}
