<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  CAT_AVATAR_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_GROUP_ORDER,
  DEFAULT_CAT_AVATAR_ID,
  DEFAULT_CATEGORY_COLOR_ID,
  getCatAvatarOption,
  getCategoryColorId,
  getCategoryColorValue,
} from '@/constants/defaultData'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { useTheme } from '@/composables/useTheme'
import {
  importLocalCatTracker,
  type ImportLocalCatTrackerResult,
} from '@/services/importLocalCatTracker'
import { useCatTrackerStore } from '@/stores/catTracker'
import type {
  Cat,
  CatAvatarId,
  CatSex,
  CategoryColorId,
  EventCategory,
  EventCategoryGroup,
} from '@/types'

const catTrackerStore = useCatTrackerStore()
const { categories, categoriesByGroup, cats, events, selectedCatId } = storeToRefs(catTrackerStore)
const { isDarkMode, toggleDarkMode } = useTheme()
const {
  activeNotebookId,
  errorMessage,
  initializeAuth,
  isConfigured,
  isLoading,
  isSignedIn,
  magicLinkSentTo,
  signInWithEmail,
  signOut,
  user,
} = useRemoteAuth()

type SettingsSection = 'account' | 'categories' | 'pets'

const settingsSection = ref<SettingsSection>('categories')
const signInEmail = ref('')
const isImportingLocalData = ref(false)
const importResult = ref<ImportLocalCatTrackerResult>()
const importErrorMessage = ref('')
const editingCategoryId = ref<string>()
const categoryName = ref('')
const categoryGroup = ref<EventCategoryGroup>('飲食')
const categoryColorId = ref<CategoryColorId>(DEFAULT_CATEGORY_COLOR_ID)
const isQuickAction = ref(true)
const isCategoryModalOpen = ref(false)
const draggingCategoryId = ref<string>()
const dragTargetCategoryId = ref<string>()
const dragTargetPosition = ref<'before' | 'after'>('before')
const pendingDeleteCategoryId = ref<string>()
const editingCatId = ref<string>()
const catName = ref('')
const catBirthday = ref('')
const catSex = ref<CatSex | ''>('')
const catWeightKg = ref<string | number>('')
const catAvatarId = ref<CatAvatarId>(DEFAULT_CAT_AVATAR_ID)
const catIsNeutered = ref<'yes' | 'no' | ''>('')
const catNote = ref('')
const isCatModalOpen = ref(false)

const isEditing = computed(() => Boolean(editingCategoryId.value))
const formTitle = computed(() => (isEditing.value ? '編輯分類' : '新增分類'))
const isEditingCat = computed(() => Boolean(editingCatId.value))
const catFormTitle = computed(() => (isEditingCat.value ? '編輯寵物' : '新增寵物'))
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
const settingsSubtitle = computed(() => {
  if (settingsSection.value === 'account') {
    return '管理帳戶與同步'
  }

  return settingsSection.value === 'categories' ? '管理事件分類' : '管理寵物資料'
})
const localImportSummary = computed(
  () =>
    `${cats.value.length} 隻寵物、${categories.value.length} 個分類、${events.value.length} 筆紀錄`,
)
const deleteMessage = computed(() =>
  pendingDeleteUsageCount.value > 0
    ? '停用後，這個分類不會再出現在快速紀錄中，但過去的紀錄仍會保留。'
    : `確定刪除「${pendingDeleteCategory.value?.name}」？`,
)

onMounted(() => {
  void initializeAuth()
})

function startCreateCategory(): void {
  editingCategoryId.value = undefined
  categoryName.value = ''
  categoryGroup.value = '飲食'
  categoryColorId.value = DEFAULT_CATEGORY_COLOR_ID
  isQuickAction.value = true
  isCategoryModalOpen.value = true
}

function startEditCategory(category: EventCategory): void {
  editingCategoryId.value = category.id
  categoryName.value = category.name
  categoryGroup.value = category.group ?? '飲食'
  categoryColorId.value = getCategoryColorId(category.colorId)
  isQuickAction.value = category.isQuickAction
  isCategoryModalOpen.value = true
}

