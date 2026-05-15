import type { Cat, EventCategory } from '@/types'

export const DEFAULT_CAT_ID = 'default-cat'

export const QUICK_CATEGORY_NAMES = ['嘔吐', '軟便', '食慾差', '嚎叫', '攻擊', '用藥'] as const

export const DEFAULT_CATEGORY_COLORS: Record<(typeof QUICK_CATEGORY_NAMES)[number], string> = {
  嘔吐: '#ea6a2a',
  軟便: '#d84b32',
  食慾差: '#b9382f',
  嚎叫: '#3f7acb',
  攻擊: '#7550b8',
  用藥: '#2f9b63',
}

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

export function createDefaultCat(now: string): Cat {
  return {
    id: DEFAULT_CAT_ID,
    name: '我的貓',
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultCategories(now: string): EventCategory[] {
  return QUICK_CATEGORY_NAMES.map((name) => ({
    id: `default-category-${name}`,
    name,
    color: DEFAULT_CATEGORY_COLORS[name],
    isDefault: true,
    isQuickAction: true,
    createdAt: now,
    updatedAt: now,
  }))
}

export function applyDefaultCategoryColor(category: EventCategory): EventCategory {
  if (category.color || !isQuickCategoryName(category.name)) {
    return category
  }

  return {
    ...category,
    color: DEFAULT_CATEGORY_COLORS[category.name],
  }
}

function isQuickCategoryName(name: string): name is (typeof QUICK_CATEGORY_NAMES)[number] {
  return QUICK_CATEGORY_NAMES.includes(name as (typeof QUICK_CATEGORY_NAMES)[number])
}
