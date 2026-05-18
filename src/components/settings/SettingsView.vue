<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_GROUP_ORDER,
  DEFAULT_CATEGORY_COLOR_ID,
  getCategoryColorId,
  getCategoryColorValue,
} from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CategoryColorId, EventCategory, EventCategoryGroup } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { categoriesByGroup } = storeToRefs(catTrackerStore)

const editingCategoryId = ref<string>()
const categoryName = ref('')
const categoryGroup = ref<EventCategoryGroup>('攝取')
const categoryColorId = ref<CategoryColorId>(DEFAULT_CATEGORY_COLOR_ID)
const isQuickAction = ref(true)
const isCategoryModalOpen = ref(false)
const draggingCategoryId = ref<string>()
const dragTargetCategoryId = ref<string>()
const dragTargetPosition = ref<'before' | 'after'>('before')
const pendingDeleteCategoryId = ref<string>()

const isEditing = computed(() => Boolean(editingCategoryId.value))
const formTitle = computed(() => (isEditing.value ? '編輯分類' : '新增分類'))
const pendingDeleteCategory = computed(() =>
  pendingDeleteCategoryId.value
    ? catTrackerStore.categoriesById.get(pendingDeleteCategoryId.value)
    : undefined,
)
const pendingDeleteUsageCount = computed(() =>
  pendingDeleteCategory.value
    ? catTrackerStore.getCategoryUsageCount(pendingDeleteCategory.value.id)
    : 0,
)
const deleteActionLabel = computed(() => (pendingDeleteUsageCount.value > 0 ? '停用' : '刪除'))
const deleteMessage = computed(() =>
  pendingDeleteUsageCount.value > 0
    ? '停用後，這個分類不會再出現在快速紀錄中，但過去的紀錄仍會保留。'
    : `確定刪除「${pendingDeleteCategory.value?.name}」？`,
)

function startCreateCategory(): void {
  editingCategoryId.value = undefined
  categoryName.value = ''
  categoryGroup.value = '攝取'
  categoryColorId.value = DEFAULT_CATEGORY_COLOR_ID
  isQuickAction.value = true
  isCategoryModalOpen.value = true
}

function startEditCategory(category: EventCategory): void {
  editingCategoryId.value = category.id
  categoryName.value = category.name
  categoryGroup.value = category.group ?? '攝取'
  categoryColorId.value = getCategoryColorId(category.colorId)
  isQuickAction.value = category.isQuickAction
  isCategoryModalOpen.value = true
}

function closeCategoryModal(): void {
  isCategoryModalOpen.value = false
  editingCategoryId.value = undefined
  categoryName.value = ''
  categoryGroup.value = '攝取'
  categoryColorId.value = DEFAULT_CATEGORY_COLOR_ID
  isQuickAction.value = true
}

function saveCategory(): void {
  const trimmedName = categoryName.value.trim()

  if (!trimmedName) {
    return
  }

  if (editingCategoryId.value) {
    catTrackerStore.updateCategory(editingCategoryId.value, {
      name: trimmedName,
      group: categoryGroup.value,
      colorId: categoryColorId.value,
      isQuickAction: isQuickAction.value,
    })
  } else {
    catTrackerStore.createCategory({
      name: trimmedName,
      group: categoryGroup.value,
      colorId: categoryColorId.value,
      isQuickAction: isQuickAction.value,
      isArchived: false,
    })
  }

  closeCategoryModal()
}

function deleteCategory(category: EventCategory): void {
  pendingDeleteCategoryId.value = category.id
}

function cancelDeleteCategory(): void {
  pendingDeleteCategoryId.value = undefined
}

function confirmDeleteCategory(): void {
  if (!pendingDeleteCategory.value) {
    return
  }

  const deletedCategoryId = pendingDeleteCategory.value.id

  catTrackerStore.deleteCategory(deletedCategoryId)
  pendingDeleteCategoryId.value = undefined

  if (editingCategoryId.value === deletedCategoryId) {
    closeCategoryModal()
  }
}

function restoreCategory(category: EventCategory): void {
  catTrackerStore.restoreCategory(category.id)
}

function selectCategoryColor(colorId: CategoryColorId): void {
  categoryColorId.value = colorId
}

