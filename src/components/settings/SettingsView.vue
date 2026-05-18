<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { CATEGORY_GROUP_ORDER } from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory, EventCategoryGroup } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { categoriesByGroup } = storeToRefs(catTrackerStore)

const editingCategoryId = ref<string>()
const categoryName = ref('')
const categoryGroup = ref<EventCategoryGroup>('攝取')
const categoryColor = ref('#557563')
const isQuickAction = ref(true)
const pendingDeleteCategoryId = ref<string>()

const isEditing = computed(() => Boolean(editingCategoryId.value))
const formTitle = computed(() => (isEditing.value ? '編輯分類' : '新增分類'))
const pendingDeleteCategory = computed(() =>
  pendingDeleteCategoryId.value
    ? catTrackerStore.categoriesById.get(pendingDeleteCategoryId.value)
    : undefined,
)
const pendingDeleteUsageCount = computed(() =>
  pendingDeleteCategory.value ? catTrackerStore.getCategoryUsageCount(pendingDeleteCategory.value.id) : 0,
)
const deleteMessage = computed(() =>
  pendingDeleteUsageCount.value > 0
    ? `刪除「${pendingDeleteCategory.value?.name}」後，${pendingDeleteUsageCount.value} 筆既有紀錄會顯示為未分類。`
    : `確定刪除「${pendingDeleteCategory.value?.name}」？`,
)

function startCreateCategory(): void {
  editingCategoryId.value = undefined
  categoryName.value = ''
  categoryGroup.value = '攝取'
  categoryColor.value = '#557563'
  isQuickAction.value = true
}

function startEditCategory(category: EventCategory): void {
  editingCategoryId.value = category.id
  categoryName.value = category.name
  categoryGroup.value = category.group ?? '攝取'
  categoryColor.value = category.color ?? '#557563'
  isQuickAction.value = category.isQuickAction
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
      color: categoryColor.value,
      isQuickAction: isQuickAction.value,
    })
  } else {
    catTrackerStore.createCategory({
      name: trimmedName,
      group: categoryGroup.value,
      color: categoryColor.value,
      isQuickAction: isQuickAction.value,
    })
  }

  startCreateCategory()
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
    startCreateCategory()
  }
}
</script>

<template>
  <section class="settings-view" aria-labelledby="settings-title">
    <div class="settings-header">
      <div>
        <h1 id="settings-title">設定</h1>
        <p>管理事件分類</p>
      </div>
    </div>

    <form class="category-form" @submit.prevent="saveCategory">
      <div class="category-form__header">
        <h2>{{ formTitle }}</h2>
        <button
          v-if="isEditing"
          class="ui-button ui-button--secondary compact-button"
          type="button"
          @click="startCreateCategory"
        >
          取消編輯
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
        <input v-model="categoryColor" class="field__control field__control--color" type="color" />
      </label>

      <label class="toggle-field">
        <input v-model="isQuickAction" type="checkbox" />
        <span>顯示在快速紀錄</span>
      </label>

      <button class="ui-button ui-button--primary save-button" type="submit">
        {{ isEditing ? '儲存分類' : '新增分類' }}
      </button>
    </form>

    <div class="category-groups">
      <section
        v-for="group in categoriesByGroup"
        :key="group.group"
        class="category-group"
        :aria-labelledby="`category-group-${group.group}`"
      >
        <h2 :id="`category-group-${group.group}`">{{ group.group }}</h2>

        <ul v-if="group.categories.length > 0" class="category-list">
          <li v-for="category in group.categories" :key="category.id" class="category-item">
            <span
              class="category-color"
              :style="{ '--category-color': category.color ?? '#65736a' }"
              aria-hidden="true"
            ></span>
            <div class="category-item__content">
              <strong>{{ category.name }}</strong>
              <span>
                {{ category.isQuickAction ? '快速紀錄' : '未顯示於快速紀錄' }}
                · {{ catTrackerStore.getCategoryUsageCount(category.id) }} 筆紀錄
              </span>
            </div>
            <div class="category-item__actions">
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
                刪除
              </button>
            </div>
          </li>
        </ul>

        <p v-else class="empty-group">尚無分類</p>
      </section>
    </div>

    <ConfirmDialog
      v-if="pendingDeleteCategory"
      title="刪除分類？"
      :message="deleteMessage"
      confirm-label="刪除"
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
  color: #65736a;
}

.category-form,
.category-group {
  padding: 14px;
  border: 1px solid #d8e0d8;
  border-radius: 10px;
  background: #ffffff;
}

.category-form {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
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
  color: #34423a;
  font-size: 0.875rem;
  font-weight: 700;
}

.field__control {
  width: 100%;
  min-height: 40px;
  border: 1px solid #cbd8cf;
  border-radius: 8px;
  padding: 8px 10px;
  background: #ffffff;
  color: #17201b;
}

.field__control--color {
  padding: 4px;
}

.toggle-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #34423a;
  font-weight: 700;
}

.save-button {
  min-height: 44px;
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
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #e0e7e1;
  border-radius: 8px;
  background: #f8faf7;
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

.empty-group {
  padding-top: 10px;
}

@media (max-width: 560px) {
  .category-item {
    grid-template-columns: 14px 1fr;
  }

  .category-item__actions {
    grid-column: 2;
  }
}
</style>
