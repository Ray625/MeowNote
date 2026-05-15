<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CatEvent, EventCategory } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { catsById, categoriesById, quickActionCategories, selectedCat, todayEvents } =
  storeToRefs(catTrackerStore)

const lastCreatedEventId = ref<string>()
let successMessageTimeout: ReturnType<typeof window.setTimeout> | undefined

interface EventListItem {
  event: CatEvent
  category?: EventCategory
  catName: string
  time: string
}

const eventListItems = computed<EventListItem[]>(() =>
  todayEvents.value.map((event) => ({
    event,
    category: categoriesById.value.get(event.categoryId),
    catName: catsById.value.get(event.catId)?.name ?? '未知貓咪',
    time: formatEventTime(event.occurredAt),
  })),
)

const successMessage = computed(() => {
  if (!lastCreatedEventId.value) {
    return ''
  }

  const event = todayEvents.value.find((item) => item.id === lastCreatedEventId.value)
  const category = event ? categoriesById.value.get(event.categoryId) : undefined

  return category ? `已記錄：${category.name}` : '已記錄'
})

function recordQuickEvent(categoryId: string): void {
  const event = catTrackerStore.quickRecord(categoryId)

  if (!event) {
    return
  }

  lastCreatedEventId.value = event.id

  if (successMessageTimeout) {
    window.clearTimeout(successMessageTimeout)
  }

  successMessageTimeout = window.setTimeout(() => {
    lastCreatedEventId.value = undefined
  }, 1800)
}

function getCategoryStyle(category?: EventCategory): Record<string, string> {
  return {
    '--category-color': category?.color ?? '#65736a',
  }
}

function formatEventTime(dateTime: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateTime))
}
</script>

<template>
  <main class="home-view" aria-labelledby="home-title">
    <section class="cat-summary" aria-label="目前貓咪">
      <span class="cat-summary__label">目前貓咪</span>
      <strong class="cat-summary__name">{{ selectedCat?.name ?? '我的貓' }}</strong>
    </section>

    <section class="today-events" aria-labelledby="today-events-title">
      <div class="section-heading">
        <h2 id="today-events-title">今日紀錄</h2>
        <span class="event-count">{{ eventListItems.length }} 筆</span>
      </div>

      <ol v-if="eventListItems.length > 0" class="event-list">
        <li
          v-for="item in eventListItems"
          :key="item.event.id"
          class="event-item"
          :style="getCategoryStyle(item.category)"
        >
          <time class="event-item__time" :datetime="item.event.occurredAt">{{ item.time }}</time>
          <div class="event-item__content">
            <strong class="event-item__category">
              <span class="category-dot" aria-hidden="true"></span>
              <span>{{ item.category?.name ?? '未分類' }}</span>
            </strong>
            <span class="event-item__meta">{{ item.catName }}</span>
            <span v-if="item.event.severity" class="event-item__meta">
              嚴重度 {{ item.event.severity }}
            </span>
            <p v-if="item.event.note" class="event-item__note">{{ item.event.note }}</p>
          </div>
        </li>
      </ol>

      <p v-else class="empty-state">今天還沒有紀錄。</p>
    </section>

    <section class="quick-record" aria-labelledby="home-title">
      <div class="quick-record__inner">
        <div class="section-heading section-heading--compact">
          <h1 id="home-title">記錄事件</h1>
          <p v-if="successMessage" class="success-message" role="status">
            {{ successMessage }}
          </p>
        </div>

        <div class="quick-actions" aria-label="快速記錄分類">
          <button
            v-for="category in quickActionCategories"
            :key="category.id"
            class="quick-action"
            :style="getCategoryStyle(category)"
            type="button"
            @click="recordQuickEvent(category.id)"
          >
            <span class="category-dot" aria-hidden="true"></span>
            <span>{{ category.name }}</span>
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  padding: 32px 20px 188px;
  background: #f8faf7;
  color: #17201b;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.cat-summary,
.today-events {
  width: min(100%, 720px);
  margin: 0 auto;
}

.cat-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0 24px;
  border-bottom: 1px solid #d8e0d8;
}

.cat-summary__label,
.event-count,
.event-item__meta,
.empty-state {
  color: #65736a;
}

.cat-summary__label {
  font-size: 0.875rem;
}

.cat-summary__name {
  font-size: 1.25rem;
}

.today-events {
  padding-top: 28px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 1.125rem;
  line-height: 1.1;
}

h2 {
  font-size: 1.25rem;
}

.success-message {
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid #9ac7a3;
  border-radius: 8px;
  background: #edf8ef;
  color: #276134;
  font-size: 0.875rem;
}

.quick-record {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  padding: 14px 16px max(14px, env(safe-area-inset-bottom));
  border-top: 1px solid #d8e0d8;
  background: rgba(248, 250, 247, 0.94);
  box-shadow: 0 -12px 32px rgba(23, 32, 27, 0.08);
  backdrop-filter: blur(14px);
}

.quick-record__inner {
  width: min(100%, 720px);
  margin: 0 auto;
}

.section-heading--compact {
  margin-bottom: 10px;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.quick-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 52px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--category-color) 48%, #cbd8cf);
  border-radius: 8px;
  background: color-mix(in srgb, var(--category-color) 12%, #ffffff);
  color: #17201b;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.quick-action:hover {
  border-color: var(--category-color);
  background: color-mix(in srgb, var(--category-color) 18%, #ffffff);
}

.quick-action:focus-visible {
  outline: 3px solid #8fc7a0;
  outline-offset: 2px;
}

.event-list {
  display: grid;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.event-item {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 14px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--category-color) 34%, #d8e0d8);
  border-left: 5px solid var(--category-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--category-color) 7%, #ffffff);
}

.event-item__time {
  color: #34423a;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.event-item__content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  min-width: 0;
}

.event-item__category {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: color-mix(in srgb, var(--category-color) 82%, #17201b);
  font-size: 1rem;
}

.category-dot {
  width: 0.625rem;
  height: 0.625rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--category-color);
}

.event-item__meta {
  font-size: 0.875rem;
}

.event-item__note {
  flex-basis: 100%;
  overflow: hidden;
  color: #34423a;
  font-size: 0.9375rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 24px 0;
}

@media (max-width: 560px) {
  .home-view {
    padding: 22px 16px 214px;
  }

  .cat-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .section-heading {
    align-items: center;
  }

  .quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .event-item {
    grid-template-columns: 56px 1fr;
    padding: 12px;
  }
}
</style>
