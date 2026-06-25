import { describe, expect, it } from 'vitest'
import {
  createCalendarDays,
  createEventCountByDate,
  createSearchedEventGroups,
  createVisibleMonthEventGroups,
  createUsageCounts,
  getCategoriesWithEventsForCat,
  getEventsForDate,
  getFilteredEventsForCat,
  getEventsInVisibleMonth,
  groupEventsByDate,
  groupEventsByMonth,
  sortCategories,
} from './selectors'
import type { CatEvent, EventCategory } from '@/types'

function createCategory(input: Partial<EventCategory> & Pick<EventCategory, 'id'>): EventCategory {
  return {
    id: input.id,
    name: input.name ?? input.id,
    group: input.group ?? '健康',
    colorId: input.colorId ?? 'teal',
    isDefault: false,
    isQuickAction: input.isQuickAction ?? true,
    isArchived: input.isArchived ?? false,
    sortOrder: input.sortOrder ?? 0,
    statisticsMode: input.statisticsMode ?? 'count',
    createdAt: input.createdAt ?? '2026-06-24T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-06-24T00:00:00.000Z',
    valueLabel: input.valueLabel,
    valueUnit: input.valueUnit,
  }
}

function createEvent(input: Partial<CatEvent> & Pick<CatEvent, 'id' | 'occurredAt'>): CatEvent {
  return {
    id: input.id,
    catId: input.catId ?? 'cat-1',
    categoryId: input.categoryId ?? 'category-1',
    occurredAt: input.occurredAt,
    values: input.values,
    title: input.title,
    note: input.note,
    createdAt: input.createdAt ?? input.occurredAt,
    updatedAt: input.updatedAt ?? input.occurredAt,
  }
}