function startDragCategory(category: EventCategory, event: DragEvent): void {
  if (category.isArchived) {
    return
  }

  draggingCategoryId.value = category.id
  dragTargetCategoryId.value = undefined
  event.dataTransfer?.setData('text/plain', category.id)
  event.dataTransfer?.setDragImage(event.currentTarget as Element, 16, 16)
}

function dragOverCategory(targetCategory: EventCategory, event: DragEvent): void {
  if (!draggingCategoryId.value) {
    clearDropTarget()
    return
  }

  const draggingCategory = catTrackerStore.categoriesById.get(draggingCategoryId.value)
  const targetGroup = targetCategory.group

  if (
    !draggingCategory ||
    draggingCategory.isArchived ||
    !targetGroup ||
    draggingCategory.group !== targetGroup
  ) {
    clearDropTarget()
    return
  }

  if (targetCategory.isArchived) {
    const lastActiveCategory = getActiveCategories(targetGroup).at(-1)

    if (lastActiveCategory) {
      dragTargetCategoryId.value = lastActiveCategory.id
      dragTargetPosition.value = 'after'
    }

    return
  }

  const targetElement = event.currentTarget as HTMLElement
  const targetBounds = targetElement.getBoundingClientRect()
  const isUpperHalf = event.clientY < targetBounds.top + targetBounds.height / 2

  dragTargetCategoryId.value = targetCategory.id
  dragTargetPosition.value = isUpperHalf ? 'before' : 'after'
}

function canDropOnCategory(targetCategory: EventCategory): boolean {
  if (!draggingCategoryId.value || targetCategory.isArchived) {
    return false
  }

  const draggingCategory = catTrackerStore.categoriesById.get(draggingCategoryId.value)

  return Boolean(
    draggingCategory &&
    !draggingCategory.isArchived &&
    draggingCategory.group === targetCategory.group,
  )
}

function dropCategory(targetCategory: EventCategory): void {
  if (!draggingCategoryId.value) {
    clearDragState()
    return
  }

  const targetCategoryId = targetCategory.isArchived
    ? dragTargetCategoryId.value
    : targetCategory.id

  if (!targetCategoryId) {
    clearDragState()
    return
  }

  const dropTargetCategory = catTrackerStore.categoriesById.get(targetCategoryId)

  if (!dropTargetCategory || !canDropOnCategory(dropTargetCategory)) {
    clearDragState()
    return
  }

  catTrackerStore.reorderCategory(
    draggingCategoryId.value,
    targetCategoryId,
    dragTargetPosition.value,
  )
  clearDragState()
}

function dropCategoryAtGroupEnd(group: EventCategoryGroup, categories: EventCategory[]): void {
  if (!draggingCategoryId.value) {
    return
  }

  const draggingCategory = catTrackerStore.categoriesById.get(draggingCategoryId.value)
  const activeCategories = categories.filter((category) => !category.isArchived)
  const lastCategory = activeCategories.at(-1)

  if (
    !draggingCategory ||
    draggingCategory.isArchived ||
    draggingCategory.group !== group ||
    !lastCategory
  ) {
    clearDragState()
    return
  }

  catTrackerStore.reorderCategory(draggingCategory.id, lastCategory.id, 'after')
  clearDragState()
}

function endDragCategory(): void {
  clearDragState()
}

function clearDragState(): void {
  draggingCategoryId.value = undefined
  clearDropTarget()
}

function clearDropTarget(): void {
  dragTargetCategoryId.value = undefined
}

function getActiveCategories(group: EventCategoryGroup): EventCategory[] {
  return (
    categoriesByGroup.value
      .find((categoryGroup) => categoryGroup.group === group)
      ?.categories.filter((category) => !category.isArchived) ?? []
  )
}
</script>

