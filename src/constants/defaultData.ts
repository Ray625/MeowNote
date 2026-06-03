import catAbyssinianImage from '@/assets/cat-avatars/cat-abyssinian.png'
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
import dogBeagleImage from '@/assets/dog-avatars/dog-beagle.png'
import dogBichonImage from '@/assets/dog-avatars/dog-bichon.png'
import dogBlackPugImage from '@/assets/dog-avatars/dog-black_pug.png'
import dogBlackShibaImage from '@/assets/dog-avatars/dog-black_shiba.png'
import dogBorderCollieImage from '@/assets/dog-avatars/dog-border collie.png'
import dogChihuahuaImage from '@/assets/dog-avatars/dog-chihuahua.png'
import dogDachshundImage from '@/assets/dog-avatars/dog-dachshund.png'
import dogGoldenRetrieverImage from '@/assets/dog-avatars/dog-golden retriever.png'
import dogHuskyImage from '@/assets/dog-avatars/dog-husky.png'
import dogLabradorImage from '@/assets/dog-avatars/dog-labrador.png'
import dogMalteseImage from '@/assets/dog-avatars/dog-maltese.png'
import dogMixedImage from '@/assets/dog-avatars/dog-mixed.png'
import dogPoodleImage from '@/assets/dog-avatars/dog-poodle.png'
import dogPugImage from '@/assets/dog-avatars/dog-pug.png'
import dogWestieImage from '@/assets/dog-avatars/dog-westie.png'
import dogYellowShibaImage from '@/assets/dog-avatars/dog-yellot_shiba.png'
import type {
  Cat,
  CatAvatarId,
  CategoryColorId,
  CategoryStatisticsMode,
  EventCategory,
  EventCategoryGroup,
} from '@/types'
import { createId } from '@/utils/id'

export const DEFAULT_CAT_ID = 'default-cat'

export const CATEGORY_GROUP_ORDER: EventCategoryGroup[] = ['飲食', '健康', '行為', '日常', '醫療']

export const CAT_AVATAR_OPTIONS = [
  { id: 'black', label: '黑', image: catBlackImage },
  { id: 'white', label: '白', image: catWhiteImage },
  { id: 'brown', label: '棕白', image: catBrownImage },
  { id: 'tuxedo', label: '賓士', image: catTuxedoImage },
  { id: 'gray', label: '銀灰', image: catGrayImage },
  { id: 'orange', label: '橘', image: catOrangeImage },
  { id: 'calico', label: '三花', image: catCalicoImage },
  { id: 'tortoiseshell', label: '玳瑁', image: catTortoiseshellImage },
  { id: 'tabby', label: '虎斑', image: catTabbyImage },
  { id: 'abyssinian', label: '赤棕', image: catAbyssinianImage },
  { id: 'mackerel', label: '銀虎斑', image: catMackerelImage },
  { id: 'siamese', label: '重點色', image: catSiameseImage },
  { id: 'cream', label: '奶白', image: catCreamImage },
  { id: 'bengal', label: '豹貓', image: catBengalImage },
  { id: 'ragdoll', label: '布偶', image: catRagdollImage },
  { id: 'blue', label: '藍貓', image: catBlueImage },
] as const satisfies ReadonlyArray<{
  id: CatAvatarId
  label: string
  image: string
}>

export const DOG_AVATAR_OPTIONS = [
  { id: 'dog-mixed', label: '米克斯', image: dogMixedImage },
  { id: 'dog-beagle', label: '米格魯', image: dogBeagleImage },
  { id: 'dog-bichon', label: '比熊', image: dogBichonImage },
  { id: 'dog-border-collie', label: '邊境牧羊犬', image: dogBorderCollieImage },
  { id: 'dog-chihuahua', label: '吉娃娃', image: dogChihuahuaImage },
  { id: 'dog-dachshund', label: '臘腸', image: dogDachshundImage },
  { id: 'dog-golden-retriever', label: '黃金獵犬', image: dogGoldenRetrieverImage },
  { id: 'dog-husky', label: '哈士奇', image: dogHuskyImage },
  { id: 'dog-labrador', label: '拉布拉多', image: dogLabradorImage },
  { id: 'dog-maltese', label: '瑪爾濟斯', image: dogMalteseImage },
  { id: 'dog-poodle', label: '貴賓', image: dogPoodleImage },
  { id: 'dog-westie', label: '西高地白㹴', image: dogWestieImage },
  { id: 'dog-pug', label: '巴哥', image: dogPugImage },
  { id: 'dog-black-pug', label: '黑巴哥', image: dogBlackPugImage },
  { id: 'dog-yellow-shiba', label: '柴犬', image: dogYellowShibaImage },
  { id: 'dog-black-shiba', label: '黑柴', image: dogBlackShibaImage },
] as const satisfies ReadonlyArray<{
  id: CatAvatarId
  label: string
  image: string
}>