describe('cat tracker selectors', () => {
  it('sorts active categories before archived categories, then by sort order and created time', () => {
    const sorted = sortCategories([
      createCategory({ id: 'archived', isArchived: true, sortOrder: 0 }),
      createCategory({ id: 'late', sortOrder: 2 }),
      createCategory({ id: 'early-created', sortOrder: 1, createdAt: '2026-06-01T00:00:00.000Z' }),
      createCategory({ id: 'late-created', sortOrder: 1, createdAt: '2026-06-02T00:00:00.000Z' }),
    ])

    expect(sorted.map((category) => category.id)).toEqual([
      'early-created',
      'late-created',
      'late',
      'archived',
    ])
  })

  it('counts usage by any selected event id field', () => {
    const counts = createUsageCounts(
      [
        createEvent({ id: 'event-1', categoryId: 'vomit', occurredAt: '2026-06-24T00:00:00.000Z' }),
        createEvent({ id: 'event-2', categoryId: 'vomit', occurredAt: '2026-06-24T01:00:00.000Z' }),
        createEvent({ id: 'event-3', categoryId: 'water', occurredAt: '2026-06-24T02:00:00.000Z' }),
      ],
      (event) => event.categoryId,
    )

    expect(counts.get('vomit')).toBe(2)
    expect(counts.get('water')).toBe(1)
  })

  it('creates date counts and calendar cells for a visible month', () => {
    const eventCountByDate = createEventCountByDate([
      createEvent({ id: 'event-1', occurredAt: '2026-06-24T00:00:00.000Z' }),
      createEvent({ id: 'event-2', occurredAt: '2026-06-24T01:00:00.000Z' }),
    ])
    const days = createCalendarDays({
      visibleMonth: new Date(2026, 5, 1),
      selectedDate: new Date(2026, 5, 24),
      today: new Date(2026, 5, 24),
      eventCountByDate,
    })
    const june24 = days.find((day) => day.key === '2026-06-24')

    expect(days).toHaveLength(42)
    expect(days[0]?.key).toBe('2026-05-31')
    expect(june24).toMatchObject({
      dayNumber: 24,
      eventCount: 2,
      isCurrentMonth: true,
      isSelected: true,
      isToday: true,
    })
  })

  it('filters events to the visible month', () => {
    const events = [
      createEvent({ id: 'may', occurredAt: '2026-05-31T10:00:00.000Z' }),
      createEvent({ id: 'june', occurredAt: '2026-06-01T08:00:00+08:00' }),
      createEvent({ id: 'july', occurredAt: '2026-07-01T08:00:00+08:00' }),
    ]

    expect(getEventsInVisibleMonth(events, new Date(2026, 5, 1)).map((event) => event.id)).toEqual([
      'june',
    ])
  })

  it('groups events by date while preserving the provided event order', () => {
    const categoriesById = new Map([
      ['category-1', createCategory({ id: 'category-1', name: '嘔吐' })],
    ])
    const groups = groupEventsByDate(
      [
        createEvent({ id: 'morning', occurredAt: '2026-06-24T08:00:00+08:00' }),
        createEvent({ id: 'night', occurredAt: '2026-06-24T22:00:00+08:00' }),
      ],
      categoriesById,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('2026-06-24')
    expect(groups[0]?.items.map((item) => item.event.id)).toEqual(['morning', 'night'])
    expect(groups[0]?.items[0]?.category?.name).toBe('嘔吐')
  })

  it('groups search results by month', () => {
    const categoriesById = new Map([
      ['category-1', createCategory({ id: 'category-1', name: '飲水' })],
    ])
    const groups = groupEventsByMonth(
      [
        createEvent({ id: 'june', occurredAt: '2026-06-24T08:00:00.000Z' }),
        createEvent({ id: 'may', occurredAt: '2026-05-24T08:00:00.000Z' }),
      ],
      categoriesById,
    )

    expect(groups.map((group) => group.key)).toEqual(['2026-06', '2026-05'])
    expect(groups[0]?.items[0]?.category?.name).toBe('飲水')
    expect(groups[0]?.items[0]?.dateText).toBeTruthy()
  })

  it('filters selected cat events and category filters', () => {
    const events = [
      createEvent({ id: 'cat-1-water', catId: 'cat-1', categoryId: 'water', occurredAt: '2026-06-24T08:00:00.000Z' }),
      createEvent({ id: 'cat-1-vomit', catId: 'cat-1', categoryId: 'vomit', occurredAt: '2026-06-24T09:00:00.000Z' }),
      createEvent({ id: 'cat-2-water', catId: 'cat-2', categoryId: 'water', occurredAt: '2026-06-24T10:00:00.000Z' }),
    ]

    expect(getFilteredEventsForCat(events, 'cat-1').map((event) => event.id)).toEqual([
      'cat-1-water',
      'cat-1-vomit',
    ])
    expect(getFilteredEventsForCat(events, 'cat-1', ['vomit']).map((event) => event.id)).toEqual([
      'cat-1-vomit',
    ])
  })

  it('returns categories with records for the selected cat', () => {
    const categories = [
      createCategory({ id: 'water', sortOrder: 2 }),
      createCategory({ id: 'vomit', sortOrder: 1 }),
      createCategory({ id: 'unused', sortOrder: 0 }),
    ]
    const events = [
      createEvent({ id: 'cat-1-water', catId: 'cat-1', categoryId: 'water', occurredAt: '2026-06-24T08:00:00.000Z' }),
      createEvent({ id: 'cat-1-vomit', catId: 'cat-1', categoryId: 'vomit', occurredAt: '2026-06-24T09:00:00.000Z' }),
      createEvent({ id: 'cat-2-unused', catId: 'cat-2', categoryId: 'unused', occurredAt: '2026-06-24T10:00:00.000Z' }),
    ]

    expect(getCategoriesWithEventsForCat(events, categories, 'cat-1').map((category) => category.id)).toEqual([
      'vomit',
      'water',
    ])
  })

  it('sorts events for a selected date by occurrence and creation time', () => {
    const events = [
      createEvent({ id: 'later', occurredAt: '2026-06-24T10:00:00.000Z' }),
      createEvent({ id: 'same-late-created', occurredAt: '2026-06-24T08:00:00.000Z', createdAt: '2026-06-24T08:01:00.000Z' }),
      createEvent({ id: 'same-early-created', occurredAt: '2026-06-24T08:00:00.000Z', createdAt: '2026-06-24T08:00:30.000Z' }),
      createEvent({ id: 'other-day', occurredAt: '2026-06-25T08:00:00.000Z' }),
    ]

    expect(getEventsForDate(events, new Date('2026-06-24T12:00:00.000Z')).map((event) => event.id)).toEqual([
      'same-early-created',
      'same-late-created',
      'later',
    ])
  })

  it('creates visible month groups from filtered events', () => {
    const categoriesById = new Map([
      ['category-1', createCategory({ id: 'category-1', name: '嘔吐' })],
    ])
    const groups = createVisibleMonthEventGroups(
      [
        createEvent({ id: 'june-late', occurredAt: '2026-06-24T22:00:00+08:00' }),
        createEvent({ id: 'june-early', occurredAt: '2026-06-24T08:00:00+08:00' }),
        createEvent({ id: 'july', occurredAt: '2026-07-01T08:00:00+08:00' }),
      ],
      new Date(2026, 5, 1),
      categoriesById,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.items.map((item) => item.event.id)).toEqual(['june-early', 'june-late'])
  })

  it('searches events by category, value text, title, and note', () => {
    const categoriesById = new Map([
      [
        'water',
        createCategory({
          id: 'water',
          name: '飲水',
          statisticsMode: 'sum',
          valueLabel: '飲水量',
          valueUnit: 'ml',
        }),
      ],
      ['vomit', createCategory({ id: 'vomit', name: '嘔吐' })],
    ])
    const events = [
      createEvent({ id: 'category', categoryId: 'vomit', occurredAt: '2026-06-24T08:00:00.000Z' }),
      createEvent({
        id: 'value',
        categoryId: 'water',
        occurredAt: '2026-06-23T08:00:00.000Z',
        values: { amount: 30 },
      }),
      createEvent({ id: 'title', categoryId: 'water', occurredAt: '2026-06-22T08:00:00.000Z', title: '喝很多' }),
      createEvent({ id: 'note', categoryId: 'water', occurredAt: '2026-06-21T08:00:00.000Z', note: '睡前補水' }),
    ]

    expect(
      createSearchedEventGroups({ events, categoriesById, query: '嘔吐' })
        .flatMap((group) => group.items)
        .map((item) => item.event.id),
    ).toEqual(['category'])
    expect(
      createSearchedEventGroups({ events, categoriesById, query: '30 ml' })
        .flatMap((group) => group.items)
        .map((item) => item.event.id),
    ).toEqual(['value'])
    expect(
      createSearchedEventGroups({ events, categoriesById, query: '很多' })
        .flatMap((group) => group.items)
        .map((item) => item.event.id),
    ).toEqual(['title'])
    expect(
      createSearchedEventGroups({ events, categoriesById, query: '補水' })
        .flatMap((group) => group.items)
        .map((item) => item.event.id),
    ).toEqual(['note'])
  })
})