function closeCategoryModal(): void {
  isCategoryModalOpen.value = false
  editingCategoryId.value = undefined
  categoryName.value = ''
  categoryGroup.value = '飲食'
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

function switchSettingsSection(section: SettingsSection): void {
  settingsSection.value = section
}

function startCreatePrimaryItem(): void {
  if (settingsSection.value === 'account') {
    return
  }

  if (settingsSection.value === 'pets') {
    startCreateCat()
    return
  }

  startCreateCategory()
}

function selectCategoryColor(colorId: CategoryColorId): void {
  categoryColorId.value = colorId
}

function startCreateCat(): void {
  editingCatId.value = undefined
  catName.value = ''
  catBirthday.value = ''
  catSex.value = ''
  catWeightKg.value = ''
  catAvatarId.value = DEFAULT_CAT_AVATAR_ID
  catIsNeutered.value = ''
  catNote.value = ''
  isCatModalOpen.value = true
}

function startEditCat(cat: Cat): void {
  editingCatId.value = cat.id
  catName.value = cat.name
  catBirthday.value = cat.birthday ?? ''
  catSex.value = cat.sex ?? ''
  catWeightKg.value = typeof cat.weightKg === 'number' ? String(cat.weightKg) : ''
  catAvatarId.value = getCatAvatarOption(cat.avatarId).id
  catIsNeutered.value = typeof cat.isNeutered === 'boolean' ? (cat.isNeutered ? 'yes' : 'no') : ''
  catNote.value = cat.note ?? ''
  isCatModalOpen.value = true
}

function closeCatModal(): void {
  isCatModalOpen.value = false
  editingCatId.value = undefined
  catName.value = ''
  catBirthday.value = ''
  catSex.value = ''
  catWeightKg.value = ''
  catAvatarId.value = DEFAULT_CAT_AVATAR_ID
  catIsNeutered.value = ''
  catNote.value = ''
}

function saveCat(): void {
  const trimmedName = catName.value.trim()

  if (!trimmedName) {
    return
  }

  const trimmedWeight = String(catWeightKg.value).trim()
  const weightKg = trimmedWeight ? Number(trimmedWeight) : undefined
  const input = {
    name: trimmedName,
    birthday: catBirthday.value || undefined,
    sex: catSex.value || undefined,
    weightKg: Number.isFinite(weightKg) ? weightKg : undefined,
    avatarId: catAvatarId.value,
    isNeutered: catIsNeutered.value === '' ? undefined : catIsNeutered.value === 'yes',
    note: catNote.value.trim() || undefined,
  }

  if (editingCatId.value) {
    catTrackerStore.updateCat(editingCatId.value, input)
  } else {
    catTrackerStore.createCat(input)
  }

  closeCatModal()
}

function selectCatAvatar(avatarId: CatAvatarId): void {
  catAvatarId.value = avatarId
}

function getCatMeta(cat: Cat): string {
  return [
    getCatAgeText(cat.birthday),
    getCatSexText(cat.sex),
    typeof cat.weightKg === 'number' ? `${cat.weightKg} kg` : '',
    typeof cat.isNeutered === 'boolean' ? (cat.isNeutered ? '已絕育' : '未絕育') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function getCatAgeText(birthday?: string): string {
  if (!birthday) {
    return ''
  }

  const birthDate = new Date(`${birthday}T00:00:00`)

  if (Number.isNaN(birthDate.getTime())) {
    return ''
  }

  const today = new Date()
  let years = today.getFullYear() - birthDate.getFullYear()
  let months = today.getMonth() - birthDate.getMonth()

  if (today.getDate() < birthDate.getDate()) {
    months -= 1
  }

  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years <= 0 && months <= 0) {
    return '未滿 1 個月'
  }

  if (years <= 0) {
    return `${months} 個月`
  }

  return months > 0 ? `${years} 歲 ${months} 個月` : `${years} 歲`
}

function getCatSexText(sex?: CatSex): string {
  if (sex === 'male') {
    return '男生'
  }

  if (sex === 'female') {
    return '女生'
  }

  return ''
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

function submitSignIn(): void {
  void signInWithEmail(signInEmail.value)
}

function submitSignOut(): void {
  void signOut()
}

async function submitImportLocalData(): Promise<void> {
  if (!activeNotebookId.value || !user.value) {
    importErrorMessage.value = 'Notebook 尚未建立完成'
    return
  }

  isImportingLocalData.value = true
  importResult.value = undefined
  importErrorMessage.value = ''

  try {
    importResult.value = await importLocalCatTracker({
      notebookId: activeNotebookId.value,
      cats: cats.value,
      categories: categories.value,
      events: events.value,
      createdBy: user.value.id,
    })
  } catch (error) {
    importErrorMessage.value = error instanceof Error ? error.message : '匯入本機資料失敗'
  } finally {
    isImportingLocalData.value = false
  }
}
</script>

<template>
  <section class="settings-view" aria-labelledby="settings-title">
    <div class="settings-topbar">
      <div class="settings-header">
        <div>
          <h1 id="settings-title">設定</h1>
          <p>{{ settingsSubtitle }}</p>
        </div>
        <div class="settings-actions">
          <button
            class="ui-button ui-button--secondary ui-button--icon compact-button theme-toggle"
            type="button"
            :aria-label="isDarkMode ? '切換為淺色模式' : '切換為深色模式'"
            :aria-pressed="isDarkMode"
            :title="isDarkMode ? '淺色模式' : '深色模式'"
            @click="toggleDarkMode"
          >
            <span aria-hidden="true">{{ isDarkMode ? '☀' : '☾' }}</span>
          </button>
          <button
            v-if="settingsSection !== 'account'"
            class="ui-button ui-button--primary compact-button"
            type="button"
            @click="startCreatePrimaryItem"
          >
            {{ settingsSection === 'categories' ? '新增分類' : '新增寵物' }}
          </button>
        </div>
      </div>

      <div class="settings-tabs" role="tablist" aria-label="設定分類">
        <button
          class="ui-button settings-tab"
          :class="settingsSection === 'account' ? 'ui-button--primary' : 'ui-button--secondary'"
          type="button"
          role="tab"
          :aria-selected="settingsSection === 'account'"
          @click="switchSettingsSection('account')"
        >
          帳戶
        </button>
        <button
          class="ui-button settings-tab"
          :class="settingsSection === 'categories' ? 'ui-button--primary' : 'ui-button--secondary'"
          type="button"
          role="tab"
          :aria-selected="settingsSection === 'categories'"
          @click="switchSettingsSection('categories')"
        >
          事件分類
        </button>
        <button
          class="ui-button settings-tab"
          :class="settingsSection === 'pets' ? 'ui-button--primary' : 'ui-button--secondary'"
          type="button"
          role="tab"
          :aria-selected="settingsSection === 'pets'"
          @click="switchSettingsSection('pets')"
        >
          寵物管理
        </button>
      </div>
    </div>

    <div class="settings-content">
      <section
        v-if="settingsSection === 'account'"
        class="account-panel"
        aria-labelledby="account-title"
      >
        <div class="account-panel__header">
          <h2 id="account-title">同步帳戶</h2>
          <span v-if="isSignedIn" class="account-badge">已登入</span>
          <span v-else class="account-badge account-badge--muted">未登入</span>
        </div>

        <p v-if="!isConfigured" class="account-message">
          Supabase 尚未設定，請確認 `.env.local` 已填入專案 URL 和 anon key。
        </p>

        <template v-else-if="isSignedIn">
          <div class="account-details">
            <span>Email</span>
            <strong>{{ user?.email }}</strong>
            <span>Notebook</span>
            <strong>{{ activeNotebookId || '建立中' }}</strong>
            <span>本機資料</span>
            <strong>{{ localImportSummary }}</strong>
          </div>

          <button
            class="ui-button ui-button--primary account-button"
            type="button"
            :disabled="isLoading || isImportingLocalData || !activeNotebookId"
            @click="submitImportLocalData"
          >
            {{ isImportingLocalData ? '匯入中' : '匯入本機資料' }}
          </button>

          <p v-if="importResult" class="account-message">
            已匯入 {{ importResult.catsImported }} 隻寵物、{{
              importResult.categoriesImported
            }}
            個分類、{{ importResult.eventsImported }} 筆紀錄。
            <template v-if="importResult.eventsSkipped > 0">
              有 {{ importResult.eventsSkipped }} 筆紀錄因找不到寵物或分類而略過。
            </template>
          </p>
          <p v-if="importErrorMessage" class="account-message account-message--error">
            {{ importErrorMessage }}
          </p>

          <button
            class="ui-button ui-button--secondary account-button"
            type="button"
            :disabled="isLoading"
            @click="submitSignOut"
          >
            登出
          </button>
        </template>

        <form v-else class="account-form" @submit.prevent="submitSignIn">
          <label class="field">
            <span class="field__label">Email</span>
            <input
              v-model="signInEmail"
              class="field__control"
              type="email"
              autocomplete="email"
              inputmode="email"
              required
            />
          </label>
          <button
            class="ui-button ui-button--primary account-button"
            type="submit"
            :disabled="isLoading"
          >
            {{ isLoading ? '寄送中' : '寄送登入連結' }}
          </button>
        </form>

        <p v-if="magicLinkSentTo" class="account-message">登入連結已寄到 {{ magicLinkSentTo }}。</p>
        <p v-if="errorMessage" class="account-message account-message--error">
          {{ errorMessage }}
        </p>
      </section>

      <div v-else-if="settingsSection === 'categories'" class="category-groups">
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

      <div v-else class="pet-list">
        <article
          v-for="cat in cats"
          :key="cat.id"
          class="pet-item"
          :class="{ 'pet-item--selected': selectedCatId === cat.id }"
        >
          <div class="pet-avatar" aria-hidden="true">
            <img
              :src="getCatAvatarOption(cat.avatarId).image"
              :alt="getCatAvatarOption(cat.avatarId).label"
            />
          </div>
          <div class="pet-item__content">
            <strong>{{ cat.name }}</strong>
            <span v-if="getCatMeta(cat)">{{ getCatMeta(cat) }}</span>
            <span v-else>尚未填寫詳細資料</span>
            <p v-if="cat.note">{{ cat.note }}</p>
          </div>
          <div class="pet-item__actions">
            <button
              class="ui-button ui-button--secondary compact-button"
              type="button"
              :disabled="selectedCatId === cat.id"
              @click="catTrackerStore.selectCat(cat.id)"
            >
              {{ selectedCatId === cat.id ? '使用中' : '切換' }}
            </button>
            <button
              class="ui-button ui-button--secondary compact-button"
              type="button"
              @click="startEditCat(cat)"
            >
              編輯
            </button>
          </div>
        </article>
      </div>
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

    <div
      v-if="isCatModalOpen"
      class="category-modal-backdrop"
      role="presentation"
      @click.self="closeCatModal"
    >
      <section
        class="category-modal cat-modal"
        aria-labelledby="cat-modal-title"
        role="dialog"
        aria-modal="true"
      >
        <form class="category-form cat-form" @submit.prevent="saveCat">
          <div class="category-form__header">
            <h2 id="cat-modal-title">{{ catFormTitle }}</h2>
            <button
              class="ui-button ui-button--icon modal-close"
              type="button"
              aria-label="關閉寵物視窗"
              @click="closeCatModal"
            >
              ×
            </button>
          </div>

          <div class="cat-form__body">
            <label class="field">
              <span class="field__label">名字</span>
              <input v-model="catName" class="field__control" type="text" required />
            </label>

            <label class="field">
              <span class="field__label">生日</span>
              <input v-model="catBirthday" class="field__control" type="date" />
            </label>

            <label class="field">
              <span class="field__label">性別</span>
              <select v-model="catSex" class="field__control">
                <option value="">未設定</option>
                <option value="male">男生</option>
                <option value="female">女生</option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">體重 kg</span>
              <input
                v-model="catWeightKg"
                class="field__control"
                type="number"
                min="0"
                step="0.1"
              />
            </label>

            <div class="field">
              <span class="field__label">頭貼</span>
              <div class="cat-avatar-options" role="radiogroup" aria-label="寵物頭貼">
                <button
                  v-for="avatar in CAT_AVATAR_OPTIONS"
                  :key="avatar.id"
                  class="cat-avatar-option"
                  :class="{ 'cat-avatar-option--selected': catAvatarId === avatar.id }"
                  type="button"
                  role="radio"
                  :aria-checked="catAvatarId === avatar.id"
                  :aria-label="avatar.label"
                  :title="avatar.label"
                  @click="selectCatAvatar(avatar.id)"
                >
                  <span class="pet-avatar pet-avatar--option" aria-hidden="true">
                    <img :src="avatar.image" :alt="avatar.label" />
                  </span>
                  <span>{{ avatar.label }}</span>
                </button>
              </div>
            </div>

            <label class="field">
              <span class="field__label">絕育狀態</span>
              <select v-model="catIsNeutered" class="field__control">
                <option value="">未設定</option>
                <option value="yes">已絕育</option>
                <option value="no">未絕育</option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">備註</span>
              <textarea v-model="catNote" class="field__control pet-note" rows="4"></textarea>
            </label>
          </div>

          <div class="category-form__actions cat-form__actions">
            <button
              class="ui-button ui-button--secondary save-button"
              type="button"
              @click="closeCatModal"
            >
              取消
            </button>
            <button class="ui-button ui-button--primary save-button" type="submit">
              {{ isEditingCat ? '儲存寵物' : '新增寵物' }}
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

.settings-topbar {
  flex: 0 0 auto;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.settings-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.settings-header h1,
.settings-header p,
.account-panel h2,
.category-form h2,
.category-group h2,
.empty-group {
  margin: 0;
}

.settings-header h1 {
  font-size: 1.4rem;
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.settings-tab {
  min-height: 38px;
}

.settings-content {
  min-height: 0;
}

.settings-header p,
.account-details span,
.account-message,
.category-item__content span,
.pet-item__content span,
.empty-group {
  color: var(--color-muted);
}

.account-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.account-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.account-panel h2 {
  font-size: 1.05rem;
}

.account-badge {
  padding: 4px 8px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 36%, var(--color-border));
  border-radius: 999px;
  background: var(--color-primary-light);
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 700;
}

.account-badge--muted {
  border-color: var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
}

.account-form {
  display: grid;
  gap: 12px;
}

.account-button {
  min-height: 42px;
}

.account-details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 12px;
  min-width: 0;
}

.account-details strong {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-message {
  margin: 0;
  font-size: 0.875rem;
}

.account-message--error {
  color: var(--color-danger);
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

.pet-note {
  min-height: 96px;
  resize: vertical;
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

.pet-list {
  display: grid;
  gap: 10px;
}

.pet-item {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.pet-item--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.pet-avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 3px;
  background: var(--color-background);
}

.pet-avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cat-avatar-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.cat-avatar-option {
  display: grid;
  gap: 6px;
  min-width: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 4px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
}

.cat-avatar-option:hover,
.cat-avatar-option--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.pet-avatar--option {
  width: 36px;
  height: 36px;
  font-size: 0.875rem;
}

.pet-item__content {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.pet-item__content strong,
.pet-item__content span,
.pet-item__content p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pet-item__content p {
  margin: 0;
  color: var(--color-text);
  font-size: 0.875rem;
}

.pet-item__actions {
  display: flex;
  gap: 8px;
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

.theme-toggle {
  width: 34px;
  min-width: 34px;
  padding: 0;
  font-size: 1.05rem;
  line-height: 1;
}

.compact-button:disabled {
  cursor: default;
  opacity: 0.68;
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

.cat-modal {
  display: flex;
  max-height: 75vh;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior: contain;
}

.cat-form {
  min-height: 0;
}

.cat-form__body {
  display: grid;
  min-height: 0;
  gap: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.cat-form__actions {
  padding-top: 12px;
  border-top: 1px solid var(--color-divider);
  background: var(--color-surface);
}

.modal-close {
  width: 36px;
  height: 36px;
  font-size: 1.35rem;
  line-height: 1;
}

@media (max-width: 560px) {
  .settings-view {
    display: flex;
    height: calc(100vh - 88px);
    height: calc(100dvh - 88px);
    flex-direction: column;
    overflow: hidden;
  }

  .settings-topbar {
    position: sticky;
    top: 0;
    z-index: 2;
    padding-bottom: 12px;
    background: var(--color-background);
  }

  .settings-header {
    margin-bottom: 12px;
  }

  .settings-actions {
    flex: 0 0 auto;
    flex-direction: row;
    align-items: stretch;
  }

  .settings-actions .compact-button {
    min-width: 0;
    padding: 0 8px;
    white-space: nowrap;
  }

  .theme-toggle {
    width: 34px;
    min-width: 34px;
  }

  .settings-tabs {
    margin-bottom: 0;
  }

  .settings-content {
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 12px;
    -webkit-overflow-scrolling: touch;
  }

  .pet-item {
    grid-template-columns: 44px 1fr;
  }

  .pet-item__actions {
    grid-column: 2;
  }

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
