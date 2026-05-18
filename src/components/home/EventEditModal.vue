<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { CATEGORY_GROUP_ORDER, getCategoryColorValue } from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { activeCategories, categoriesById, editingCategory, editingEvent } =
  storeToRefs(catTrackerStore)

const selectedCategoryId = ref('')
const editingTitle = ref('')
const editingOccurredAt = ref('')
const editingNote = ref('')
const isCategoryMenuOpen = ref(false)
const pendingCategoryId = ref<string>()

const modalCategory = computed(
  () => categoriesById.value.get(selectedCategoryId.value) ?? editingCategory.value,
)
const isCategoryChangeConfirmOpen = computed(() => Boolean(pendingCategoryId.value))
const groupedActiveCategories = computed(() =>
  CATEGORY_GROUP_ORDER.map((group) => ({
    group,
    categories: activeCategories.value.filter((category) => category.group === group),
  })).filter((item) => item.categories.length > 0),
)

watch(
  editingEvent,
  (event) => {
    selectedCategoryId.value = event?.categoryId ?? ''
    editingTitle.value = event?.title ?? ''
    editingOccurredAt.value = event ? toDateTimeLocalValue(event.occurredAt) : ''
    editingNote.value = event?.note ?? ''
    isCategoryMenuOpen.value = false
    pendingCategoryId.value = undefined
  },
  { immediate: true },
)

function closeEditEvent(): void {
  catTrackerStore.closeEditEvent()
}

function toggleCategoryMenu(): void {
  isCategoryMenuOpen.value = !isCategoryMenuOpen.value
}

function closeCategoryMenu(): void {
  isCategoryMenuOpen.value = false
}

function saveEditingEvent(): void {
  if (!editingEvent.value || !editingOccurredAt.value || !selectedCategoryId.value) {
    return
  }

  const hasCategoryChanged = selectedCategoryId.value !== editingEvent.value.categoryId

  catTrackerStore.updateEvent(editingEvent.value.id, {
    categoryId: selectedCategoryId.value,
    occurredAt: fromDateTimeLocalValue(editingOccurredAt.value),
    title: editingTitle.value.trim() || undefined,
    note: editingNote.value.trim() || undefined,
    values: hasCategoryChanged ? {} : editingEvent.value.values,
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
    '--category-color': getCategoryColorValue(category),
  }
}

function requestCategoryChange(nextCategoryId: string): void {
  if (!editingEvent.value) {
    return
  }

  if (!nextCategoryId || nextCategoryId === selectedCategoryId.value) {
    closeCategoryMenu()
    return
  }

  if (
    nextCategoryId === editingEvent.value.categoryId ||
    !hasEventValues(editingEvent.value.values)
  ) {
    selectedCategoryId.value = nextCategoryId
    closeCategoryMenu()
    return
  }

  pendingCategoryId.value = nextCategoryId
  closeCategoryMenu()
}

function cancelCategoryChange(): void {
  pendingCategoryId.value = undefined
}

function confirmCategoryChange(): void {
  if (!pendingCategoryId.value) {
    return
  }

  selectedCategoryId.value = pendingCategoryId.value
  pendingCategoryId.value = undefined
}

function hasEventValues(values?: Record<string, unknown>): boolean {
  return Boolean(values && Object.keys(values).length > 0)
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
      :style="getCategoryStyle(modalCategory)"
    >
      <div class="event-modal__header">
        <div>
          <span class="event-modal__eyebrow">編輯紀錄</span>
          <h2 id="event-modal-title" class="event-modal__title">
            <span class="category-dot" aria-hidden="true"></span>
            <span>{{ modalCategory?.name ?? '未分類' }}</span>
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
        <div class="field category-select-field">
          <span class="field__label">分類</span>
          <button
            class="category-select-trigger"
            type="button"
            :aria-expanded="isCategoryMenuOpen"
            aria-haspopup="listbox"
            @click="toggleCategoryMenu"
          >
            <span class="category-select-trigger__content">
              <span class="category-dot" aria-hidden="true"></span>
              <span>{{ modalCategory?.name ?? '選擇分類' }}</span>
            </span>
            <span class="category-select-trigger__chevron" aria-hidden="true">⌄</span>
          </button>

          <div v-if="isCategoryMenuOpen" class="category-menu" role="listbox">
            <section
              v-for="group in groupedActiveCategories"
              :key="group.group"
              class="category-menu__group"
              :aria-label="group.group"
            >
              <h3 class="category-menu__group-title">{{ group.group }}</h3>
              <button
                v-for="category in group.categories"
                :key="category.id"
                class="category-option"
                :class="{ 'category-option--selected': selectedCategoryId === category.id }"
                :style="getCategoryStyle(category)"
                type="button"
                role="option"
                :aria-selected="selectedCategoryId === category.id"
                @click="requestCategoryChange(category.id)"
              >
                <span class="category-option__check" aria-hidden="true">
                  {{ selectedCategoryId === category.id ? '✓' : '' }}
                </span>
                <span class="category-dot" aria-hidden="true"></span>
                <span class="category-option__name">{{ category.name }}</span>
              </button>
            </section>
          </div>
        </div>

        <label class="field">
          <span class="field__label">標題</span>
          <input
            v-model="editingTitle"
            class="field__control"
            type="text"
            maxlength="40"
            placeholder="例如：未消化飼料、少量、精神正常"
          />
        </label>

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

        <button
          class="ui-button ui-button--danger danger-button"
          type="button"
          @click="deleteEditingEvent"
        >
          刪除紀錄
        </button>

        <div class="event-form__actions">
          <button
            class="ui-button ui-button--secondary secondary-button"
            type="button"
            @click="closeEditEvent"
          >
            取消
          </button>
          <button class="ui-button ui-button--primary primary-button" type="submit">儲存</button>
        </div>
      </form>
    </section>

    <ConfirmDialog
      v-if="isCategoryChangeConfirmOpen"
      title="更改分類？"
      message="更改分類後，原分類的詳細欄位可能不適用，將會清除分類專屬資料。"
      confirm-label="更改分類"
      cancel-label="取消"
      tone="danger"
      @cancel="cancelCategoryChange"
      @confirm="confirmCategoryChange"
    />
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
  background: var(--overlay-color);
}

.event-modal {
  width: min(100%, 520px);
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--category-color) 34%, var(--color-border));
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 22px 60px var(--shadow-color);
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
  color: var(--color-muted);
  font-size: 0.8125rem;
}

