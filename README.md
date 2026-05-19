# MeowNote

MeowNote is a quick-first cat health, behavior, and daily care tracker.

The product principle is:

> Quick-first, detail-later.

Users should be able to record a cat event within a few seconds, then add details later when needed.

## Current Features

- First-time setup for the first cat: name and coat/avatar selection
- Calendar view with date selection and event count markers
- Quick record panel grouped by category
- Event detail modal for editing category, time, severity, title, and notes
- Settings for pets and event categories
- Category ordering, archiving, quick-action toggles, and colors
- Local-only persistence with `localStorage`
- PWA support for adding MeowNote to a phone home screen
- GitHub Pages deployment with the `/MeowNote/` base path

## Tech Stack

- Vue 3
- TypeScript
- Pinia
- Vite
- vite-plugin-pwa
- pnpm
- GitHub Pages

## Local Development

```bash
pnpm install
pnpm run dev
```

## Build

```bash
pnpm run build
```

The build runs both:

- `vue-tsc --build`
- `vite build`

## Preview Production Build

```bash
pnpm run preview
```

## Deployment Notes

The repository name is expected to be `MeowNote`.

`vite.config.ts` sets:

```ts
const appBase = '/MeowNote/'
```

If the GitHub repository name changes, update this base path before deploying.

## PWA Notes

PWA support is configured in `vite.config.ts` using `vite-plugin-pwa`.

Generated production assets include:

- `manifest.webmanifest`
- `sw.js`
- `registerSW.js`

Install icons are stored in:

- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

## Persistence

MeowNote is frontend-only. Data is saved to browser `localStorage`.

Current storage key:

```txt
meownote:v1
```

Legacy fallback key:

```txt
cat-log:v1
```

The fallback exists so local data from the old project name can still be read.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data Model](docs/DATA_MODEL.md)
- [Product Principles](PRODUCT_PRINCIPLES.md)
- [MVP Spec / Historical Direction](PROJECT_SPEC.md)
