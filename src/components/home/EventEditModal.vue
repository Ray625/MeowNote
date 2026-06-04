<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { CATEGORY_GROUP_ORDER, getCategoryColorValue } from '@/constants/defaultData'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useClickOutside } from '@/composables/useClickOutside'
import { RemoteCatEventConflictError } from '@/services/syncRemoteCatEvents'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { activeCategories, categoriesById, editingCategory, editingEvent } =
  storeToRefs(catTrackerStore)

const selectedCategoryId = ref('')
const editingTitle = ref('')
const editingOccurredDate = ref('')
const editingOccurredTime = ref('')
const editingNote = ref('')
const editingNumericValue = ref<string | number>('')
const isCategoryMenuOpen = ref(false)
const isSavingEvent = ref(false)
const saveErrorMessage = ref('')
const categorySelectRef = ref<HTMLElement>()
const pendingCategoryId = ref<string>()

const modalCategory = computed(
  () => categoriesById.value.get(selectedCategoryId.value) ?? editingCategory.value,
)
const shouldShowNumericValue = computed(
  () =>
    modalCategory.value?.statisticsMode === 'sum' ||
    modalCategory.value?.statisticsMode === 'measurement' ||
    modalCategory.value?.statisticsMode === 'rating',
)
const isRatingValue = computed(() => modalCategory.value?.statisticsMode === 'rating')
const ratingMax = computed(() => getRatingMax(modalCategory.value))
const ratingDisplayValue = computed(() => {
  const value = Number(editingNumericValue.value)

  return Number.isInteger(value) && value >= 1 && value <= ratingMax.value
    ? value
    : getDefaultRatingValue(ratingMax.value)
})
const isCategoryChangeConfirmOpen = computed(() => Boolean(pendingCategoryId.value))
const groupedActiveCategories = computed(() =>
  CATEGORY_GROUP_ORDER.map((group) => ({
    group,
    categories: activeCategories.value.filter((category) => category.group === group),
  })).filter((item) => item.categories.length > 0),
)
const occurredDateLabel = computed(() => formatDateLabel(editingOccurredDate.value))
const occurredTimeLabel = computed(() => formatTimeLabel(editingOccurredTime.value))
const canEditEvent = computed(() =>
  editingEvent.value ? catTrackerStore.canModifyEvent(editingEvent.value) : false,
)

useBodyScrollLock(computed(() => Boolean(editingEvent.value)))

useClickOutside(categorySelectRef, () => {
  isCategoryMenuOpen.value = false
})

watch(
  editingEvent,
  (event) => {
    selectedCategoryId.value = event?.categoryId ?? ''
    editingTitle.value = event?.title ?? ''
    editingOccurredDate.value = event ? toDateInputValue(event.occurredAt) : ''
    editingOccurredTime.value = event ? toTimeInputValue(event.occurredAt) : ''
    editingNote.value = event?.note ?? ''
    editingNumericValue.value = getNumericValueText(event?.values)
    isCategoryMenuOpen.value = false
    pendingCategoryId.value = undefined
    saveErrorMessage.value = ''
    isSavingEvent.value = false
  },
  { immediate: true },
)

watch(
  modalCategory,
  (category) => {
    if (category?.statisticsMode === 'rating' && !String(editingNumericValue.value).trim()) {
      editingNumericValue.value = getDefaultRatingValue(getRatingMax(category))
    }
  },
  { immediate: true },
)

function closeEditEvent(): void {
  if (isSavingEvent.value) {
    return
  }

  catTrackerStore.closeEditEvent()
}

function toggleCategoryMenu(): void {
  if (!canEditEvent.value) {
    return
  }

  isCategoryMenuOpen.value = !isCategoryMenuOpen.value
}

function closeCategoryMenu(): void {
  isCategoryMenuOpen.value = false
}

function showNativePicker(event: MouseEvent): void {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }

  if (typeof input.showPicker !== 'function') {
    return
  }

  input.showPicker()
}

