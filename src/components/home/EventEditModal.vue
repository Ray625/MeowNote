<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { editingCategory, editingEvent } = storeToRefs(catTrackerStore)

const editingOccurredAt = ref('')
const editingNote = ref('')

watch(
  editingEvent,
  (event) => {
    editingOccurredAt.value = event ? toDateTimeLocalValue(event.occurredAt) : ''
    editingNote.value = event?.note ?? ''
  },
  { immediate: true },
)

function closeEditEvent(): void {
  catTrackerStore.closeEditEvent()
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

  catTrackerStore.openDeleteConfirm(editingEvent.value.id)
}

function getCategoryStyle(category?: EventCategory): Record<string, string> {
  return {
    '--category-color': category?.color ?? '#65736a',
  }
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
  <div v-if="editingEvent" class="modal-backdrop" role="presentation" @click.self="closeEditEvent">
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
          class="ui-button ui-button--icon icon-button"
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

        <button class="ui-button ui-button--danger danger-button" type="button" @click="deleteEditingEvent">
          刪除紀錄
        </button>

        <div class="event-form__actions">
          <button class="ui-button ui-button--secondary secondary-button" type="button" @click="closeEditEvent">
            取消
          </button>
          <button class="ui-button ui-button--primary primary-button" type="submit">儲存</button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
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
  gap: 6px;
  margin: 0;
  color: color-mix(in srgb, var(--category-color) 82%, #17201b);
  font-size: 1.25rem;
}

.category-dot {
  width: 0.625rem;
  height: 0.625rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--category-color);
}

.icon-button {
  width: 36px;
  height: 36px;
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
}

.primary-button {
  --button-color: var(--category-color);
  --button-hover-color: color-mix(in srgb, var(--category-color) 88%, #17201b);
}

@media (max-width: 560px) {
  .modal-backdrop {
    padding: 10px;
  }

  .event-modal {
    padding: 16px;
  }
}
</style>
