import {
  addDays,
  addMonths,
  formatEventTime,
  formatMonthEventGroupTitle,
  formatSearchEventDate,
  formatSearchEventGroupTitle,
  isSameDate,
  startOfMonth,
  toDateKey,
} from '@/domain/catTracker/date'
import type { CatEvent, EventCategory } from '@/types'

export interface CalendarDay {
  date: Date
  key: string
  dayNumber: number
  eventCount: number
  isCurrentMonth: boolean
  isSelected: boolean
  isToday: boolean
}

export interface EventListItem {
  event: CatEvent
  category?: EventCategory
  dateText?: string
  time: string
}

export interface MonthlyEventGroup {
  key: string
  title: string
  items: EventListItem[]
}

export function sortCategories(categories: EventCategory[]): EventCategory[] {
  return [...categories].sort((left, right) => {
    const archivedOrder = Number(left.isArchived) - Number(right.isArchived)

    if (archivedOrder !== 0) {
      return archivedOrder
    }

    const sortOrder = left.sortOrder - right.sortOrder

    if (sortOrder !== 0) {
      return sortOrder
    }

    return left.createdAt.localeCompare(right.createdAt)
  })
}

export function createUsageCounts(
  events: CatEvent[],
  getId: (event: CatEvent) => string,
): Map<string, number> {
  const usageCounts = new Map<string, number>()

  for (const event of events) {
    const id = getId(event)

    usageCounts.set(id, (usageCounts.get(id) ?? 0) + 1)
  }

  return usageCounts
}

export function createEventCountByDate(events: CatEvent[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const event of events) {
    const key = toDateKey(new Date(event.occurredAt))

    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

export function createCalendarDays({
  visibleMonth,
  selectedDate,
  today,
  eventCountByDate,
}: {
  visibleMonth: Date
  selectedDate: Date
  today: Date
  eventCountByDate: Map<string, number>
}): CalendarDay[] {
  const firstDay = startOfMonth(visibleMonth)
  const calendarStart = addDays(firstDay, -firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(calendarStart, index)
    const key = toDateKey(date)

    return {
      date,
      key,
      dayNumber: date.getDate(),
      eventCount: eventCountByDate.get(key) ?? 0,
      isCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
      isSelected: isSameDate(date, selectedDate),
      isToday: isSameDate(date, today),
    }
  })
}

export function createEventListItems(
  events: CatEvent[],
  categoriesById: Map<string, EventCategory>,
): EventListItem[] {
  return events.map((event) => ({
    event,
    category: categoriesById.get(event.categoryId),
    time: formatEventTime(event.occurredAt),
  }))
}

export function groupEventsByDate(
  events: CatEvent[],
  categoriesById: Map<string, EventCategory>,
): MonthlyEventGroup[] {
  const groups = new Map<string, MonthlyEventGroup>()

  for (const event of events) {
    const occurredAt = new Date(event.occurredAt)
    const key = toDateKey(occurredAt)
    const group = groups.get(key) ?? {
      key,
      title: formatMonthEventGroupTitle(occurredAt),
      items: [],
    }

    group.items.push({
      event,
      category: categoriesById.get(event.categoryId),
      time: formatEventTime(event.occurredAt),
    })
    groups.set(key, group)
  }

  return [...groups.values()]
}

export function groupEventsByMonth(
  events: CatEvent[],
  categoriesById: Map<string, EventCategory>,
): MonthlyEventGroup[] {
  const groups = new Map<string, MonthlyEventGroup>()

  for (const event of events) {
    const occurredAt = new Date(event.occurredAt)
    const key = `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, '0')}`
    const group = groups.get(key) ?? {
      key,
      title: formatSearchEventGroupTitle(occurredAt),
      items: [],
    }

    group.items.push({
      event,
      category: categoriesById.get(event.categoryId),
      dateText: formatSearchEventDate(occurredAt),
      time: formatEventTime(event.occurredAt),
    })
    groups.set(key, group)
  }

  return [...groups.values()]
}

export function getEventsInVisibleMonth(events: CatEvent[], visibleMonth: Date): CatEvent[] {
  const monthStart = startOfMonth(visibleMonth)
  const nextMonthStart = addMonths(monthStart, 1)

  return events.filter((event) => {
    const occurredAt = new Date(event.occurredAt)

    return occurredAt >= monthStart && occurredAt < nextMonthStart
  })
}
