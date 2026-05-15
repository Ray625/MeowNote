<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { selectedDateEventListItems, selectedDateTitle } = storeToRefs(catTrackerStore)

function getCategoryStyle(category?: EventCategory): Record<string, string> {
  return {
    '--category-color': category?.color ?? '#65736a',
  }
}
</script>

<template>
  <section class="timeline-section" aria-labelledby="timeline-title">
    <div class="timeline-heading">
      <div>
        <h2 id="timeline-title">紀錄時間軸</h2>
        <p class="selected-date">{{ selectedDateTitle }}</p>
      </div>
      <span class="event-count">{{ selectedDateEventListItems.length }} 筆</span>
    </div>

    <ol v-if="selectedDateEventListItems.length > 0" class="event-list">
      <li
        v-for="item in selectedDateEventListItems"
        :key="item.event.id"
        class="event-item"
        :style="getCategoryStyle(item.category)"
      >
        <button
          class="event-item__button"
          type="button"
          @click="catTrackerStore.openEditEvent(item.event.id)"
        >
          <time class="event-item__time" :datetime="item.event.occurredAt">{{ item.time }}</time>
          <div class="event-item__content">
            <strong class="event-item__category">
              <span class="category-dot" aria-hidden="true"></span>
              <span>{{ item.category?.name ?? '未分類' }}</span>
            </strong>
            <span v-if="item.event.severity" class="event-item__meta">
              嚴重度 {{ item.event.severity }}
            </span>
            <p v-if="item.event.note" class="event-item__note">{{ item.event.note }}</p>
          </div>
        </button>
        <button
          class="event-item__delete"
          type="button"
          :aria-label="`刪除 ${item.category?.name ?? '未分類'} 紀錄`"
          @click="catTrackerStore.openDeleteConfirm(item.event.id)"
        >
          ×
        </button>
      </li>
    </ol>

    <p v-else class="empty-state">這天還沒有紀錄。</p>
  </section>
</template>

<style scoped>
.timeline-section {
  display: flex;
  width: var(--content-width);
  min-height: 0;
  flex: 0 0 auto;
  flex-direction: column;
  padding-top: 0;
  margin: 0 auto;
}

.timeline-heading {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}

.timeline-heading h2,
.selected-date {
  margin: 0;
}

.timeline-heading h2 {
  font-size: 1.25rem;
}

.selected-date,
.event-count,
.event-item__meta,
.empty-state {
  color: #65736a;
}

.selected-date {
  margin-top: 4px;
  font-size: 0.875rem;
}

.event-list {
  display: grid;
  gap: 10px;
  min-height: 0;
  padding: 0 2px 10px;
  margin: 0;
  list-style: none;
  overscroll-behavior: contain;
}

.event-item {
  display: grid;
  grid-template-columns: 1fr 48px;
  align-items: stretch;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--category-color) 34%, #d8e0d8);
  border-left: 5px solid var(--category-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--category-color) 7%, #ffffff);
}

.event-item__button {
  display: grid;
  width: 100%;
  grid-template-columns: 64px 1fr;
  gap: 14px;
  padding: 14px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.event-item__delete {
  display: grid;
  place-items: center;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--category-color) 24%, #d8e0d8);
  background: transparent;
  color: color-mix(in srgb, var(--category-color) 82%, #17201b);
  cursor: pointer;
  font: inherit;
  font-size: 1.35rem;
  line-height: 1;
}

.event-item__button:hover {
  background: color-mix(in srgb, var(--category-color) 10%, #ffffff);
}

.event-item__delete:hover {
  background: color-mix(in srgb, #b33a2b 10%, transparent);
  color: #a83224;
}

.event-item__button:focus-visible,
.event-item__delete:focus-visible {
  outline: 3px solid #8fc7a0;
  outline-offset: 2px;
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
  padding: 28px 0;
  margin: 0;
  text-align: center;
}

@media (max-width: 560px) {
  .timeline-section {
    flex: 1 1 auto;
    overflow: hidden;
  }

  .event-list {
    flex: 1 1 auto;
    overflow: auto;
  }

  .event-item {
    grid-template-columns: 1fr 44px;
  }

  .event-item__button {
    grid-template-columns: 56px 1fr;
    padding: 12px;
  }
}
</style>
