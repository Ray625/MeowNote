<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { isQuickRecordOpen, quickActionCategories } = storeToRefs(catTrackerStore)

let successMessageTimeout: ReturnType<typeof window.setTimeout> | undefined

function recordQuickEvent(categoryId: string): void {
  const event = catTrackerStore.quickRecordForSelectedDate(categoryId)

  if (!event) {
    return
  }

  if (successMessageTimeout) {
    window.clearTimeout(successMessageTimeout)
  }

  successMessageTimeout = window.setTimeout(() => {
    catTrackerStore.clearLastCreatedEvent()
  }, 1800)
}

function getCategoryStyle(category?: EventCategory): Record<string, string> {
  return {
    '--category-color': category?.color ?? '#65736a',
  }
}
</script>

<template>
  <section
    v-if="isQuickRecordOpen"
    class="quick-record-panel"
    aria-labelledby="quick-record-title"
  >
    <div class="quick-record-panel__inner">
      <div class="quick-record-panel__heading">
        <h2 id="quick-record-title">快速記錄</h2>
        <button
          class="ui-button ui-button--icon panel-close"
          type="button"
          aria-label="關閉快速記錄"
          @click="catTrackerStore.closeQuickRecord"
        >
          ×
        </button>
      </div>

      <div class="quick-actions" aria-label="快速記錄分類">
        <button
          v-for="category in quickActionCategories"
          :key="category.id"
          class="ui-button ui-button--category quick-action"
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

  <nav class="bottom-navigation" aria-label="主要操作">
    <div class="bottom-navigation__inner">
      <span class="bottom-navigation__item">月曆</span>
      <button
        class="ui-button ui-button--primary add-button"
        type="button"
        aria-label="新增快速紀錄"
        @click="catTrackerStore.toggleQuickRecord"
      >
        +
      </button>
      <span class="bottom-navigation__item">紀錄</span>
    </div>
  </nav>
</template>

<style scoped>
.quick-record-panel {
  position: fixed;
  right: 0;
  bottom: 84px;
  left: 0;
  z-index: 12;
  padding: 0 16px;
}

.quick-record-panel__inner {
  width: var(--content-width);
  padding: 14px;
  border: 1px solid #d8e0d8;
  border-radius: 12px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 48px rgba(23, 32, 27, 0.18);
  backdrop-filter: blur(14px);
}

.quick-record-panel__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.quick-record-panel h2 {
  margin: 0;
  font-size: 1.125rem;
}

.panel-close {
  width: 36px;
  height: 36px;
  font-size: 1.35rem;
  line-height: 1;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.quick-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 52px;
  padding: 0 14px;
}

.category-dot {
  width: 0.625rem;
  height: 0.625rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--category-color);
}

.bottom-navigation {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 11;
  padding: 10px 16px max(10px, env(safe-area-inset-bottom));
  border-top: 1px solid #d8e0d8;
  background: rgba(248, 250, 247, 0.96);
  box-shadow: 0 -12px 32px rgba(23, 32, 27, 0.08);
  backdrop-filter: blur(14px);
}

.bottom-navigation__inner {
  position: relative;
  display: grid;
  width: var(--content-width);
  min-height: 56px;
  grid-template-columns: 1fr 76px 1fr;
  align-items: center;
  margin: 0 auto;
  text-align: center;
}

.bottom-navigation__item {
  color: #65736a;
  font-size: 0.875rem;
  font-weight: 700;
}

.add-button {
  --button-color: #557563;
  --button-hover-color: #3f614d;

  width: 62px;
  height: 62px;
  place-self: center;
  border-radius: 999px;
  font-size: 2rem;
  line-height: 1;
}

@media (max-width: 560px) {
  .quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
