<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CatEvent, EventCategory } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { catsById, categoriesById, quickActionCategories, selectedCat, todayEvents } =
  storeToRefs(catTrackerStore)

const lastCreatedEventId = ref<string>()
const editingEventId = ref<string>()
const editingOccurredAt = ref('')
const editingNote = ref('')
const deleteConfirmEventId = ref<string>()
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

const editingEvent = computed(() =>
  editingEventId.value ? catTrackerStore.eventsById.get(editingEventId.value) : undefined,
)

const editingCategory = computed(() =>
  editingEvent.value ? categoriesById.value.get(editingEvent.value.categoryId) : undefined,
)

const deleteConfirmEvent = computed(() =>
  deleteConfirmEventId.value ? catTrackerStore.eventsById.get(deleteConfirmEventId.value) : undefined,
)

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

function openEditEvent(event: CatEvent): void {
  editingEventId.value = event.id
  editingOccurredAt.value = toDateTimeLocalValue(event.occurredAt)
  editingNote.value = event.note ?? ''
}

function closeEditEvent(): void {
  editingEventId.value = undefined
  editingOccurredAt.value = ''
  editingNote.value = ''
  deleteConfirmEventId.value = undefined
}

function saveEditingEvent(): void {
  if (!editingEvent.value || !editingOccurredAt.value) {
    return
  }

  catTrackerStore.updateEvent(editingEvent.value.id, {
    occurredAt: fromDateTimeLocalValue(editingOccurredAt.value),
    note: editingNote.value.trim() || undefined,
  })

  closeEditEvent()
}

function deleteEditingEvent(): void {
  if (!editingEvent.value) {
    return
  }

  openDeleteConfirm(editingEvent.value)
}

function openDeleteConfirm(event: CatEvent): void {
  deleteConfirmEventId.value = event.id
}

function confirmDeleteEvent(): void {
  if (!deleteConfirmEvent.value) {
    return
  }

  const deletedEventId = deleteConfirmEvent.value.id

  catTrackerStore.deleteEvent(deletedEventId)
  deleteConfirmEventId.value = undefined

  if (editingEventId.value === deletedEventId) {
    closeEditEvent()
  }
}

function cancelDeleteEvent(): void {
  deleteConfirmEventId.value = undefined
}

function formatEventTime(dateTime: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateTime))
}

function toDateTimeLocalValue(dateTime: string): string {
  const date = new Date(dateTime)
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16)
}

function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString()
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
          <button class="event-item__button" type="button" @click="openEditEvent(item.event)">
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
          </button>
          <button
            class="event-item__delete"
            type="button"
            :aria-label="`刪除 ${item.category?.name ?? '未分類'} 紀錄`"
            @click="openDeleteConfirm(item.event)"
          >
            ×
          </button>
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

    <div
      v-if="editingEvent"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeEditEvent"
    >
      <section
        class="event-modal"
        aria-labelledby="event-modal-title"
        role="dialog"
        aria-modal="true"
        :style="getCategoryStyle(editingCategory)"
      >
        <div class="event-modal__header">
          <div>
            <span class="event-modal__eyebrow">編輯紀錄</span>
            <h2 id="event-modal-title" class="event-modal__title">
              <span class="category-dot" aria-hidden="true"></span>
              <span>{{ editingCategory?.name ?? '未分類' }}</span>
            </h2>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="關閉編輯視窗"
            @click="closeEditEvent"
          >
            ×
          </button>
        </div>

        <form class="event-form" @submit.prevent="saveEditingEvent">
          <label class="field">
            <span class="field__label">發生時間</span>
            <input v-model="editingOccurredAt" class="field__control" type="datetime-local" />
          </label>

          <label class="field">
            <span class="field__label">備註</span>
            <textarea
              v-model="editingNote"
              class="field__control field__control--textarea"
              placeholder="補充症狀、狀態或其他觀察"
              rows="5"
            ></textarea>
          </label>

          <button class="danger-button" type="button" @click="deleteEditingEvent">刪除紀錄</button>

          <div class="event-form__actions">
            <button class="secondary-button" type="button" @click="closeEditEvent">取消</button>
            <button class="primary-button" type="submit">儲存</button>
          </div>
        </form>
      </section>
    </div>

    <ConfirmDialog
      v-if="deleteConfirmEvent"
      title="刪除這筆紀錄？"
      message="刪除後無法復原，這筆今日紀錄會從列表中移除。"
      confirm-label="刪除"
      cancel-label="保留"
      tone="danger"
      @cancel="cancelDeleteEvent"
      @confirm="confirmDeleteEvent"
    />
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
  background: color-mix(in srgb, var(--category-color) 10%, transparent);
}

.event-item__delete:hover {
  background: color-mix(in srgb, #b33a2b 10%, transparent);
  color: #a83224;
}

.event-item__button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--category-color) 62%, #ffffff);
  outline-offset: 2px;
}

.event-item__delete:focus-visible {
  outline: 3px solid #e6a097;
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

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(23, 32, 27, 0.34);
}

.event-modal {
  width: min(100%, 520px);
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--category-color) 34%, #d8e0d8);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 22px 60px rgba(23, 32, 27, 0.24);
}

.event-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.event-modal__eyebrow {
  display: block;
  margin-bottom: 6px;
  color: #65736a;
  font-size: 0.8125rem;
}

.event-modal__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--category-color) 82%, #17201b);
}

.icon-button {
  width: 36px;
  height: 36px;
  border: 1px solid #d8e0d8;
  border-radius: 8px;
  background: #ffffff;
  color: #34423a;
  cursor: pointer;
  font: inherit;
  font-size: 1.35rem;
  line-height: 1;
}

.event-form {
  display: grid;
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field__label {
  color: #34423a;
  font-size: 0.875rem;
  font-weight: 700;
}

.field__control {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd8cf;
  border-radius: 8px;
  padding: 11px 12px;
  background: #ffffff;
  color: #17201b;
  font: inherit;
}

.field__control:focus {
  border-color: var(--category-color);
  outline: 3px solid color-mix(in srgb, var(--category-color) 22%, transparent);
}

.field__control--textarea {
  min-height: 120px;
  resize: vertical;
}

.event-form__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 4px;
}

.primary-button,
.secondary-button,
.danger-button {
  min-height: 44px;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.primary-button {
  border: 1px solid var(--category-color);
  background: var(--category-color);
  color: #ffffff;
}

.secondary-button {
  border: 1px solid #cbd8cf;
  background: #ffffff;
  color: #34423a;
}

.danger-button {
  border: 1px solid #d8aaa3;
  background: #fff5f3;
  color: #a83224;
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
    grid-template-columns: 1fr 44px;
    border-radius: 8px;
  }

  .event-item__button {
    grid-template-columns: 56px 1fr;
    padding: 12px;
  }

  .modal-backdrop {
    padding: 10px;
  }

  .event-modal {
    padding: 16px;
  }
}
</style>
