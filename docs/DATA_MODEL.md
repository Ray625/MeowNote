# Data Model

The source of truth for TypeScript model types is:

```txt
src/types/cat.ts
```

The source of truth for Supabase SQL is:

```txt
docs/SUPABASE_SCHEMA.sql
```

## Persisted Local State

The local repository persists this shape to `localStorage`:

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

- `id` should be a UUID, even before login.
- `avatarId` maps to `CAT_AVATAR_OPTIONS` in `src/constants/defaultData.ts`.
- `birthday` is stored as a date string from an HTML date input.
- Most profile fields are optional to reduce setup friction.
- `isArchived` hides a cat from active creation flows while preserving historical records.

Deletion rules:

- if the cat has events, archive it
- if the cat has no events, hard-delete it
- archived cats should remain available for historical review
- archived cats should not allow new event creation

## EventCategory

```ts
interface EventCategory {
  id: string
  templateId?: string
  name: string
  group?: EventCategoryGroup
  colorId?: CategoryColorId
  icon?: string
  isDefault: boolean
  isQuickAction: boolean
  isArchived: boolean
  sortOrder: number
  statisticsMode: CategoryStatisticsMode
  valueLabel?: string
  valueUnit?: string
  valueMax?: number
  createdAt: string
  updatedAt: string
}
```

Category groups:

```ts
type EventCategoryGroup = '飲食' | '健康' | '行為' | '日常' | '醫療'
```

Statistics modes:

```ts
type CategoryStatisticsMode = 'count' | 'sum' | 'measurement' | 'rating'
```

Behavior:

- `templateId` links a user category back to a system template when applicable.
- `isQuickAction` controls whether a category appears in quick record.
- `isArchived` hides a category from active creation flows.
- `sortOrder` controls ordering inside a group.
- `statisticsMode` controls numeric input behavior and stats display.
- `valueLabel`, `valueUnit`, and `valueMax` are used by numeric/statistical modes.

Deletion rules:

- if the category has events, archive it and set `isQuickAction` to false
- if the category has no events, hard-delete it
- restoring an archived category should make it active again

Quick record display:

- show non-archived categories where `isQuickAction` is true
- do not hide quick actions just because the category currently has no events

Stats display:

- show categories that have actual events for the selected cat
- archived categories may still appear in stats when they have historical records

## Category Statistics Modes

### `count`

Frequency-only tracking.

Examples:

- 嘔吐
- 腹瀉
- 夜間活動
- 外出

Event values:

- usually `{}` or omitted

Stats:

- occurrence count
- period totals
- previous period comparison

### `sum`

Additive numeric values.

Examples:

- 飲水
- 食物量
- 用藥劑量

Event values:

```ts
{
  value: number
}
```

Stats:

- daily totals
- daily average calculated only from days with records

Do not include empty days when calculating the average.

### `measurement`

Independent measurements.

Examples:

- 體重
- 體溫

Event values:

```ts
{
  value: number
}
```

Stats:

- latest value
- min/max
- trend points

Do not calculate accumulated totals for this mode.

### `rating`

Subjective score.

Examples:

- 精神狀態
- 食慾

Event values:

```ts
{
  value: number
}
```

Rules:

- score must be an integer
- minimum is 1
- `valueMax` is required for rating categories and defaults to 10
- when a category is changed to `rating`, numeric input should be enabled automatically
- default `valueLabel` is 評分

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

- `id` should be a UUID, even before login.
- `catId` points to a `Cat`.
- `categoryId` points to an `EventCategory`.
- `occurredAt` is the event time and is used for calendar grouping and stats.
- `title`, `severity`, `note`, and `values` are optional detail fields.
- `values` is intentionally JSON-shaped so future value types can be added without changing the event table.

Category change behavior:

- when an event changes category, incompatible numeric values should be cleared
- save incompatible category changes with `values = {}`
- do not preserve old numeric data under a new category if the semantic meaning changed

## Supabase Tables

Current remote tables:

- `profiles`
- `notebooks`
- `notebook_members`
- `cats`
- `event_categories`
- `cat_events`

Notebook ownership:

- a notebook is created by a user
- membership rows control access
- roles are `owner`, `editor`, and `viewer`
- `owner` can manage notebook metadata, pets, categories, and all records
- `editor` can read notebook data and create records in the notebook
- `editor` can update/delete only records where `cat_events.created_by` is their own user ID
- `viewer` is reserved for read-only access

Remote records are scoped by `notebook_id`.
Remote record authorship is tracked by `cat_events.created_by`.

The remote schema uses UUID primary keys. App-generated local UUIDs should be compatible with remote IDs to avoid local-to-remote ID remapping.

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

Do not introduce temporary local IDs for records that may later sync to Supabase.

## Dates

Date helpers live in:

```txt
src/utils/datetime.ts
```

Stored timestamps are ISO strings.

Calendar day matching uses local date comparisons so events are grouped by the user's local day.

## Migration Notes

There is no formal migration framework yet.

Current compatibility behavior:

- read old `cat-log:v1` data if `meownote:v1` is not present
- normalize loaded categories and cats
- ensure local IDs are UUID-compatible where possible
- archive old default categories that should no longer appear as active defaults

If future data changes become more complex, add explicit versioning to the persisted state before changing field semantics.
