<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FixedModal from '@/components/common/FixedModal.vue'
import PhotoPreview from '@/components/common/PhotoPreview.vue'
import { CATEGORY_GROUP_ORDER, getCategoryColorValue } from '@/constants/defaultData'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useClickOutside } from '@/composables/useClickOutside'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import {
  createEventPhotoSignedUrls,
  deleteEventPhotoPaths,
  getEventPhotoStoragePaths,
  MAX_EVENT_PHOTO_COUNT,
  MAX_ORIGINAL_EVENT_PHOTO_BYTES,
  MAX_PENDING_ORIGINAL_EVENT_PHOTO_BYTES,
  uploadEventPhoto,
} from '@/services/eventPhotoStorage'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CatEvent, EventCategory, EventPhoto } from '@/types'
import { createId } from '@/utils/id'

const catTrackerStore = useCatTrackerStore()
const remoteAuth = useRemoteAuth()
const { activeCategories, categoriesById, editingCategory, editingEvent, isCreatingEventDraft } =
  storeToRefs(catTrackerStore)

const selectedCategoryId = ref('')
const editingTitle = ref('')
const editingOccurredDate = ref('')
const editingOccurredTime = ref('')
const editingNote = ref('')
const editingNumericValue = ref<string | number>('')
const isCategoryMenuOpen = ref(false)
const isSavingEvent = ref(false)
const categorySelectRef = ref<HTMLElement>()
const pendingCategoryId = ref<string>()
const existingPhotos = ref<EventPhoto[]>([])
const existingPhotoUrls = ref<Map<string, string>>(new Map())
const existingFullPhotoUrls = ref<Map<string, string>>(new Map())
const pendingPhotos = ref<Array<{ id: string; file: File; previewUrl: string }>>([])
const photoUploadError = ref('')
const photoInputRef = ref<HTMLInputElement>()
const previewPhotoIndex = ref<number>()

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
  isCreatingEventDraft.value
    ? true
    : editingEvent.value
      ? catTrackerStore.canModifyEvent(editingEvent.value)
      : false,
)
const canUploadPhotos = computed(() =>
  Boolean(remoteAuth.activeNotebookId.value && canEditEvent.value),
)
const totalPhotoCount = computed(() => existingPhotos.value.length + pendingPhotos.value.length)
const remainingPhotoSlots = computed(() => MAX_EVENT_PHOTO_COUNT - totalPhotoCount.value)
const previewPhotos = computed(() => [
  ...existingPhotos.value
    .map((photo) => ({
      key: photo.path,
      kind: 'existing' as const,
      src:
        existingFullPhotoUrls.value.get(photo.path) ??
        existingPhotoUrls.value.get(photo.path) ??
        '',
      alt: '事件照片',
    }))
    .filter((photo) => photo.src),
  ...pendingPhotos.value.map((photo) => ({
    key: photo.id,
    kind: 'pending' as const,
    src: photo.previewUrl,
    alt: '待上傳事件照片',
  })),
])
const activePreviewPhoto = computed(() =>
  typeof previewPhotoIndex.value === 'number'
    ? previewPhotos.value[previewPhotoIndex.value]
    : undefined,
)
const canDeleteActivePreviewPhoto = computed(() =>
  Boolean(canEditEvent.value && activePreviewPhoto.value),
)

interface EventFormSnapshot {
  categoryId: string
  occurredAt: string
  title?: string
  note?: string
  photos: EventPhoto[]
  values: Record<string, unknown>
}

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
    existingPhotos.value = event?.photos ? [...event.photos] : []
    void refreshExistingPhotoUrls(existingPhotos.value)
    clearPendingPhotos()
    photoUploadError.value = ''
    closePhotoPreview()
    isCategoryMenuOpen.value = false
    pendingCategoryId.value = undefined
    isSavingEvent.value = false
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearPendingPhotos()
})

watch(
  modalCategory,
  (category) => {
    if (category?.statisticsMode === 'rating' && !String(editingNumericValue.value).trim()) {
      editingNumericValue.value = getDefaultRatingValue(getRatingMax(category))
    }
  },
  { immediate: true },
)

