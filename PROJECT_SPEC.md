# MeowNote v1 Product Spec

MeowNote is a cat health and behavior tracking app.

The product is not a diary. It is an event-based tracking system for recurring health, behavior, food, medication, and care records.

For technical details, see:

- [Architecture](docs/ARCHITECTURE.md)
- [Data Model](docs/DATA_MODEL.md)
- [Supabase Schema](docs/SUPABASE_SCHEMA.sql)
- [Statistics Page Redesign](docs/STATS_PAGE_REDESIGN.md)

## Product Goal

Help cat owners build a reliable habit of recording meaningful events quickly, then review those records later through calendar, list, search, and statistics views.

Core principle:

> Quick-first, detail-later.

## Current v1 Scope

The current app supports:

- first-time setup with cat name and selected tracking templates
- local storage persistence before login
- optional Supabase account sync after login
- email/password authentication through Supabase
- account password change after login
- multiple notebooks per account
- one active notebook per device
- notebook sharing by registered user email
- shared notebook permissions for owners and editors
- local data import into an empty remote notebook
- automatic remote sync for cats, categories, and events after remote IDs are established
- calendar view and monthly list view
- event search by category name, title, note, and value text
- quick record panel
- event edit/delete modal
- pet profile management
- category/template management
- dark/light theme toggle
- stats page for count, sum, measurement, and rating categories

## Main Navigation

The bottom navigation currently has five primary entries:

- 筆記簿
- 月曆
- `+` quick record
- 統計
- 設定

The 筆記簿 page owns account, sync, password, notebook switching, notebook creation, notebook sharing, leaving shared notebooks, and deleting empty personal notebooks.

## Primary Workflows

### First-Time Setup

1. User enters a cat name.
2. User chooses tracking templates grouped by category group.
3. Selected templates become actual user categories.
4. The app should not create every predefined template automatically.

Default selected templates should stay minimal. Current default direction is 飲水 and 用藥 only.

### Quick Record

Quick record is optimized for the fastest common path:

```txt
tap + -> choose category -> event created
```

Behavior:

- use the selected cat
- use the currently selected calendar date and current time
- create an event immediately for count categories
- open the edit modal after creation for numeric categories where a value is expected
- close the quick record panel after creation

Quick categories come from enabled, non-archived categories where `isQuickAction` is true.

When selected quick categories span multiple category groups, group tabs should appear. Empty groups should not be shown.

### Calendar And List Views

The calendar screen supports:

- selected cat switcher
- calendar/list display mode
- month navigation
- today button
- search entry point
- date cells with event counts
- selected date timeline

The monthly list view groups events by date. Within a date, events should be sorted from earliest to latest.

Search should find events by:

- category name
- title
- note
- value text

Search results should use a compact list layout:

- line 1: date/time
- line 2: category and title/value
- line 3: note
- category color shown on the left

### Event Editing

Events can store optional detail fields:

- category
- date/time
- title
- severity
- note
- numeric values

Changing an event category should immediately update the value input UI.

If the new category is incompatible with the old numeric value, save with `values = {}`. Do not preserve numeric values whose meaning changed.

### Category Management

Categories are user-customizable tracking templates.

Users can:

- enable/disable categories
- toggle quick action visibility
- choose category group
- choose color
- choose statistics mode
- set numeric value label
- set value unit
- set rating max value
- create custom categories
- archive or delete unused categories

Deletion behavior:

- if a category has events, archive it and remove it from quick actions
- if a category has no events, hard-delete it
- restoring an archived category should make it active again

### Pet Management

Pet profiles are intentionally lightweight.

Fields such as birthday, sex, neuter status, weight, and note are optional.

Deletion behavior:

- if a pet has events, archive it
- if a pet has no events, hard-delete it
- archived pets should still be selectable for historical review, but cannot create new events

### Account And Sync

The app is local-first.

Before login:

- data lives in localStorage
- IDs should be UUIDs created locally

After login:

- Supabase session should be retained by the Supabase client
- each device has one active notebook stored locally
- if the user's first eligible owner notebook is empty, import local data once
- if the active remote notebook has data, load remote data
- after remote data is loaded/imported, creates/updates/deletes should sync automatically
- switching notebooks should load that notebook's remote data and must not import the previous notebook's in-memory data into the new notebook
- newly created notebooks should start empty and should not copy the current notebook's data

Current sync scope:

- cats
- event categories
- cat events

### Notebook Management And Sharing

Users can create more than one personal notebook.

Owner behavior:

- can rename the notebook
- can share the notebook with another registered user by Email
- can manage pets and categories
- can edit/delete all events in the notebook
- can delete a personal notebook only when it has no records and no shared members

Shared editor behavior:

- can switch to the shared notebook
- can read pets, categories, and events in that notebook
- can create their own events
- can edit/delete only events they created
- cannot manage pets, categories, notebook name, or sharing
- can leave the shared notebook

When a user opens an event they cannot edit, the UI should provide a read-only detail view instead of an editable form.

Password changes are available after login and require the current password before setting the new password.

## Statistics

Stats are driven by each category's `statisticsMode`.

The Stats page should:

- use the shared cat switcher
- show only categories with actual records for the selected cat
- jump to the selected category's latest recorded period when switching category
- provide a 今日 button that returns to the period containing today
- disable future-only ranges
- mark range picker options that contain records

### `count` - 發生次數

For frequency-only events such as 嘔吐, 腹瀉, 夜間活動, 外出.

Useful views:

- day interval: 7 days
- week interval: 8 weeks
- month interval: 6 months

The chart should emphasize period totals and comparison with the previous period. Daily average is not useful for this mode.

### `sum` - 累積數量

For additive numeric values such as 飲水量, 食物量, medication dosage.

Current useful view:

- last 7 days
- daily total bars
- daily average calculated only from days with records

Do not use empty days in average calculations.

### `measurement` - 量測紀錄

For independent measurements such as 體重 or 體溫.

Useful views:

- week: show all 7 days
- month: show only dates that have records

Do not calculate accumulated totals for measurement categories.

### `rating` - 狀態評分

For subjective scores such as 精神狀態 and 食慾.

Behavior:

- value input is required when rating mode is selected
- default value label is 評分
- minimum score is 1
- max score is category-configurable, default 10
- score must be an integer

Stats should be shown like measurement trends, using point/line charts.

## Out Of Scope For Current v1

These are intentional later items:

- role management UI
- invitation workflow for users who have not registered yet
- read-only viewer UI polish
- recovery/reset password screen
- push notifications
- veterinary document storage
- medical diagnosis workflows
- advanced analytics beyond the current statistics modes
