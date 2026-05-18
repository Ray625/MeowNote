<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { CATEGORY_GROUP_ORDER, getCategoryColorValue } from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory, EventCategoryGroup } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { activeTab, isQuickRecordOpen, quickActionCategories } = storeToRefs(catTrackerStore)
const activeGroup = ref<EventCategoryGroup>('攝取')

let successMessageTimeout: ReturnType<typeof window.setTimeout> | undefined

const groupedQuickActionCategories = computed(() =>
  CATEGORY_GROUP_ORDER.map((group) => ({
    group,
    categories: quickActionCategories.value.filter((category) => category.group === group),
  })).filter((item) => item.categories.length > 0),
)

const activeGroupCategories = computed(
  () =>
    groupedQuickActionCategories.value.find((item) => item.group === activeGroup.value)
      ?.categories ??
    groupedQuickActionCategories.value[0]?.categories ??
    [],
)

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
    '--category-color': getCategoryColorValue(category),
  }
}

function selectGroup(group: EventCategoryGroup): void {
  activeGroup.value = group
}
</script>

<template>
  <section v-if="isQuickRecordOpen" class="quick-record-panel" aria-labelledby="quick-record-title">
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

      <div class="quick-groups" aria-label="快速記錄群組">
        <button
          v-for="item in groupedQuickActionCategories"
          :key="item.group"
          class="ui-button quick-group"
          :class="item.group === activeGroup ? 'ui-button--primary' : 'ui-button--secondary'"
          type="button"
          @click="selectGroup(item.group)"
        >
          {{ item.group }}
        </button>
      </div>

      <div class="quick-actions" aria-label="快速記錄分類">
        <button
          v-for="category in activeGroupCategories"
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
      <button
        class="bottom-navigation__item"
        :class="{ 'bottom-navigation__item--active': activeTab === 'calendar' }"
        type="button"
        @click="catTrackerStore.setActiveTab('calendar')"
      >
        月曆
      </button>
      <button
        class="ui-button ui-button--primary add-button"
        type="button"
        aria-label="新增快速紀錄"
        @click="catTrackerStore.toggleQuickRecord"
      >
        +
      </button>
      <button
        class="bottom-navigation__item"
        :class="{ 'bottom-navigation__item--active': activeTab === 'settings' }"
        type="button"
        @click="catTrackerStore.setActiveTab('settings')"
      >
        設定
      </button>
    </div>
  </nav>
</template>

<style scoped>
.quick-record-panel {
  position: fixed;
  right: 0;
  bottom: 68px;
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

.quick-groups,
.quick-actions {
  display: grid;
  gap: 8px;
}

.quick-groups {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 12px;
}

.quick-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 10px;
}

.quick-group {
  min-height: 40px;
  padding: 0 8px;
  font-size: 0.875rem;
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
  padding: 6px 16px max(6px, env(safe-area-inset-bottom));
  border-top: 1px solid #d8e0d8;
  background: rgba(248, 250, 247, 0.96);
  box-shadow: 0 -12px 32px rgba(23, 32, 27, 0.08);
  backdrop-filter: blur(14px);
}

.bottom-navigation__inner {
  position: relative;
  display: grid;
  width: var(--content-width);
  min-height: 48px;
  grid-template-columns: 1fr 64px 1fr;
  align-items: center;
  margin: 0 auto;
  text-align: center;
}

.bottom-navigation__item {
  border: 0;
  background: transparent;
  color: #65736a;
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  transition: color 160ms ease;
}

.bottom-navigation__item--active {
  color: #17201b;
}

@media (hover: hover) and (pointer: fine) {
  .bottom-navigation__item:hover {
    color: #17201b;
  }
}

.add-button {
  --button-color: #557563;
  --button-hover-color: #3f614d;

  width: 52px;
  height: 52px;
  place-self: center;
  border-radius: 999px;
  font-size: 1.7rem;
  line-height: 1;
}

@media (max-width: 560px) {
  .quick-groups {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