<template>
  <section class="settings-view" aria-labelledby="settings-title">
    <div class="settings-header">
      <div>
        <h1 id="settings-title">設定</h1>
        <p>管理事件分類</p>
      </div>
      <button
        class="ui-button ui-button--primary compact-button"
        type="button"
        @click="startCreateCategory"
      >
        新增分類
      </button>
    </div>

    <div class="category-groups">
      <section
        v-for="group in categoriesByGroup"
        :key="group.group"
        class="category-group"
        :aria-labelledby="`category-group-${group.group}`"
      >
        <h2 :id="`category-group-${group.group}`">{{ group.group }}</h2>

        <ul
          v-if="group.categories.length > 0"
          class="category-list"
          @dragover.prevent
          @drop.self="dropCategoryAtGroupEnd(group.group, group.categories)"
        >
          <li
            v-for="category in group.categories"
            :key="category.id"
            class="category-item"
            :class="{
              'category-item--archived': category.isArchived,
              'category-item--dragging': draggingCategoryId === category.id,
              'category-item--drop-before':
                dragTargetCategoryId === category.id && dragTargetPosition === 'before',
              'category-item--drop-after':
                dragTargetCategoryId === category.id && dragTargetPosition === 'after',
            }"
            @dragover.prevent="dragOverCategory(category, $event)"
            @dragend="endDragCategory"
            @drop="dropCategory(category)"
          >
            <span
              v-if="!category.isArchived"
              class="drag-handle"
              draggable="true"
              aria-label="拖曳排序"
              title="拖曳排序"
              @dragstart="startDragCategory(category, $event)"
            >
              ⋮⋮
            </span>
            <span
              class="category-color"
              :style="{ '--category-color': getCategoryColorValue(category) }"
              aria-hidden="true"
            ></span>
            <div class="category-item__content">
              <strong>{{ category.name }}</strong>
              <span v-if="category.isArchived">
                已停用 · 過去紀錄仍會保留 ·
                {{ catTrackerStore.getCategoryUsageCount(category.id) }} 筆紀錄
              </span>
              <span v-else>
                <template v-if="!category.isQuickAction">未顯示於快速紀錄 · </template>
                {{ catTrackerStore.getCategoryUsageCount(category.id) }} 筆紀錄
              </span>
            </div>
            <div v-if="category.isArchived" class="category-item__actions">
              <button
                class="ui-button ui-button--primary compact-button"
                type="button"
                @click="restoreCategory(category)"
              >
                重新使用
              </button>
            </div>
            <div v-else class="category-item__actions">
              <button
                class="ui-button ui-button--secondary compact-button"
                type="button"
                @click="startEditCategory(category)"
              >
                編輯
              </button>
              <button
                class="ui-button ui-button--danger compact-button"
                type="button"
                @click="deleteCategory(category)"
              >
                {{ catTrackerStore.getCategoryUsageCount(category.id) > 0 ? '停用' : '刪除' }}
              </button>
            </div>
          </li>
        </ul>

        <p v-else class="empty-group">尚無分類</p>
      </section>
    </div>

    <div
      v-if="isCategoryModalOpen"
      class="category-modal-backdrop"
      role="presentation"
      @click.self="closeCategoryModal"
    >
      <section
        class="category-modal"
        aria-labelledby="category-modal-title"
        role="dialog"
        aria-modal="true"
      >
        <form class="category-form" @submit.prevent="saveCategory">
          <div class="category-form__header">
            <h2 id="category-modal-title">{{ formTitle }}</h2>
            <button
              class="ui-button ui-button--icon modal-close"
              type="button"
              aria-label="關閉分類視窗"
              @click="closeCategoryModal"
            >
              ×
            </button>
          </div>

          <label class="field">
            <span class="field__label">名稱</span>
            <input v-model="categoryName" class="field__control" type="text" required />
          </label>

          <label class="field">
            <span class="field__label">群組</span>
            <select v-model="categoryGroup" class="field__control">
              <option v-for="group in CATEGORY_GROUP_ORDER" :key="group" :value="group">
                {{ group }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">顏色</span>
            <div class="color-palette" role="radiogroup" aria-label="分類顏色">
              <button
                v-for="colorOption in CATEGORY_COLOR_OPTIONS"
                :key="colorOption.id"
                class="color-swatch"
                :class="{ 'color-swatch--selected': categoryColorId === colorOption.id }"
                :style="{
                  '--swatch-color': colorOption.value,
                  '--swatch-background': colorOption.background,
                  '--swatch-border': colorOption.border,
                }"
                type="button"
                role="radio"
                :aria-checked="categoryColorId === colorOption.id"
                :aria-label="colorOption.label"
                :title="colorOption.label"
                @click="selectCategoryColor(colorOption.id)"
              >
                <span class="color-swatch__dot" aria-hidden="true"></span>
              </button>
            </div>
          </label>

          <label class="toggle-field">
            <input v-model="isQuickAction" type="checkbox" />
            <span>顯示在快速紀錄</span>
          </label>

          <div class="category-form__actions">
            <button
              class="ui-button ui-button--secondary save-button"
              type="button"
              @click="closeCategoryModal"
            >
              取消
            </button>
            <button class="ui-button ui-button--primary save-button" type="submit">
              {{ isEditing ? '儲存分類' : '新增分類' }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <ConfirmDialog
      v-if="pendingDeleteCategory"
      :title="`${deleteActionLabel}分類？`"
      :message="deleteMessage"
      :confirm-label="deleteActionLabel"
      cancel-label="保留"
      tone="danger"
      @cancel="cancelDeleteCategory"
      @confirm="confirmDeleteCategory"
    />
  </section>
</template>

<style scoped>
.settings-view {
  width: var(--content-width);
  margin: 0 auto;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.settings-header h1,
.settings-header p,
.category-form h2,
.category-group h2,
.empty-group {
  margin: 0;
}

.settings-header h1 {
  font-size: 1.4rem;
}

.settings-header p,
.category-item__content span,
.empty-group {
  color: var(--color-muted);
}

.category-group {
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.category-form {
  display: grid;
  gap: 12px;
}

.category-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.category-form h2,
.category-group h2 {
  font-size: 1.05rem;
}

.field {
  display: grid;
  gap: 6px;
}

.field__label {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 700;
}

.field__control {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--color-surface);
  color: var(--color-text);
}

.toggle-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-weight: 700;
}

.color-palette {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.color-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  cursor: pointer;
}

.color-swatch:hover {
  border-color: var(--swatch-border);
  background: var(--swatch-background);
}

.color-swatch--selected {
  border-color: var(--swatch-color);
  background: var(--swatch-background);
}

.color-swatch__dot {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--swatch-color);
}