watch(previewPhotoIndex, (index) => {
  if (typeof index !== 'number') {
    return
  }

  const photo = previewPhotos.value[index]

  if (photo?.kind === 'existing') {
    void ensureFullPhotoUrl(photo.key)
  }
})

function closeEditEvent(): void {
  if (isSavingEvent.value) {
    return
  }

  catTrackerStore.closeEditEvent()
}

function closePhotoPreview(): void {
  previewPhotoIndex.value = undefined
}

function openPhotoPreview(photoKey: string): void {
  const photoIndex = previewPhotos.value.findIndex((photo) => photo.key === photoKey)

  if (photoIndex < 0) {
    return
  }

  previewPhotoIndex.value = photoIndex
}

function deleteActivePreviewPhoto(): void {
  if (!canDeleteActivePreviewPhoto.value || !activePreviewPhoto.value) {
    return
  }

  const currentIndex = previewPhotoIndex.value ?? 0
  const deletingPhoto = activePreviewPhoto.value

  if (deletingPhoto.kind === 'existing') {
    removeExistingPhoto(deletingPhoto.key, false)
  } else {
    removePendingPhoto(deletingPhoto.key, false)
  }

  const nextPhotoCount = previewPhotos.value.length

  if (nextPhotoCount === 0) {
    closePhotoPreview()
    return
  }

  previewPhotoIndex.value = Math.min(currentIndex, nextPhotoCount - 1)
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

  const previousPhotos = editingEvent.value.photos ?? []
  const removedPhotos = previousPhotos.filter(
    (photo) => !existingPhotos.value.some((existingPhoto) => existingPhoto.path === photo.path),
  )
  const removedPhotoPaths = getEventPhotoStoragePaths(removedPhotos)
  const eventInput = {
    categoryId: selectedCategoryId.value,
    occurredAt: fromDateAndTimeInputValues(editingOccurredDate.value, editingOccurredTime.value),
    title: editingTitle.value.trim() || undefined,
    note: editingNote.value.trim() || undefined,
    photos: [...existingPhotos.value],
    values: shouldPersistNumericValue
      ? { amount: numericValue }
      : hasCategoryChanged
        ? {}
        : shouldSaveNumericValue
          ? {}
          : {},
  }

  if (
    !isCreatingEventDraft.value &&
    pendingPhotos.value.length === 0 &&
    removedPhotoPaths.length === 0 &&
    !hasEventFormChanges(editingEvent.value, eventInput, selectedCategory)
  ) {
    catTrackerStore.closeEditEvent()
    return
  }

  isSavingEvent.value = true
  const uploadedPhotoPaths: string[] = []

  try {
    const uploadedPhotos = await uploadPendingPhotos(editingEvent.value.id)

    uploadedPhotoPaths.push(...getEventPhotoStoragePaths(uploadedPhotos))
    eventInput.photos = [...existingPhotos.value, ...uploadedPhotos]

    if (isCreatingEventDraft.value) {
      catTrackerStore.createEvent({
        id: editingEvent.value.id,
        catId: editingEvent.value.catId,
        ...eventInput,
      })
    } else {
      await catTrackerStore.updateEvent(editingEvent.value.id, eventInput)
    }

    if (removedPhotoPaths.length) {
      void deleteEventPhotoPaths(removedPhotoPaths)
    }

    catTrackerStore.closeEditEvent()
  } catch (error) {
    if (uploadedPhotoPaths.length) {
      void deleteEventPhotoPaths(uploadedPhotoPaths)
    }
    photoUploadError.value = getPhotoUploadErrorMessage(error)
    // Store-level sync errors are surfaced by the global toast.
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

function addPendingPhotos(event: Event): void {
  if (!canUploadPhotos.value || remainingPhotoSlots.value <= 0) {
    return
  }

  const input = event.target as HTMLInputElement
  const selectedFiles = Array.from(input.files ?? [])
  const acceptedFiles: File[] = []
  const pendingOriginalBytes = pendingPhotos.value.reduce(
    (total, photo) => total + photo.file.size,
    0,
  )
  let nextPendingOriginalBytes = pendingOriginalBytes

  photoUploadError.value = ''

  for (const file of selectedFiles) {
    if (acceptedFiles.length >= remainingPhotoSlots.value) {
      photoUploadError.value = `每筆紀錄最多 ${MAX_EVENT_PHOTO_COUNT} 張照片。`
      break
    }

    if (file.size > MAX_ORIGINAL_EVENT_PHOTO_BYTES) {
      photoUploadError.value = `單張照片原始檔不能超過 ${formatFileSize(MAX_ORIGINAL_EVENT_PHOTO_BYTES)}。`
      continue
    }

    if (nextPendingOriginalBytes + file.size > MAX_PENDING_ORIGINAL_EVENT_PHOTO_BYTES) {
      photoUploadError.value = `這次待上傳的照片總量不能超過 ${formatFileSize(MAX_PENDING_ORIGINAL_EVENT_PHOTO_BYTES)}。`
      continue
    }

    nextPendingOriginalBytes += file.size
    acceptedFiles.push(file)
  }

  if (acceptedFiles.length === 0) {
    input.value = ''
    return
  }

  pendingPhotos.value = [
    ...pendingPhotos.value,
    ...acceptedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${createId('photo-preview')}`,
      file,
      previewUrl: URL.createObjectURL(file),
    })),
  ]

  input.value = ''
}

function removeExistingPhoto(path: string, shouldClosePreview = true): void {
  if (!canEditEvent.value) {
    return
  }

  existingPhotos.value = existingPhotos.value.filter((photo) => photo.path !== path)

  if (shouldClosePreview) {
    closePhotoPreview()
  }
}

function removePendingPhoto(photoId: string, shouldClosePreview = true): void {
  const photo = pendingPhotos.value.find((item) => item.id === photoId)

  if (photo) {
    URL.revokeObjectURL(photo.previewUrl)
  }

  pendingPhotos.value = pendingPhotos.value.filter((item) => item.id !== photoId)
  photoUploadError.value = ''

  if (shouldClosePreview) {
    closePhotoPreview()
  }
}

async function uploadPendingPhotos(eventId: string): Promise<EventPhoto[]> {
  const notebookId = remoteAuth.activeNotebookId.value

  if (!notebookId || pendingPhotos.value.length === 0) {
    return []
  }

  const uploadedPhotos: EventPhoto[] = []

  for (const [index, photo] of pendingPhotos.value.entries()) {
    uploadedPhotos.push(
      await uploadEventPhoto({
        file: photo.file,
        notebookId,
        eventId,
        index: existingPhotos.value.length + index + 1,
      }),
    )
  }

  return uploadedPhotos
}

function formatFileSize(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`
}

function getPhotoUploadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''

  if (message.includes('row-level security') || message.includes('violates row-level security')) {
    return '照片上傳未通過安全限制，可能已超過配額或短時間上傳太多。'
  }

  if (message) {
    return `照片上傳失敗：${message}`
  }

  return '照片上傳失敗，請稍後再試。'
}

async function refreshExistingPhotoUrls(photos: EventPhoto[]): Promise<void> {
  try {
    const displayPaths = photos.map((photo) => photo.thumbnailPath ?? photo.path)
    const signedUrls = await createEventPhotoSignedUrls(displayPaths)

    existingPhotoUrls.value = new Map(
      photos.flatMap((photo) => {
        const signedUrl = signedUrls.get(photo.thumbnailPath ?? photo.path)

        return signedUrl ? [[photo.path, signedUrl] as const] : []
      }),
    )
    existingFullPhotoUrls.value = new Map()
  } catch {
    existingPhotoUrls.value = new Map()
    existingFullPhotoUrls.value = new Map()
  }
}

async function ensureFullPhotoUrl(path: string): Promise<void> {
  if (existingFullPhotoUrls.value.has(path)) {
    return
  }

  try {
    const signedUrls = await createEventPhotoSignedUrls([path])
    const signedUrl = signedUrls.get(path)

    if (signedUrl) {
      existingFullPhotoUrls.value = new Map(existingFullPhotoUrls.value).set(path, signedUrl)
    }
  } catch {
    // Keep the thumbnail visible when the full-size image cannot be loaded.
  }
}

function clearPendingPhotos(): void {
  for (const photo of pendingPhotos.value) {
    URL.revokeObjectURL(photo.previewUrl)
  }

  pendingPhotos.value = []
  closePhotoPreview()
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

function hasEventFormChanges(
  event: CatEvent,
  snapshot: EventFormSnapshot,
  selectedCategory?: EventCategory,
): boolean {
  const originalSnapshot = getOriginalEventFormSnapshot(event, selectedCategory)

  return (
    originalSnapshot.categoryId !== snapshot.categoryId ||
    originalSnapshot.occurredAt !== snapshot.occurredAt ||
    originalSnapshot.title !== snapshot.title ||
    originalSnapshot.note !== snapshot.note ||
    !arePhotoListsEqual(originalSnapshot.photos, snapshot.photos) ||
    !areEventValuesEqual(originalSnapshot.values, snapshot.values)
  )
}

function getOriginalEventFormSnapshot(
  event: CatEvent,
  selectedCategory?: EventCategory,
): EventFormSnapshot {
  const originalCategory = categoriesById.value.get(event.categoryId)
  const shouldCompareNumericValue =
    selectedCategory?.id === event.categoryId &&
    (originalCategory?.statisticsMode === 'sum' ||
      originalCategory?.statisticsMode === 'measurement' ||
      originalCategory?.statisticsMode === 'rating')
  const originalAmount = shouldCompareNumericValue ? event.values?.amount : undefined

  return {
    categoryId: event.categoryId,
    occurredAt: fromDateAndTimeInputValues(
      toDateInputValue(event.occurredAt),
      toTimeInputValue(event.occurredAt),
    ),
    title: event.title?.trim() || undefined,
    note: event.note?.trim() || undefined,
    photos: event.photos ?? [],
    values:
      typeof originalAmount === 'number' && Number.isFinite(originalAmount)
        ? { amount: originalAmount }
        : {},
  }
}

function arePhotoListsEqual(left: EventPhoto[], right: EventPhoto[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((photo, index) => {
    const otherPhoto = right[index]

    if (!otherPhoto) {
      return false
    }

    return (
      photo.path === otherPhoto.path &&
      photo.thumbnailPath === otherPhoto.thumbnailPath &&
      photo.width === otherPhoto.width &&
      photo.height === otherPhoto.height
    )
  })
}

function areEventValuesEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function getNumericValueText(values?: Record<string, unknown>): string {
  const amount = values?.amount

  return typeof amount === 'number' && Number.isFinite(amount) ? String(amount) : ''
}

function getRatingMax(category?: EventCategory): number {
  return typeof category?.valueMax === 'number' &&
    Number.isInteger(category.valueMax) &&
    category.valueMax >= 2
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
</script>

<template>
  <div v-if="editingEvent">
    <FixedModal
      panel-tag="form"
      labelledby="event-modal-title"
      accented
      :close-on-backdrop="!isSavingEvent"
      :panel-style="getCategoryStyle(modalCategory)"
      @close="closeEditEvent"
      @submit.prevent="saveEditingEvent"
    >
      <template #header>
        <div>
          <span id="event-modal-title" class="event-modal__eyebrow">
            {{ isCreatingEventDraft ? '新增紀錄' : canEditEvent ? '編輯紀錄' : '檢視紀錄' }}
          </span>
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
      </template>

      <template #body>
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
          <span class="field__label">備註</span>
          <textarea
            v-model="editingNote"
            class="field__control field__control--textarea"
            placeholder="補充症狀、狀態或其他觀察"
            rows="5"
            :disabled="!canEditEvent"
          ></textarea>
        </label>

        <div class="field">
          <div class="photo-field__header">
            <span class="field__label">照片</span>
            <span class="photo-field__count"
              >{{ totalPhotoCount }} / {{ MAX_EVENT_PHOTO_COUNT }}</span
            >
          </div>
          <div v-if="totalPhotoCount > 0" class="photo-grid">
            <div v-for="photo in existingPhotos" :key="photo.path" class="photo-thumb">
              <button
                v-if="existingPhotoUrls.get(photo.path)"
                class="photo-thumb__preview"
                type="button"
                aria-label="預覽照片"
                @click="openPhotoPreview(photo.path)"
              >
                <img :src="existingPhotoUrls.get(photo.path)" alt="事件照片" />
              </button>
              <span v-else class="photo-thumb__placeholder">圖片載入中</span>
              <button
                v-if="canEditEvent"
                class="photo-thumb__remove"
                type="button"
                aria-label="移除照片"
                :disabled="isSavingEvent"
                @click="removeExistingPhoto(photo.path)"
              >
                ×
              </button>
            </div>
            <div v-for="photo in pendingPhotos" :key="photo.id" class="photo-thumb">
              <button
                class="photo-thumb__preview"
                type="button"
                aria-label="預覽待上傳照片"
                @click="openPhotoPreview(photo.id)"
              >
                <img :src="photo.previewUrl" alt="待上傳事件照片" />
              </button>
              <button
                class="photo-thumb__remove"
                type="button"
                aria-label="移除照片"
                :disabled="isSavingEvent"
                @click="removePendingPhoto(photo.id)"
              >
                ×
              </button>
            </div>
          </div>

          <input
            ref="photoInputRef"
            class="visually-hidden-input"
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            :disabled="!canUploadPhotos || remainingPhotoSlots <= 0 || isSavingEvent"
            @change="addPendingPhotos"
          />
          <button
            v-if="canEditEvent && remainingPhotoSlots > 0"
            class="ui-button ui-button--secondary photo-upload-button"
            type="button"
            :disabled="!canUploadPhotos || isSavingEvent"
            @click="photoInputRef?.click()"
          >
            加入照片
          </button>
          <p v-if="canEditEvent && !canUploadPhotos" class="photo-field__hint">
            登入並使用雲端筆記簿後可以上傳照片。
          </p>
          <p v-else-if="photoUploadError" class="photo-field__error">{{ photoUploadError }}</p>
          <p v-else class="photo-field__hint">每筆紀錄最多 3 張</p>
        </div>

        <p v-if="!canEditEvent" class="readonly-message">
          這筆紀錄由其他成員建立，你可以查看內容，但不能編輯或刪除。
        </p>
      </template>

      <template #footer>
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
          v-if="canEditEvent && !isCreatingEventDraft"
          class="ui-button ui-button--danger danger-button"
          type="button"
          :disabled="isSavingEvent"
          @click="deleteEditingEvent"
        >
          刪除紀錄
        </button>
      </template>
    </FixedModal>

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

    <PhotoPreview
      v-if="activePreviewPhoto && typeof previewPhotoIndex === 'number'"
      :photos="previewPhotos"
      :index="previewPhotoIndex"
      :can-delete="canDeleteActivePreviewPhoto"
      @update:index="previewPhotoIndex = $event"
      @close="closePhotoPreview"
      @delete="deleteActivePreviewPhoto"
    />
  </div>
</template>

<style scoped>
.event-modal__eyebrow {
  display: block;
  margin: 0;
  color: var(--color-text);
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.25;
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

.photo-field__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.photo-field__count,
.photo-field__hint,
.photo-field__error {
  color: var(--color-muted);
  font-size: 0.8125rem;
}

.photo-field__hint,
.photo-field__error {
  margin: 0;
  line-height: 1.5;
}

.photo-field__error {
  color: var(--color-danger);
  font-weight: 700;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.photo-thumb {
  position: relative;
  display: grid;
  width: 72px;
  height: 72px;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.photo-thumb__preview {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-thumb__placeholder {
  padding: 8px;
  color: var(--color-muted);
  font-size: 0.75rem;
  text-align: center;
}

.photo-thumb__remove {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
  color: var(--color-danger);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  line-height: 1;
}

.photo-upload-button {
  min-height: 42px;
}

.visually-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
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

.event-form__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
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
  .datetime-fields {
    grid-template-columns: 1fr;
  }
}
</style>