export const PET_AVATAR_OPTIONS = [...CAT_AVATAR_OPTIONS, ...DOG_AVATAR_OPTIONS] as const

export const DEFAULT_CAT_AVATAR_ID = 'black' satisfies CatAvatarId

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
export const DEFAULT_CATEGORY_STATISTICS_MODE = 'count' satisfies CategoryStatisticsMode

export interface CategoryTemplate {
  id: string
  name: string
  group: EventCategoryGroup
  colorId: CategoryColorId
  statisticsMode: CategoryStatisticsMode
  valueLabel?: string
  valueMax?: number
  valueUnit?: string
}

export const CATEGORY_TEMPLATES: readonly CategoryTemplate[] = [
  {
    id: 'wet-food',
    name: '濕食',
    group: '飲食',
    colorId: 'orange',
    statisticsMode: 'sum',
    valueLabel: '份量',
    valueUnit: 'g',
  },
  {
    id: 'dry-food',
    name: '乾糧',
    group: '飲食',
    colorId: 'amber',
    statisticsMode: 'sum',
    valueLabel: '份量',
    valueUnit: 'g',
  },
  {
    id: 'water',
    name: '飲水',
    group: '飲食',
    colorId: 'blue',
    statisticsMode: 'sum',
    valueLabel: '飲水量',
    valueUnit: 'ml',
  },
  {
    id: 'appetite',
    name: '食慾',
    group: '健康',
    colorId: 'orange',
    statisticsMode: 'rating',
    valueLabel: '評分',
    valueMax: 10,
  },
  {
    id: 'energy',
    name: '精神狀態',
    group: '健康',
    colorId: 'teal',
    statisticsMode: 'rating',
    valueLabel: '評分',
    valueMax: 10,
  },
  { id: 'vomit', name: '嘔吐', group: '健康', colorId: 'red', statisticsMode: 'count' },
  { id: 'diarrhea', name: '腹瀉', group: '健康', colorId: 'pink', statisticsMode: 'count' },
  { id: 'urinary', name: '泌尿異常', group: '健康', colorId: 'amber', statisticsMode: 'count' },
  {
    id: 'inappropriate-elimination',
    name: '不當排洩',
    group: '行為',
    colorId: 'amber',
    statisticsMode: 'count',
  },
  {
    id: 'night-activity',
    name: '半夜不睡',
    group: '行為',
    colorId: 'purple',
    statisticsMode: 'count',
  },
  { id: 'tooth-brushing', name: '刷牙', group: '日常', colorId: 'teal', statisticsMode: 'count' },
  { id: 'nail-trim', name: '剪指甲', group: '日常', colorId: 'green', statisticsMode: 'count' },
  { id: 'grooming', name: '梳毛', group: '日常', colorId: 'blue', statisticsMode: 'count' },
  { id: 'outside', name: '外出', group: '日常', colorId: 'blue', statisticsMode: 'count' },
  {
    id: 'external-parasite',
    name: '體外驅蟲',
    group: '醫療',
    colorId: 'green',
    statisticsMode: 'count',
  },
  { id: 'vaccine', name: '預防針', group: '醫療', colorId: 'blue', statisticsMode: 'count' },
  { id: 'vet-visit', name: '門診', group: '醫療', colorId: 'teal', statisticsMode: 'count' },
  {
    id: 'medication',
    name: '用藥',
    group: '醫療',
    colorId: 'purple',
    statisticsMode: 'count',
  },
  {
    id: 'weight',
    name: '體重',
    group: '健康',
    colorId: 'green',
    statisticsMode: 'measurement',
    valueLabel: '體重',
    valueUnit: 'kg',
  },
] as const

export const DEFAULT_CATEGORY_DEFINITIONS = CATEGORY_TEMPLATES

const LEGACY_DEFAULT_CATEGORY_NAMES = ['排便', '排尿', '軟便', '皮下點滴', '夜擾'] as const

export const FUTURE_CATEGORY_NAMES = ['過度舔毛', '外出訓練', '剪指甲訓練'] as const

