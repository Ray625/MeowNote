# Product Principles

This document describes the current product direction for MeowNote v1.

## 1. Quick-first, detail-later

Users should be able to record common events within a few seconds.

The default path is:

```txt
Open app -> tap + -> tap a quick category -> record created
```

Details such as title, note, date/time, numeric value, severity, and category edits can be added later.

## 2. Recording habit beats completeness

Do not require complete cat profiles, perfect category setup, or detailed event fields before recording.

Most fields should stay optional. The first product job is helping users build a habit of capturing reliable records.

## 3. User-selected tracking templates

System categories are templates, not mandatory global categories.

First-time setup and Settings should help users choose the items they actually want to track. Do not automatically expose every predefined category in daily quick actions.

Users can:

- enable template categories
- create custom categories
- choose whether a category appears in quick record
- archive unused categories

## 4. Quick actions are intent-based

Quick record shows categories where `isQuickAction` is enabled and the category is not archived.

Quick actions should not disappear only because a category currently has no events. A low-frequency item like 驅蟲 or 體重 may still be an intended quick action even when there is no recent data.

## 5. Stats are history-based

The Stats page is for reviewing recorded history.

Stats category dropdowns should show only categories that have actual records for the selected cat. This keeps the stats page focused and avoids empty analysis surfaces.

Future-only ranges should be disabled. Stats may show past ranges and current ranges that include today, but should not navigate to ranges entirely in the future.

## 6. Preserve history

Deleting active entities should not destroy meaningful history by accident.

Current behavior:

- cats with events can be archived, not hard-deleted
- categories with events can be archived, not hard-deleted
- cats/categories without events may be deleted
- archived cats/categories should remain usable for historical display and statistics where relevant

## 7. Local-first with optional account sync

The app must remain useful before login.

When the user signs in, local data can be imported into a notebook if the remote notebook is empty. After data is linked to remote UUIDs, creates/updates/deletes should sync through Supabase.

Remote sync should not leak database calls into UI components. Keep persistence and sync behavior behind store/services/repository boundaries.

## 8. Shared notebook direction

The long-term model is account-based notebooks:

- one user can own a notebook
- a notebook can later be shared with other users
- multiple devices should manage the same notebook data through the account

The UI does not need full notebook sharing yet, but data model and sync decisions should preserve this path.
