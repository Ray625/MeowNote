<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
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
            :class="{ 'month-event-item--search': isEventSearchActive }"
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
            <button
              class="month-event-item__delete"
              type="button"
              :aria-label="`刪除 ${item.category?.name ?? '未分類'} 紀錄`"
              @click="catTrackerStore.openDeleteConfirm(item.event.id)"
            >
              ×
            </button>
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
  overflow: hidden;
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

.month-event-item__delete {
  display: grid;
  place-items: center;
  border: 0;
  border-left: 1px solid var(--color-divider);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 1.3rem;
}

.month-event-item__delete:hover {
  background: color-mix(in srgb, var(--color-danger-strong) 10%, transparent);
  color: var(--color-danger);
}

.empty-state {
  padding: 28px 0;
  text-align: center;
}
</style>
