<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { getCategoryColorValue } from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'
import { getEventValueText } from '@/utils/eventValues'

const catTrackerStore = useCatTrackerStore()
const { selectedDateEventListItems, selectedDateTitle } = storeToRefs(catTrackerStore)

function getCategoryStyle(category?: EventCategory): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(category),
  }
}
</script>

<template>
  <section class="timeline-section" aria-labelledby="timeline-title">
    <div class="timeline-heading">
      <div class="timeline-heading__title">
        <h2 id="timeline-title">紀錄</h2>
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
            <strong v-if="item.event.title" class="event-item__title">{{ item.event.title }}</strong>
            <span v-if="getEventValueText(item.event, item.category)" class="event-item__value">
              {{ getEventValueText(item.event, item.category) }}
            </span>
            <span v-if="item.event.severity" class="event-item__meta">
              嚴重度 {{ item.event.severity }}
            </span>
            <p v-if="item.event.note" class="event-item__note">{{ item.event.note }}</p>
          </div>
        </button>
        <button
          v-if="catTrackerStore.canModifyEvent(item.event)"
          class="event-item__delete"
          type="button"
          :aria-label="`刪除 ${item.category?.name ?? '未分類'} 紀錄`"
          @click="catTrackerStore.openDeleteConfirm(item.event.id)"
        >
          ×
        </button>
        <span v-else class="event-item__owner-badge">他人紀錄</span>
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

.timeline-heading__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.timeline-heading h2 {
  font-size: 1.25rem;
}

.selected-date,
.event-count,
.event-item__meta,
.empty-state {
  color: var(--color-muted);
}

.selected-date {
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
  grid-template-columns: 1fr 40px;
  align-items: stretch;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--category-color) 34%, var(--color-border));
  border-left: 5px solid var(--category-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--category-color) 7%, var(--color-surface));
}

.event-item__button {
  display: grid;
  width: 100%;
  grid-template-columns: 50px 1fr;
  gap: 8px;
  padding: 10px 12px;
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
  border-left: 1px solid color-mix(in srgb, var(--category-color) 24%, var(--color-border));
  background: transparent;
  color: color-mix(in srgb, var(--category-color) 82%, var(--color-text));
  cursor: pointer;
  font: inherit;
  font-size: 1.35rem;
  line-height: 1;
}

.event-item__owner-badge {
  display: grid;
  place-items: center;
  border-left: 1px solid color-mix(in srgb, var(--category-color) 24%, var(--color-border));
  padding: 6px;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
}

.event-item__button:hover {
  background: color-mix(in srgb, var(--category-color) 10%, var(--color-surface));
}

.event-item__delete:hover {
  background: color-mix(in srgb, var(--color-danger-strong) 10%, transparent);
  color: var(--color-danger);
}

.event-item__button:focus-visible,
.event-item__delete:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.event-item__time {
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.event-item__content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 8px;
  min-width: 0;
}

.event-item__category {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: color-mix(in srgb, var(--category-color) 82%, var(--color-text));
}

.event-item__title {
  min-width: 0;
  color: var(--color-text);
  font-weight: 800;
  white-space: normal;
}

.event-item__value {
  color: var(--color-text);
  font-weight: 800;
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
  color: var(--color-text);
  font-size: 0.9375rem;
  line-height: 1.3;
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
    flex: 0 0 auto;
    overflow: visible;
  }

  .event-list {
    flex: 0 0 auto;
    overflow: visible;
  }

  .event-item {
    grid-template-columns: 1fr 38px;
  }

  .event-item__button {
    grid-template-columns: 48px 1fr;
    padding: 10px;
  }
}
</style>
