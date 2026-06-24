import type { Cat, CreateCatInput, UpdateCatInput } from '@/types'
import { createId } from '@/utils/id'

export function createCatRecord(input: CreateCatInput, now: string): Cat {
  return {
    id: createId('cat'),
    name: input.name,
    avatarId: input.avatarId,
    birthday: input.birthday,
    sex: input.sex,
    weightKg: input.weightKg,
    isNeutered: input.isNeutered,
    note: input.note,
    isArchived: input.isArchived ?? false,
    createdAt: now,
    updatedAt: now,
  }
}

export function applyCatUpdate(cat: Cat, input: UpdateCatInput, now: string): void {
  Object.assign(cat, {
    ...input,
    updatedAt: now,
  })
}

export function archiveCat(cat: Cat, now: string): void {
  Object.assign(cat, {
    isArchived: true,
    updatedAt: now,
  })
}

export function restoreCatRecord(cat: Cat, now: string): void {
  Object.assign(cat, {
    isArchived: false,
    updatedAt: now,
  })
}

export function getFallbackSelectedCatId(cats: Cat[], excludedCatId?: string): string {
  return cats.find((cat) => !cat.isArchived && cat.id !== excludedCatId)?.id ?? ''
}