export const QUICK_CATEGORY_NAMES = DEFAULT_CATEGORY_DEFINITIONS.map(
  (category) => category.name,
) as Array<(typeof DEFAULT_CATEGORY_DEFINITIONS)[number]['name']>

export function createDefaultCat(now: string): Cat {
  return {
    id: createId(),
    name: '我的貓',
    avatarId: DEFAULT_CAT_AVATAR_ID,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultCategories(now: string): EventCategory[] {
  return DEFAULT_CATEGORY_DEFINITIONS.map((category, index) => ({
    id: createId(),
    templateId: category.id,
    name: category.name,
    group: category.group,
    colorId: category.colorId,
    isDefault: true,
    isQuickAction: true,
    isArchived: false,
    sortOrder: index,
    statisticsMode: category.statisticsMode,
    valueLabel: category.valueLabel,
    valueMax: category.valueMax,
    valueUnit: category.valueUnit,
    createdAt: now,
    updatedAt: now,
  }))
}

export function createCategoryFromTemplate(
  template: CategoryTemplate,
  sortOrder: number,
  now: string,
): EventCategory {
  return {
    id: createId(),
    templateId: template.id,
    name: template.name,
    group: template.group,
    colorId: template.colorId,
    isDefault: true,
    isQuickAction: true,
    isArchived: false,
    sortOrder,
    statisticsMode: template.statisticsMode,
    valueLabel: template.valueLabel,
    valueMax: template.valueMax,
    valueUnit: template.valueUnit,
    createdAt: now,
    updatedAt: now,
  }
}

export function normalizeDefaultCategory(category: EventCategory): EventCategory {
  const defaultCategory = DEFAULT_CATEGORY_DEFINITIONS.find((item) => item.name === category.name)
  const statisticsMode = getCategoryStatisticsMode(category.statisticsMode)

  if (!defaultCategory) {
    if (isLegacyDefaultCategory(category)) {
      return {
        ...category,
        colorId: getCategoryColorId(category.colorId),
        isQuickAction: false,
        isArchived: true,
        statisticsMode,
        valueMax: category.valueMax,
      }
    }

    return {
      ...category,
      colorId: getCategoryColorId(category.colorId),
      isArchived: category.isArchived ?? false,
      statisticsMode,
      valueMax: category.valueMax,
    }
  }

  return {
    ...category,
    templateId: category.templateId ?? defaultCategory.id,
    group: defaultCategory.group,
    colorId: getCategoryColorId(category.colorId, defaultCategory.colorId),
    isDefault: category.isDefault || category.id === `default-category-${category.name}`,
    isArchived: category.isArchived ?? false,
    sortOrder: category.sortOrder ?? DEFAULT_CATEGORY_DEFINITIONS.indexOf(defaultCategory),
    isQuickAction:
      (category.isQuickAction || category.id === `default-category-${category.name}`) &&
      !(category.isArchived ?? false),
    statisticsMode: getCategoryStatisticsMode(
      category.statisticsMode,
      defaultCategory.statisticsMode,
    ),
    valueLabel: category.valueLabel ?? defaultCategory.valueLabel,
    valueMax: category.valueMax ?? defaultCategory.valueMax,
    valueUnit: category.valueUnit ?? defaultCategory.valueUnit,
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

  return normalizeCategorySortOrders(normalizedCategories)
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

export function getCategoryStatisticsMode(
  statisticsMode?: CategoryStatisticsMode | string,
  fallbackStatisticsMode: CategoryStatisticsMode = DEFAULT_CATEGORY_STATISTICS_MODE,
): CategoryStatisticsMode {
  if (
    statisticsMode === 'count' ||
    statisticsMode === 'sum' ||
    statisticsMode === 'measurement' ||
    statisticsMode === 'rating'
  ) {
    return statisticsMode
  }

  return fallbackStatisticsMode
}

export function getCatAvatarOption(avatarId?: CatAvatarId | string) {
  return PET_AVATAR_OPTIONS.find((option) => option.id === avatarId) ?? getDefaultCatAvatarOption()
}

export function isDogAvatarId(avatarId?: CatAvatarId | string): boolean {
  return typeof avatarId === 'string' && avatarId.startsWith('dog-')
}

export function getDefaultCatAvatarOption() {
  return (
    CAT_AVATAR_OPTIONS.find((option) => option.id === DEFAULT_CAT_AVATAR_ID) ??
    CAT_AVATAR_OPTIONS[0]
  )
}
