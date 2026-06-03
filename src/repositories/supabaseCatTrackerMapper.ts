import type {
  Cat,
  CatAvatarId,
  CatEvent,
  CategoryColorId,
  EventCategory,
  EventCategoryGroup,
  CategoryStatisticsMode,
} from '@/types'

export interface SupabaseCatRow {
  id: string
  notebook_id: string
  name: string
  avatar_id: string | null
  avatar_url: string | null
  birthday: string | null
  sex: string | null
  weight_kg: number | null
  is_neutered: boolean | null
  note: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface SupabaseEventCategoryRow {
  id: string
  notebook_id: string
  template_id: string | null
  name: string
  group_name: string | null
  color_id: string
  icon: string | null
  is_default: boolean
  is_quick_action: boolean
  is_archived: boolean
  sort_order: number
  statistics_mode: string
  value_label: string | null
  value_max: number | null
  value_unit: string | null
  created_at: string
  updated_at: string
}

export interface SupabaseCatEventRow {
  id: string
  notebook_id: string
  cat_id: string
  category_id: string
  occurred_at: string
  title: string | null
  severity: number | null
  note: string | null
  values: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export type InsertCatRow = Omit<SupabaseCatRow, 'created_at' | 'updated_at'>
export type InsertEventCategoryRow = Omit<SupabaseEventCategoryRow, 'created_at' | 'updated_at'>
export type InsertCatEventRow = Omit<SupabaseCatEventRow, 'created_at' | 'updated_at'>

export interface ImportedIdMap {
  catIds: Map<string, string>
  categoryIds: Map<string, string>
}

export function toInsertCatRow(cat: Cat, notebookId: string): InsertCatRow {
  return {
    id: cat.id,
    notebook_id: notebookId,
    name: cat.name,
    avatar_id: cat.avatarId ?? null,
    avatar_url: null,
    birthday: cat.birthday ?? null,
    sex: cat.sex ?? null,
    weight_kg: cat.weightKg ?? null,
    is_neutered: cat.isNeutered ?? null,
    note: cat.note ?? null,
    is_archived: cat.isArchived,
  }
}

export function fromCatRow(row: SupabaseCatRow): Cat {
  return {
    id: row.id,
    name: row.name,
    avatarId: isCatAvatarId(row.avatar_id) ? row.avatar_id : undefined,
    birthday: row.birthday ?? undefined,
    sex: row.sex === 'male' || row.sex === 'female' ? row.sex : undefined,
    weightKg: row.weight_kg ?? undefined,
    isNeutered: row.is_neutered ?? undefined,
    note: row.note ?? undefined,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toInsertEventCategoryRow(
  category: EventCategory,
  notebookId: string,
): InsertEventCategoryRow {
  return {
    id: category.id,
    notebook_id: notebookId,
    template_id: category.templateId ?? null,
    name: category.name,
    group_name: category.group ?? null,
    color_id: category.colorId ?? 'teal',
    icon: category.icon ?? null,
    is_default: category.isDefault,
    is_quick_action: category.isQuickAction,
    is_archived: category.isArchived,
    sort_order: category.sortOrder,
    statistics_mode: category.statisticsMode,
    value_label: category.valueLabel ?? null,
    value_max: category.valueMax ?? null,
    value_unit: category.valueUnit ?? null,
  }
}

export function fromEventCategoryRow(row: SupabaseEventCategoryRow): EventCategory {
  return {
    id: row.id,
    templateId: row.template_id ?? undefined,
    name: row.name,
    group: isEventCategoryGroup(row.group_name) ? row.group_name : undefined,
    colorId: isCategoryColorId(row.color_id) ? row.color_id : undefined,
    icon: row.icon ?? undefined,
    isDefault: row.is_default,
    isQuickAction: row.is_quick_action,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
    statisticsMode: isCategoryStatisticsMode(row.statistics_mode) ? row.statistics_mode : 'count',
    valueLabel: row.value_label ?? undefined,
    valueMax: row.value_max ?? undefined,
    valueUnit: row.value_unit ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toInsertCatEventRow(
  event: CatEvent,
  notebookId: string,
  idMap: ImportedIdMap,
  createdBy: string | null = null,
): InsertCatEventRow | undefined {
  const catId = idMap.catIds.get(event.catId)
  const categoryId = idMap.categoryIds.get(event.categoryId)

  if (!catId || !categoryId) {
    return undefined
  }

  return {
    id: event.id,
    notebook_id: notebookId,
    cat_id: catId,
    category_id: categoryId,
    occurred_at: event.occurredAt,
    title: event.title ?? null,
    severity: event.severity ?? null,
    note: event.note ?? null,
    values: event.values ?? {},
    created_by: createdBy,
  }
}

export function fromCatEventRow(row: SupabaseCatEventRow): CatEvent {
  return {
    id: row.id,
    catId: row.cat_id,
    categoryId: row.category_id,
    occurredAt: row.occurred_at,
    title: row.title ?? undefined,
    severity: isEventSeverity(row.severity) ? row.severity : undefined,
    note: row.note ?? undefined,
    values: row.values,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isCatAvatarId(value: string | null): value is CatAvatarId {
  return (
    value === 'orange' ||
    value === 'tabby' ||
    value === 'calico' ||
    value === 'tortoiseshell' ||
    value === 'black' ||
    value === 'white' ||
    value === 'brown' ||
    value === 'gray' ||
    value === 'tuxedo' ||
    value === 'bengal' ||
    value === 'ragdoll' ||
    value === 'siamese' ||
    value === 'cream' ||
    value === 'blue' ||
    value === 'mackerel' ||
    value === 'abyssinian' ||
    value === 'dog-beagle' ||
    value === 'dog-bichon' ||
    value === 'dog-black-pug' ||
    value === 'dog-black-shiba' ||
    value === 'dog-border-collie' ||
    value === 'dog-chihuahua' ||
    value === 'dog-dachshund' ||
    value === 'dog-golden-retriever' ||
    value === 'dog-husky' ||
    value === 'dog-labrador' ||
    value === 'dog-maltese' ||
    value === 'dog-mixed' ||
    value === 'dog-poodle' ||
    value === 'dog-pug' ||
    value === 'dog-westie' ||
    value === 'dog-yellow-shiba'
  )
}

function isEventCategoryGroup(value: string | null): value is EventCategoryGroup {
  return (
    value === '飲食' || value === '健康' || value === '行為' || value === '日常' || value === '醫療'
  )
}

function isCategoryColorId(value: string | null): value is CategoryColorId {
  return (
    value === 'red' ||
    value === 'orange' ||
    value === 'amber' ||
    value === 'green' ||
    value === 'teal' ||
    value === 'blue' ||
    value === 'purple' ||
    value === 'pink'
  )
}

function isCategoryStatisticsMode(value: string | null): value is CategoryStatisticsMode {
  return value === 'count' || value === 'sum' || value === 'measurement' || value === 'rating'
}

function isEventSeverity(value: number | null): value is NonNullable<CatEvent['severity']> {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}
