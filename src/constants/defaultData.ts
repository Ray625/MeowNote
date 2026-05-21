import catBengalImage from '@/assets/cat-avatars/cat-bengal.png'
import catBlackImage from '@/assets/cat-avatars/cat-black.png'
import catBlueImage from '@/assets/cat-avatars/cat-blue.png'
import catBrownImage from '@/assets/cat-avatars/cat-brown.png'
import catCalicoImage from '@/assets/cat-avatars/cat-calico.png'
import catCreamImage from '@/assets/cat-avatars/cat-cream.png'
import catGrayImage from '@/assets/cat-avatars/cat-gary.png'
import catMackerelImage from '@/assets/cat-avatars/cat-mackerel.png'
import catOrangeImage from '@/assets/cat-avatars/cat-orange.png'
import catRagdollImage from '@/assets/cat-avatars/cat-ragdoll.png'
import catSiameseImage from '@/assets/cat-avatars/cat-siamese.png'
import catTabbyImage from '@/assets/cat-avatars/cat-tabby.png'
import catTortoiseshellImage from '@/assets/cat-avatars/cat-tortoiseshell.png'
import catTuxedoImage from '@/assets/cat-avatars/cat-tuxedo.png'
import catWhiteImage from '@/assets/cat-avatars/cat-white.png'
import type { Cat, CatAvatarId, CategoryColorId, EventCategory, EventCategoryGroup } from '@/types'

export const DEFAULT_CAT_ID = 'default-cat'

export const CATEGORY_GROUP_ORDER: EventCategoryGroup[] = ['飲食', '健康', '行為', '日常', '醫療']

export const CAT_AVATAR_OPTIONS = [
  { id: 'orange', label: '橘', image: catOrangeImage },
  { id: 'tabby', label: '虎斑', image: catTabbyImage },
  { id: 'calico', label: '三花', image: catCalicoImage },
  { id: 'tortoiseshell', label: '玳瑁', image: catTortoiseshellImage },
  { id: 'black', label: '黑', image: catBlackImage },
  { id: 'white', label: '白', image: catWhiteImage },
  { id: 'brown', label: '棕白', image: catBrownImage },
  { id: 'gray', label: '銀灰', image: catGrayImage },
  { id: 'tuxedo', label: '賓士', image: catTuxedoImage },
  { id: 'bengal', label: '豹貓', image: catBengalImage },
  { id: 'ragdoll', label: '布偶', image: catRagdollImage },
  { id: 'siamese', label: '暹羅', image: catSiameseImage },
  { id: 'cream', label: '奶色', image: catCreamImage },
  { id: 'blue', label: '藍貓', image: catBlueImage },
  { id: 'mackerel', label: '鯖魚虎斑', image: catMackerelImage },
] as const satisfies ReadonlyArray<{
  id: CatAvatarId
  label: string
  image: string
}>

export const DEFAULT_CAT_AVATAR_ID = 'orange' satisfies CatAvatarId

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
  { name: '濕食', group: '飲食', colorId: 'orange' },
  { name: '乾糧', group: '飲食', colorId: 'amber' },
  { name: '飲水', group: '飲食', colorId: 'blue' },
  { name: '食欲變化', group: '健康', colorId: 'orange' },
  { name: '精神狀況', group: '健康', colorId: 'teal' },
  { name: '嘔吐', group: '健康', colorId: 'red' },
  { name: '腹瀉', group: '健康', colorId: 'pink' },
  { name: '泌尿異常', group: '健康', colorId: 'amber' },
  { name: '攻擊', group: '行為', colorId: 'purple' },
  { name: '嚎叫', group: '行為', colorId: 'blue' },
  { name: '不當排洩', group: '行為', colorId: 'amber' },
  { name: '躲藏', group: '行為', colorId: 'teal' },
  { name: '半夜不睡', group: '行為', colorId: 'purple' },
  { name: '刷牙', group: '日常', colorId: 'teal' },
  { name: '剪指甲', group: '日常', colorId: 'green' },
  { name: '梳毛', group: '日常', colorId: 'blue' },
  { name: '外出', group: '日常', colorId: 'blue' },
  { name: '體外驅蟲', group: '醫療', colorId: 'green' },
  { name: '預防針', group: '醫療', colorId: 'blue' },
  { name: '門診', group: '醫療', colorId: 'teal' },
  { name: '用藥', group: '醫療', colorId: 'purple' },
] as const satisfies ReadonlyArray<{
  name: string
  group: EventCategoryGroup
  colorId: CategoryColorId
}>

const LEGACY_DEFAULT_CATEGORY_NAMES = ['排便', '排尿', '軟便', '皮下點滴', '夜擾'] as const

export const FUTURE_CATEGORY_NAMES = ['過度舔毛', '外出訓練', '剪指甲訓練'] as const

export const QUICK_CATEGORY_NAMES = DEFAULT_CATEGORY_DEFINITIONS.map(
  (category) => category.name,
) as Array<(typeof DEFAULT_CATEGORY_DEFINITIONS)[number]['name']>

export function createDefaultCat(now: string): Cat {
  return {
    id: DEFAULT_CAT_ID,
    name: '我的貓',
    avatarId: DEFAULT_CAT_AVATAR_ID,
    isArchived: false,
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
    if (isLegacyDefaultCategory(category)) {
      return {
        ...category,
        colorId: getCategoryColorId(category.colorId),
        isQuickAction: false,
        isArchived: true,
      }
    }

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

function isLegacyDefaultCategory(category: EventCategory): boolean {
  return LEGACY_DEFAULT_CATEGORY_NAMES.some(
    (name) =>
      category.name === name && (category.isDefault || category.id === `default-category-${name}`),
  )
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

    const group = category.group ?? '飲食'
    const nextSortOrder = nextSortOrderByGroup.get(group) ?? index
    nextSortOrderByGroup.set(group, nextSortOrder + 1)

    return {
      ...category,
      sortOrder: nextSortOrder,
    }
  })
}

export function getCategoryColorOption(colorId?: CategoryColorId | string) {
  return (
    CATEGORY_COLOR_OPTIONS.find((option) => option.id === colorId) ??
    getDefaultCategoryColorOption()
  )
}

export function getDefaultCategoryColorOption() {
  return (
    CATEGORY_COLOR_OPTIONS.find((option) => option.id === DEFAULT_CATEGORY_COLOR_ID) ??
    CATEGORY_COLOR_OPTIONS[0]
  )
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

export function getCatAvatarOption(avatarId?: CatAvatarId | string) {
  return CAT_AVATAR_OPTIONS.find((option) => option.id === avatarId) ?? getDefaultCatAvatarOption()
}

export function getDefaultCatAvatarOption() {
  return (
    CAT_AVATAR_OPTIONS.find((option) => option.id === DEFAULT_CAT_AVATAR_ID) ??
    CAT_AVATAR_OPTIONS[0]
  )
}
