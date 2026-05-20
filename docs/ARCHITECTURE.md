# Architecture

This document describes the current implementation shape of MeowNote.

## Runtime Shape

MeowNote is a frontend-only Vue app.

```txt
Vue components
  -> Pinia store
    -> cat tracker repository
      -> localStorage adapter
```

There is no backend, auth, API, or database in the current version.

## Entry Points

- `src/main.ts`: creates the Vue app and installs Pinia
- `src/App.vue`: renders `HomeView`
- `src/views/HomeView.vue`: top-level application shell

`HomeView` decides which primary screen to show:

- first-time setup when there is no cat data
- calendar + event timeline
- settings

It also mounts shared overlays and bottom navigation.

## State Management

The main store is:

```txt
src/stores/catTracker.ts
```

It owns the core app state:

- cats
- categories
- events
- selected cat
- selected date
- visible calendar month
- active tab
- modal and confirmation state

Store changes are watched and passed to the repository for persistence.

## Repository Layer

The current repository is:

```txt
src/repositories/catTrackerRepository.ts
```

It owns the persistence boundary for the cat tracker state:

- load the current persisted state
- read legacy `cat-log:v1` data when current data does not exist
- create initial state
- normalize loaded state
- save the current state

The current implementation is a localStorage adapter. Future account sync or database-backed storage should replace or extend this repository boundary instead of spreading database calls through Vue components or the Pinia store.

## Persistence

Low-level JSON storage helpers live in:

```txt
src/utils/storage.ts
```

The repository reads from:

- `meownote:v1`
- then `cat-log:v1` as a legacy fallback
- then a generated initial state

The current initial state includes default categories but no default cat. If there are no cats, the first-time setup flow is shown.

## Default Data

Default categories, colors, cat avatar options, and normalization helpers live in:

```txt
src/constants/defaultData.ts
```

Default category groups:

- 飲食
- 健康
- 行為
- 日常
- 醫療

When existing stored categories are loaded, `ensureDefaultCategories` adds any missing current default categories and normalizes known defaults.

Legacy default categories from the old set are archived instead of appearing in quick actions.

## Component Map

Home and recording:

- `src/components/home/FirstTimeSetup.vue`
- `src/components/home/HomeCalendar.vue`
- `src/components/home/EventTimeline.vue`
- `src/components/home/BottomQuickActions.vue`
- `src/components/home/EventEditModal.vue`

Settings:

- `src/components/settings/SettingsView.vue`

Shared:

- `src/components/ConfirmDialog.vue`

## Styling

Global styles:

- `src/styles/reset.css`
- `src/styles/theme.css`
- `src/styles/buttons.css`

Most component layout is scoped inside each Vue component.

## PWA

PWA support is configured in:

```txt
vite.config.ts
```

The app uses `vite-plugin-pwa` with:

- `registerType: 'autoUpdate'`
- `display: 'standalone'`
- `start_url: '/MeowNote/'`
- `scope: '/MeowNote/'`

GitHub Pages deployment requires the Vite base path to match the repository path.
