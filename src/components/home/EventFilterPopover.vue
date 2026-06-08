<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCatTrackerStore } from '@/stores/catTracker'

const catTrackerStore = useCatTrackerStore()
const { eventFilterCategoryIds, groupedEventFilterCategories, hasEventCategoryFilter } =
  storeToRefs(catTrackerStore)
</script>

<template>
  <div class="event-filter-popover">
    <section class="event-filter-panel" aria-label="篩選分類">
      <div class="event-filter-panel__heading">
        <strong>篩選分類</strong>
        <span v-if="eventFilterCategoryIds.length > 0">已選 {{ eventFilterCategoryIds.length }} 項</span>
      </div>

      <div class="event-filter-body">
        <div v-if="groupedEventFilterCategories.length > 0" class="event-filter-groups">
          <section
            v-for="group in groupedEventFilterCategories"
            :key="group.group"
            class="event-filter-group"
          >
            <h2>{{ group.group }}</h2>
            <div class="event-filter-options">
              <button
                v-for="category in group.categories"
                :key="category.id"
                class="event-filter-option"
                :class="{
                  'event-filter-option--active': eventFilterCategoryIds.includes(category.id),
                }"
                type="button"
                @click="catTrackerStore.toggleEventFilterCategory(category.id)"
              >
                {{ category.name }}
              </button>
            </div>
          </section>
        </div>

        <p v-else class="event-filter-empty">目前沒有可篩選的紀錄分類。</p>
      </div>

      <div class="event-filter-actions">
        <button
          class="ui-button ui-button--secondary"
          type="button"
          :disabled="!hasEventCategoryFilter"
          @click="catTrackerStore.clearEventCategoryFilter"
        >
          清除
        </button>
        <button class="ui-button ui-button--primary" type="button" @click="catTrackerStore.closeEventFilter">
          完成
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.event-filter-popover {
  position: absolute;
  top: 58px;
  right: 14px;
  z-index: 8;
  width: min(360px, calc(100% - 28px));
}

.event-filter-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  max-height: min(430px, calc(100dvh - 140px));
  overflow: hidden;
  overscroll-behavior: contain;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.event-filter-panel__heading,
.event-filter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.event-filter-panel__heading span,
.event-filter-empty {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.event-filter-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.event-filter-groups {
  display: grid;
  gap: 12px;
}

.event-filter-group {
  display: grid;
  gap: 6px;
}

.event-filter-group h2 {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.8125rem;
}

.event-filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.event-filter-option {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 800;
}

.event-filter-option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-primary-light);
}

.event-filter-option--active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.event-filter-actions {
  justify-content: stretch;
}

.event-filter-actions .ui-button {
  flex: 1 1 0;
  min-height: 38px;
}

.event-filter-actions .ui-button:disabled {
  background: var(--color-disabled-surface);
  color: var(--color-muted);
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
