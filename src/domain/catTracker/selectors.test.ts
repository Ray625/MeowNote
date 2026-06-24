import { describe, expect, it } from 'vitest'
import {
  createCalendarDays,
  createEventCountByDate,
  createUsageCounts,
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
  }
}

function createEvent(input: Partial<CatEvent> & Pick<CatEvent, 'id' | 'occurredAt'>): CatEvent {
  return {
    id: input.id,
    catId: input.catId ?? 'cat-1',
    categoryId: input.categoryId ?? 'category-1',
    occurredAt: input.occurredAt,
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
})