async function saveEditingEvent(): Promise<void> {
  if (
    !editingEvent.value ||
    !canEditEvent.value ||
    isSavingEvent.value ||
    !editingOccurredDate.value ||
    !editingOccurredTime.value ||
    !selectedCategoryId.value
  ) {
    return
  }

  const hasCategoryChanged = selectedCategoryId.value !== editingEvent.value.categoryId
  const selectedCategory = categoriesById.value.get(selectedCategoryId.value)
  const shouldSaveNumericValue =
    selectedCategory?.statisticsMode === 'sum' ||
    selectedCategory?.statisticsMode === 'measurement' ||
    selectedCategory?.statisticsMode === 'rating'
  const trimmedNumericValue = String(editingNumericValue.value).trim()
  const numericValue = trimmedNumericValue
    ? Number(trimmedNumericValue)
    : selectedCategory?.statisticsMode === 'rating'
      ? getDefaultRatingValue(getRatingMax(selectedCategory))
      : undefined
  const isValidRatingValue =
    selectedCategory?.statisticsMode !== 'rating' ||
    (typeof numericValue === 'number' &&
      Number.isInteger(numericValue) &&
      numericValue >= 1 &&
      numericValue <= getRatingMax(selectedCategory))
  const shouldPersistNumericValue =
    shouldSaveNumericValue && Number.isFinite(numericValue) && isValidRatingValue

  isSavingEvent.value = true
  saveErrorMessage.value = ''

  try {
    await catTrackerStore.updateEvent(editingEvent.value.id, {
      categoryId: selectedCategoryId.value,
      occurredAt: fromDateAndTimeInputValues(editingOccurredDate.value, editingOccurredTime.value),
      title: editingTitle.value.trim() || undefined,
      note: editingNote.value.trim() || undefined,
      values:
        shouldPersistNumericValue
          ? { amount: numericValue }
          : hasCategoryChanged
            ? {}
            : shouldSaveNumericValue
              ? {}
              : {},
    })

    closeEditEvent()
  } catch (error) {
    saveErrorMessage.value =
      error instanceof RemoteCatEventConflictError
        ? '這筆紀錄已被其他裝置或使用者更新或刪除，這次修改沒有儲存。請重新載入最新資料後再編輯。'
        : getSaveErrorMessage(error)
  } finally {
    isSavingEvent.value = false
  }
}

