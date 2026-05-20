export interface Cat {
  id: string
  name: string
  avatarId?: CatAvatarId
  birthday?: string
  sex?: CatSex
  weightKg?: number
  isNeutered?: boolean
  note?: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface EventCategory {
  id: string
  name: string
  group?: EventCategoryGroup
  colorId?: CategoryColorId
  icon?: string
  isDefault: boolean
  isQuickAction: boolean
  isArchived: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CatEvent {
  id: string
  catId: string
  categoryId: string
  occurredAt: string
  title?: string
  severity?: 1 | 2 | 3 | 4 | 5
  note?: string
  values?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type EventCategoryGroup = '飲食' | '健康' | '行為' | '日常' | '醫療'

export type CatSex = 'male' | 'female'

export type CatAvatarId =
  | 'orange'
  | 'tabby'
  | 'calico'
  | 'tortoiseshell'
  | 'black'
  | 'white'
  | 'brown'
  | 'gray'
  | 'tuxedo'

export type CategoryColorId =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink'

export type EventSeverity = NonNullable<CatEvent['severity']>

export type CreateCatInput = Pick<Cat, 'name'> &
  Partial<
    Pick<Cat, 'avatarId' | 'birthday' | 'sex' | 'weightKg' | 'isNeutered' | 'note' | 'isArchived'>
  >

export type UpdateCatInput = Partial<
  Pick<
    Cat,
    'avatarId' | 'birthday' | 'isArchived' | 'isNeutered' | 'name' | 'note' | 'sex' | 'weightKg'
  >
>

export type CreateCategoryInput = Pick<EventCategory, 'name'> &
  Partial<
    Pick<EventCategory, 'colorId' | 'group' | 'icon' | 'isArchived' | 'isQuickAction' | 'sortOrder'>
  >

export type UpdateCategoryInput = Partial<
  Pick<
    EventCategory,
    'colorId' | 'group' | 'icon' | 'isArchived' | 'isQuickAction' | 'name' | 'sortOrder'
  >
>

export type CreateCatEventInput = Pick<CatEvent, 'catId' | 'categoryId'> &
  Partial<Pick<CatEvent, 'occurredAt' | 'title' | 'severity' | 'note' | 'values'>>

export type UpdateCatEventInput = Partial<
  Pick<CatEvent, 'catId' | 'categoryId' | 'occurredAt' | 'title' | 'severity' | 'note' | 'values'>
>
