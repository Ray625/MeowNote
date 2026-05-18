export interface Cat {
  id: string
  name: string
  avatarUrl?: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface EventCategory {
  id: string
  name: string
  group?: EventCategoryGroup
  color?: string
  icon?: string
  isDefault: boolean
  isQuickAction: boolean
  createdAt: string
  updatedAt: string
}

export interface CatEvent {
  id: string
  catId: string
  categoryId: string
  occurredAt: string
  severity?: 1 | 2 | 3 | 4 | 5
  note?: string
  createdAt: string
  updatedAt: string
}

export type EventCategoryGroup = '攝取' | '排泄' | '行為' | '日常' | '用藥'

export type EventSeverity = NonNullable<CatEvent['severity']>

export type CreateCatInput = Pick<Cat, 'name'> & Partial<Pick<Cat, 'avatarUrl' | 'note'>>

export type CreateCategoryInput = Pick<EventCategory, 'name'> &
  Partial<Pick<EventCategory, 'color' | 'group' | 'icon' | 'isQuickAction'>>

export type CreateCatEventInput = Pick<CatEvent, 'catId' | 'categoryId'> &
  Partial<Pick<CatEvent, 'occurredAt' | 'severity' | 'note'>>

export type UpdateCatEventInput = Partial<
  Pick<CatEvent, 'catId' | 'categoryId' | 'occurredAt' | 'severity' | 'note'>
>