function deleteEditingEvent(): void {
  if (!editingEvent.value || !canEditEvent.value) {
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
  if (!editingEvent.value || !canEditEvent.value) {
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

function getNumericValueText(values?: Record<string, unknown>): string {
  const amount = values?.amount

  return typeof amount === 'number' && Number.isFinite(amount) ? String(amount) : ''
}

function getRatingMax(category?: EventCategory): number {
  return typeof category?.valueMax === 'number' && Number.isInteger(category.valueMax) && category.valueMax >= 2
    ? category.valueMax
    : 10
}

function getDefaultRatingValue(max: number): number {
  return Math.ceil(max / 2)
}

function toDateInputValue(dateTime: string): string {
  const date = new Date(dateTime)
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

function toTimeInputValue(dateTime: string): string {
  const date = new Date(dateTime)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function fromDateAndTimeInputValues(dateValue: string, timeValue: string): string {
  return new Date(`${dateValue}T${timeValue}`).toISOString()
}

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split('-')

  return year && month && day ? `${year}/${month}/${day}` : '選擇日期'
}

function formatTimeLabel(value: string): string {
  return value || '選擇時間'
}

function getSaveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '儲存失敗，請稍後再試。'
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
          <span class="event-modal__eyebrow">{{ canEditEvent ? '編輯紀錄' : '檢視紀錄' }}</span>
          <h2 id="event-modal-title" class="event-modal__title">
            <span class="category-dot" aria-hidden="true"></span>
            <span>{{ modalCategory?.name ?? '未分類' }}</span>
          </h2>
        </div>
        <button
          class="ui-button ui-button--icon icon-button"
          type="button"
          aria-label="關閉編輯視窗"
          :disabled="isSavingEvent"
          @click="closeEditEvent"
        >
          ×
        </button>
      </div>

      <form class="event-form" @submit.prevent="saveEditingEvent">
        <div ref="categorySelectRef" class="field category-select-field">
          <span class="field__label">分類</span>
          <button
            class="category-select-trigger"
            type="button"
            :disabled="!canEditEvent"
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
            :disabled="!canEditEvent"
          />
        </label>

        <label class="field">
          <span class="field__label">發生時間</span>
          <div class="datetime-fields">
            <div class="native-picker-field">
              <div class="datetime-display" aria-hidden="true">
                <span class="datetime-display__label">日期</span>
                <span class="datetime-display__value">{{ occurredDateLabel }}</span>
              </div>
              <input
                v-model="editingOccurredDate"
                class="native-picker-input"
                type="date"
                aria-label="選擇日期"
                :disabled="!canEditEvent"
                @click="showNativePicker"
              />
            </div>
            <div class="native-picker-field">
              <div class="datetime-display" aria-hidden="true">
                <span class="datetime-display__label">時間</span>
                <span class="datetime-display__value">{{ occurredTimeLabel }}</span>
              </div>
              <input
                v-model="editingOccurredTime"
                class="native-picker-input"
                type="time"
                aria-label="選擇時間"
                :disabled="!canEditEvent"
                @click="showNativePicker"
              />
            </div>
          </div>
        </label>

        <label v-if="shouldShowNumericValue" class="field">
          <span class="field__label">
            {{ modalCategory?.valueLabel || '數值' }}
            <template v-if="modalCategory?.valueUnit">({{ modalCategory.valueUnit }})</template>
          </span>
          <div v-if="isRatingValue" class="rating-control">
            <input
              v-model.number="editingNumericValue"
              class="rating-slider"
              type="range"
              min="1"
              :max="ratingMax"
              step="1"
              :disabled="!canEditEvent"
            />
            <div class="rating-ticks" aria-hidden="true">
              <span v-for="value in ratingMax" :key="value"></span>
            </div>
            <div class="rating-scale" aria-hidden="true">
              <span>1</span>
              <span>{{ ratingMax }}</span>
            </div>
            <span class="rating-current">目前評分：{{ ratingDisplayValue }}</span>
          </div>
          <input
            v-else
            v-model="editingNumericValue"
            class="field__control"
            type="number"
            inputmode="decimal"
            step="any"
            :disabled="!canEditEvent"
          />
        </label>

        <label class="field">
          <span class="field__label">備註</span>
          <textarea
            v-model="editingNote"
            class="field__control field__control--textarea"
            placeholder="補充症狀、狀態或其他觀察"
            rows="5"
            :disabled="!canEditEvent"
          ></textarea>
        </label>

        <p v-if="!canEditEvent" class="readonly-message">
          這筆紀錄由其他成員建立，你可以查看內容，但不能編輯或刪除。
        </p>
        <p v-if="saveErrorMessage" class="save-error-message">
          {{ saveErrorMessage }}
        </p>

        <div class="event-form__actions" :class="{ 'event-form__actions--single': !canEditEvent }">
          <button
            class="ui-button ui-button--secondary secondary-button"
            type="button"
            :disabled="isSavingEvent"
            @click="closeEditEvent"
          >
            {{ canEditEvent ? '取消' : '關閉' }}
          </button>
          <button
            v-if="canEditEvent"
            class="ui-button ui-button--primary primary-button"
            type="submit"
            :disabled="isSavingEvent"
          >
            {{ isSavingEvent ? '儲存中' : '儲存' }}
          </button>
        </div>

        <button
          v-if="canEditEvent"
          class="ui-button ui-button--danger danger-button"
          type="button"
          :disabled="isSavingEvent"
          @click="deleteEditingEvent"
        >
          刪除紀錄
        </button>
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
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  background: var(--overlay-color);
}

.event-modal {
  width: min(100%, 520px);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  overscroll-behavior: contain;
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
  min-width: 0;
  max-width: 100%;
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

.field__control:disabled {
  opacity: 1;
  color: var(--color-text);
  -webkit-text-fill-color: var(--color-text);
  cursor: default;
}

.datetime-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 8px;
}

.native-picker-field {
  position: relative;
  min-width: 0;
}

.datetime-display {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 46px;
  box-sizing: border-box;
  align-content: center;
  gap: 2px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.native-picker-field:hover .datetime-display {
  border-color: var(--color-border-strong);
  background: var(--color-primary-light);
}

.native-picker-field:focus-within .datetime-display {
  border-color: var(--category-color);
  outline: 3px solid color-mix(in srgb, var(--category-color) 22%, transparent);
}

.datetime-display__label {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.2;
}

.datetime-display__value {
  min-width: 0;
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.native-picker-input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  opacity: 0;
  color: transparent;
  font-size: 16px;
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

.category-select-trigger:disabled {
  cursor: default;
  opacity: 1;
}

.category-select-trigger:disabled:hover {
  border-color: var(--color-border);
  background: var(--color-surface);
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

.rating-slider {
  width: 100%;
  margin: 0;
  accent-color: var(--category-color);
}

.rating-control {
  --rating-thumb-size: 30px;

  display: grid;
  gap: 6px;
}

.rating-ticks {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 calc(var(--rating-thumb-size) / 2);
}

.rating-ticks span {
  width: 1px;
  height: 7px;
  border-radius: 999px;
  background: var(--color-border-strong);
}

.rating-scale {
  display: flex;
  justify-content: space-between;
  padding: 0 calc(var(--rating-thumb-size) / 2);
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-weight: 800;
}

.rating-current {
  color: var(--color-text);
  font-size: 0.9375rem;
  font-weight: 800;
}

.readonly-message {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.save-error-message {
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--color-danger) 34%, transparent);
  border-radius: 8px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.5;
}

.event-form__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 4px;
}

.event-form__actions--single {
  grid-template-columns: 1fr;
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

  .datetime-fields {
    grid-template-columns: 1fr;
  }
}
</style>
