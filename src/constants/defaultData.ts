import type { Cat, EventCategory } from '@/types'

export const DEFAULT_CAT_ID = 'default-cat'

export const QUICK_CATEGORY_NAMES = ['嘔吐', '軟便', '食慾差', '嚎叫', '攻擊', '用藥'] as const

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
    isDefault: true,
    isQuickAction: true,
    createdAt: now,
    updatedAt: now,
  }))
}