.event-modal__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: color-mix(in srgb, var(--category-color) 82%, var(--color-text));
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
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 700;
}

.category-select-field {
  position: relative;
}

.field__control {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 11px 12px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.field__control:focus {
  border-color: var(--category-color);
  outline: 3px solid color-mix(in srgb, var(--category-color) 22%, transparent);
}

.category-select-trigger {
  display: flex;
  width: 100%;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.category-select-trigger:hover {
  border-color: var(--color-border-strong);
  background: var(--color-primary-light);
}

.category-select-trigger:focus {
  border-color: var(--category-color);
  outline: 3px solid color-mix(in srgb, var(--category-color) 22%, transparent);
}

.category-select-trigger__content {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.category-select-trigger__content span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-select-trigger__chevron {
  color: var(--color-muted);
  font-size: 1rem;
  line-height: 1;
}

.category-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 4;
  display: grid;
  max-height: min(360px, 48vh);
  gap: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.category-menu__group {
  display: grid;
  gap: 4px;
}

.category-menu__group + .category-menu__group {
  padding-top: 6px;
  border-top: 1px solid var(--color-divider);
}

.category-menu__group-title {
  margin: 0;
  padding: 4px 8px;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.category-option {
  display: grid;
  grid-template-columns: 18px 12px 1fr;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.category-option:hover {
  border-color: color-mix(in srgb, var(--category-color) 34%, var(--color-border));
  background: color-mix(in srgb, var(--category-color) 8%, var(--color-surface));
}

.category-option--selected {
  border-color: color-mix(in srgb, var(--category-color) 44%, var(--color-border));
  background: color-mix(in srgb, var(--category-color) 12%, var(--color-surface));
}

.category-option__check {
  color: var(--category-color);
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.category-option__name {
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  --button-color: var(--color-primary);
  --button-hover-color: var(--color-primary-dark);
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
