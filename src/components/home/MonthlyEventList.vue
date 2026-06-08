<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import EventItemActions from '@/components/home/EventItemActions.vue'
import { getCategoryColorValue } from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'
import { getEventValueText } from '@/utils/eventValues'

const catTrackerStore = useCatTrackerStore()
const { isEventSearchActive, isEventSearchOpen, searchedEventGroups, visibleMonthEventGroups } =
  storeToRefs(catTrackerStore)
const displayedEventGroups = computed(() => {
  if (isEventSearchActive.value) {
    return searchedEventGroups.value
  }

  return isEventSearchOpen.value ? [] : visibleMonthEventGroups.value
})

function getCategoryStyle(category?: EventCategory): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(category),
  }
}
</script>

<template>
  <section class="month-list-section" aria-label="整月紀錄">
    <div v-if="displayedEventGroups.length > 0" class="month-event-groups">
      <section v-for="group in displayedEventGroups" :key="group.key" class="month-event-group">
        <header class="month-event-group__header">
          <h3>{{ group.title }}</h3>
          <span>{{ group.items.length }} 筆</span>
        </header>

        <ol class="month-event-list">
          <li
            v-for="item in group.items"
            :key="item.event.id"
            class="month-event-item"
            :class="{
              'month-event-item--search': isEventSearchActive,
            }"
            :style="getCategoryStyle(item.category)"
          >
            <button
              v-if="isEventSearchActive"
              class="month-event-item__button month-event-item__button--search"
              type="button"
              @click="catTrackerStore.openEditEvent(item.event.id)"
            >
              <span class="category-bar" aria-hidden="true"></span>
              <div class="month-event-item__search-content">
                <time class="month-event-item__search-date" :datetime="item.event.occurredAt">
                  {{ item.dateText }} · {{ item.time }}
                </time>
                <strong class="month-event-item__search-title">
                  <span>{{ item.category?.name ?? '未分類' }}</span>
                  <span v-if="item.event.title"> · {{ item.event.title }}</span>
                  <span v-if="getEventValueText(item.event, item.category)">
                    · {{ getEventValueText(item.event, item.category) }}
                  </span>
                  <span
                    v-if="item.event.photos?.length"
                    class="photo-attachment-icon"
                    aria-label="有照片附件"
                    title="有照片附件"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"
                      />
                    </svg>
                  </span>
                </strong>
                <p v-if="item.event.note" class="month-event-item__search-note">
                  {{ item.event.note }}
                </p>
              </div>
            </button>
            <button
              v-else
              class="month-event-item__button"
              type="button"
              @click="catTrackerStore.openEditEvent(item.event.id)"
            >
              <time class="month-event-item__time" :datetime="item.event.occurredAt">
                {{ item.time }}
              </time>
              <span class="category-dot" aria-hidden="true"></span>
              <div class="month-event-item__content">
                <strong class="month-event-item__summary">
                  <span>{{ item.category?.name ?? '未分類' }}</span>
                  <span v-if="item.event.title"> · {{ item.event.title }}</span>
                  <span v-if="getEventValueText(item.event, item.category)">
                    · {{ getEventValueText(item.event, item.category) }}
                  </span>
                  <span
                    v-if="item.event.photos?.length"
                    class="photo-attachment-icon"
                    aria-label="有照片附件"
                    title="有照片附件"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"
                      />
                    </svg>
                  </span>
                </strong>
                <span
                  v-if="
                    !item.event.title && !getEventValueText(item.event, item.category) && item.event.note
                  "
                >
                  {{ item.event.note }}
                </span>
                <span
                  v-else-if="
                    !item.event.title &&
                    !getEventValueText(item.event, item.category) &&
                    item.event.severity
                  "
                >
                  嚴重度 {{ item.event.severity }}
                </span>
                <small v-if="isEventSearchActive && item.dateText">
                  {{ item.dateText }} · {{ item.time }}
                </small>
              </div>
            </button>
            <EventItemActions
              v-if="catTrackerStore.canModifyEvent(item.event)"
              @duplicate="catTrackerStore.duplicateEventAsDraft(item.event.id)"
              @delete="catTrackerStore.openDeleteConfirm(item.event.id)"
            />
            <span v-else class="month-event-item__owner-badge">他人紀錄</span>
          </li>
        </ol>
      </section>
    </div>

    <p v-else class="empty-state">
      {{
        isEventSearchOpen && !isEventSearchActive
          ? '輸入關鍵字搜尋標題或備註。'
          : isEventSearchActive
            ? '找不到符合搜尋的紀錄。'
            : '這個月還沒有紀錄。'
      }}
    </p>
  </section>
</template>

<style scoped>
.month-list-section {
  display: grid;
  width: var(--content-width);
  gap: 12px;
  margin: 0 auto;
}

.month-event-group__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.month-event-group__header h3,
.empty-state {
  margin: 0;
}

.month-event-group__header span,
.month-event-item__content span,
.empty-state {
  color: var(--color-muted);
}

.month-event-groups {
  display: grid;
  gap: 14px;
}

.month-event-group {
  display: grid;
  overflow: visible;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.month-event-group__header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-background);
}

.month-event-group__header h3 {
  font-size: 1rem;
}

.month-event-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.month-event-item {
  display: grid;
  grid-template-columns: 1fr 40px;
  border-bottom: 1px solid var(--color-divider);
}

.month-event-item:last-child {
  border-bottom: 0;
}

.month-event-item__button {
  display: grid;
  grid-template-columns: 44px 12px 1fr;
  align-items: center;
  gap: 10px;
  min-width: 0;
  border: 0;
  padding: 12px 14px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.month-event-item__button--search {
  grid-template-columns: 5px minmax(0, 1fr);
  align-items: stretch;
  gap: 12px;
  padding: 12px 14px;
}

.month-event-item__button:hover {
  background: color-mix(in srgb, var(--category-color) 8%, transparent);
}

.month-event-item__time {
  color: var(--color-text);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.category-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--category-color);
}

.category-bar {
  width: 5px;
  border-radius: 999px;
  background: var(--category-color);
}

.month-event-item__content {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.month-event-item__search-content {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.month-event-item__search-date {
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.month-event-item__search-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month-event-item__search-title {
  min-width: 0;
  color: var(--color-text);
  white-space: normal;
}

.month-event-item__summary {
  min-width: 0;
  color: var(--color-text);
  white-space: normal;
}

.photo-attachment-icon {
  display: inline-flex;
  width: 1.05rem;
  height: 1.05rem;
  margin-left: 0.35rem;
  color: var(--color-muted);
  vertical-align: -0.08em;
}

.photo-attachment-icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
}

.month-event-item__search-note {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.875rem;
}

.month-event-item__content span,
.month-event-item__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month-event-item__content small {
  color: var(--color-muted);
  font-size: 0.8125rem;
}

.month-event-item__owner-badge {
  display: grid;
  place-items: center;
  border-left: 1px solid var(--color-divider);
  padding: 6px;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
}

.empty-state {
  padding: 28px 0;
  text-align: center;
}
</style>
