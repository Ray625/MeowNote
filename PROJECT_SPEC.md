# Cat Health & Behavior Tracker - MVP v1 Spec

## Product Direction

Build a cat health and behavior tracking app for serious cat owners.

The core product principle is:

> Quick-first, detail-later.

Users should be able to record an event in a few seconds. Details can be added later.

This app is not a pet diary. It is an event-based health and behavior tracking system.

---

## MVP Goal

Build a frontend-only MVP that allows users to:

1. Create or use a default cat
2. Quickly record an event by clicking a category button
3. View today's records
4. Add optional details later
5. View records on a simple calendar
6. See basic monthly statistics

No backend for MVP v1.

Use localStorage for persistence.

---

## Tech Stack

Use:

- Vue 3
- TypeScript
- Pinia
- Vue Router optional
- localStorage
- date-fns optional

Do not use backend, API, auth, or database in this version.

---

## Core UX Principle

Recording an event should require as few steps as possible.

Ideal daily flow:

```txt
Open app → tap "Vomiting" → record created

The app should automatically fill:

cat: selected/default cat
occurredAt: current date and time
category: selected category

Optional fields such as note and severity should not be required.

Data Models

Create these TypeScript interfaces.

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
Default Data

On first app load, if no data exists, initialize:

Default Cat
{
  id: 'default-cat',
  name: '我的貓',
  createdAt: now,
  updatedAt: now
}
Default Categories

Create default quick categories:

嘔吐
軟便
食慾差
嚎叫
攻擊
用藥

Also allow more categories later:

躲藏
亂尿
過度舔毛
看診
驅蟲
疫苗
外出訓練
剪指甲訓練

For MVP, the quick categories are enough.

Main Pages / Views
1. Home View

Purpose:

Allow user to quickly record events.

Content:

目前貓咪：我的貓

今天要記錄什麼？

[ 嘔吐 ] [ 軟便 ] [ 食慾差 ]
[ 嚎叫 ] [ 攻擊 ] [ 用藥 ]
[ + 自訂分類 ]

今日紀錄
15:42 嘔吐
13:10 軟便
09:00 用藥

Behavior:

Clicking a category button immediately creates a CatEvent.
occurredAt should be current date/time.
catId should be the selected cat.
categoryId should be the clicked category.
After creating, show a small success message.
Newly created event should appear in today's list immediately.
2. Today Events List

Show all events from today.

Each event item should show:

time
category name
cat name
severity if exists
note preview if exists

Each event should be clickable to edit details.

3. Event Detail / Edit Modal

User can edit optional details.

Fields:

category
cat
occurred date/time
severity
note

Actions:

save
delete
cancel

Important:

Quick record should not open this modal automatically.
The modal is only opened when user chooses to edit.

4. Category Management

MVP basic version:

Allow user to create a custom category.

Fields:

name
color optional
quick action toggle optional

If quick action is enabled, show it on Home quick buttons.

No need for advanced category management in MVP.

5. Simple Calendar View

Purpose:

Let user see which days have records.

Requirements:

Show current month
Mark dates that have events
Clicking a date shows events on that date
No need for complex UI

A simple custom calendar is acceptable.

6. Basic Stats View

Purpose:

Show simple monthly event statistics.

Requirements:

current month total event count
count by category
count by cat

Example:

本月紀錄：12 筆

分類統計：
嘔吐：3
軟便：2
嚎叫：4

貓咪統計：
我的貓：12
Pinia Store

Create a main store, for example:

useCatTrackerStore

State:

cats: Cat[]
categories: EventCategory[]
events: CatEvent[]
selectedCatId: string

Actions:

initializeStore()
addCat(name: string)
addCategory(payload)
quickAddEvent(categoryId: string)
updateEvent(eventId: string, payload)
deleteEvent(eventId: string)
setSelectedCat(catId: string)

Getters:

selectedCat
quickCategories
todayEvents
eventsByDate
currentMonthEvents
monthlyCategoryStats
monthlyCatStats

Persistence:

Save cats, categories, events, selectedCatId to localStorage.
Load from localStorage on app startup.
If no data exists, initialize default data.
Folder Structure Suggestion
src/
  main.ts
  App.vue

  types/
    tracker.ts

  stores/
    catTracker.ts

  views/
    HomeView.vue
    CalendarView.vue
    StatsView.vue

  components/
    QuickEventButtons.vue
    TodayEventList.vue
    EventEditModal.vue
    CategoryCreateModal.vue
    SimpleCalendar.vue
    StatsSummary.vue

  utils/
    date.ts
    id.ts
    storage.ts
Implementation Order

Follow this order:

Step 1

Set up Vue 3 + TypeScript + Pinia.

Step 2

Create TypeScript models:

Cat
EventCategory
CatEvent
Step 3

Create Pinia store with default cat and default categories.

Step 4

Implement localStorage persistence.

Step 5

Build HomeView.

Must include:

selected/default cat display
quick category buttons
today event list
Step 6

Implement quickAddEvent.

Clicking a category should immediately add an event.

Step 7

Implement EventEditModal.

User can edit:

time
category
cat
severity
note
Step 8

Implement custom category creation.

Step 9

Implement simple calendar view.

Step 10

Implement basic stats view.

Design Requirements

Keep UI simple and clear.

Prioritize:

fast recording
readable daily records
minimal required input
no heavy onboarding
no required cat profile fields

Avoid:

forcing user to fill cat birthday, breed, weight, sex, vaccine status
opening long forms before user can record
requiring login
requiring backend
complicated navigation
MVP Acceptance Criteria

The MVP is complete when:

User can open the app and immediately see quick event buttons.
User can click one button and create an event.
The event appears in today's list.
User can edit the event details later.
User can create a custom category.
Data remains after page refresh.
Calendar shows dates with events.
Stats page shows current month category counts.
Product Notes

The first version should validate this core hypothesis:

Users are more likely to maintain long-term records if event creation takes only a few seconds.

Do not overbuild medical records, reminders, backend, login, or charts yet.

The MVP should focus on making the recording habit easy to start.
```
