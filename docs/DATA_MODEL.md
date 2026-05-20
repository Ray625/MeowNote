# Data Model

The source of truth for model types is:

```txt
src/types/cat.ts
```

## Persisted State

The repository persists this shape to `localStorage`:

```ts
interface CatTrackerState {
  cats: Cat[]
  categories: EventCategory[]
  events: CatEvent[]
  selectedCatId: string
}
```

Current storage key:

```txt
meownote:v1
```

Legacy fallback key:

```txt
cat-log:v1
```

## Persistence Boundary

The persistence boundary is:

```txt
src/repositories/catTrackerRepository.ts
```

The Pinia store works with in-memory Vue refs and calls this repository to load and save `CatTrackerState`. The repository currently uses `localStorage`, but it is the intended replacement point for future account-based sync or database-backed storage.

## Cat

```ts
interface Cat {
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
```

Notes:

- `avatarId` maps to `CAT_AVATAR_OPTIONS` in `src/constants/defaultData.ts`.
- `birthday` is stored as a date string from an HTML date input.
- `isArchived` hides a cat from active daily use while preserving historical events.
- `createdAt` and `updatedAt` are ISO strings.

## EventCategory

```ts
interface EventCategory {
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
```

Category groups:

```ts
type EventCategoryGroup = '飲食' | '健康' | '行為' | '日常' | '醫療'
```

Behavior:

- `isQuickAction` controls whether a category appears in the quick record panel.
- `isArchived` hides a category from active use while preserving historical events.
- `sortOrder` controls ordering inside a group.
- Default categories are created from `DEFAULT_CATEGORY_DEFINITIONS`.

## CatEvent

```ts
interface CatEvent {
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
```

Notes:

- `catId` points to a `Cat`.
- `categoryId` points to an `EventCategory`.
- `occurredAt` is the event time and is used for calendar grouping.
- `title`, `severity`, `note`, and `values` are optional detail fields.

## Input Types

The store exposes narrower input types for creates and updates:

- `CreateCatInput`
- `UpdateCatInput`
- `CreateCategoryInput`
- `UpdateCategoryInput`
- `CreateCatEventInput`
- `UpdateCatEventInput`

These types avoid requiring generated fields such as IDs and timestamps at call sites.

## IDs

IDs are created by:

```txt
src/utils/id.ts
```

The helper prefers `crypto.randomUUID()` and falls back to timestamp plus random text.

## Dates

Date helpers live in:

```txt
src/utils/datetime.ts
```

Most stored timestamps are ISO strings.

Calendar day matching uses local date comparisons so events are grouped by the user's local day.

## Migration Notes

There is no formal migration framework yet.

Current compatibility behavior:

- read old `cat-log:v1` data if `meownote:v1` is not present
- ensure current default categories exist
- archive old default categories that are no longer part of the current default quick action set

If future data changes become more complex, add explicit versioning to the persisted state before changing field semantics.