.save-button {
  min-height: 44px;
}

.category-form__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.category-groups {
  display: grid;
  gap: 12px;
}

.category-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  list-style: none;
}

.category-item {
  display: grid;
  grid-template-columns: 18px 14px 1fr auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.category-item--dragging {
  opacity: 0.55;
}

.category-item--drop-before,
.category-item--drop-after {
  position: relative;
}

.category-item--drop-before::before,
.category-item--drop-after::after {
  position: absolute;
  left: 8px;
  right: 8px;
  z-index: 1;
  height: 3px;
  border-radius: 999px;
  background: var(--color-primary);
  content: '';
}

.category-item--drop-before::before {
  top: -6px;
}

.category-item--drop-after::after {
  bottom: -6px;
}

.drag-handle {
  color: var(--color-muted);
  cursor: grab;
  font-size: 0.875rem;
  letter-spacing: -0.18em;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.category-item--archived {
  grid-template-columns: 14px 1fr auto;
  border-style: dashed;
  background: var(--color-disabled-surface);
}

.category-item--archived .category-color {
  opacity: 0.45;
}

.category-item--archived strong {
  color: var(--color-muted);
}

.category-color {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--category-color);
}

.category-item__content {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.category-item__actions {
  display: flex;
  gap: 8px;
}

.compact-button {
  min-height: 34px;
  padding: 0 10px;
  font-size: 0.875rem;
}

.ui-button--primary {
  --button-color: var(--color-primary);
  --button-hover-color: var(--color-primary-dark);
}

.empty-group {
  padding-top: 10px;
}

.category-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--overlay-color);
}

.category-modal {
  width: min(100%, 520px);
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 22px 60px var(--shadow-color);
}

.modal-close {
  width: 36px;
  height: 36px;
  font-size: 1.35rem;
  line-height: 1;
}

@media (max-width: 560px) {
  .category-item {
    grid-template-columns: 18px 14px 1fr;
  }

  .category-item--archived {
    grid-template-columns: 14px 1fr;
  }

  .category-item__actions {
    grid-column: 3;
  }

  .category-item--archived .category-item__actions {
    grid-column: 2;
  }

  .category-modal-backdrop {
    padding: 10px;
  }

  .category-modal {
    padding: 16px;
  }
}
</style>
