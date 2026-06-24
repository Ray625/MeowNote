<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DogAvatarToggle from '@/components/common/DogAvatarToggle.vue'
import FixedModal from '@/components/common/FixedModal.vue'
import FixedSelect from '@/components/common/FixedSelect.vue'
import {
  CAT_AVATAR_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_GROUP_ORDER,
  CATEGORY_TEMPLATES,
  DEFAULT_CAT_AVATAR_ID,
  DEFAULT_CATEGORY_COLOR_ID,
  DOG_AVATAR_OPTIONS,
  getCatAvatarOption,
  getCategoryColorId,
  getCategoryColorValue,
  isDogAvatarId,
  type CategoryTemplate,
} from '@/constants/defaultData'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useDogAvatarPreference } from '@/composables/useDogAvatarPreference'
import { useTheme } from '@/composables/useTheme'
import { useCatTrackerStore } from '@/stores/catTracker'
import type {
  Cat,
  CatAvatarId,
  CatSex,
  CategoryStatisticsMode,
  CategoryColorId,
  EventCategory,
  EventCategoryGroup,
} from '@/types'
const catTrackerStore = useCatTrackerStore()
const { categories, categoriesByGroup, cats, selectedCatId } = storeToRefs(catTrackerStore)
const { isDarkMode, toggleDarkMode } = useTheme()
const { activeNotebookId, activeNotebookRole, initializeAuth, isSignedIn } = useRemoteAuth()
const { isDogAvatarMode, setDogAvatarMode: setStoredDogAvatarMode } = useDogAvatarPreference()

type SettingsSection = 'categories' | 'pets'
type SelectOption = { value: string; label: string }

const settingsSection = ref<SettingsSection>('categories')
const editingCategoryId = ref<string>()
const categoryName = ref('')
const categoryGroup = ref<EventCategoryGroup>('飲食')
const categoryColorId = ref<CategoryColorId>(DEFAULT_CATEGORY_COLOR_ID)
const categoryStatisticsMode = ref<CategoryStatisticsMode>('count')
const categoryValueLabel = ref('')
const categoryValueUnit = ref('')
const isQuickAction = ref(true)
const isCategoryModalOpen = ref(false)
const isStatisticsHelpOpen = ref(false)
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
const pendingDeleteCatId = ref<string>()
const viewingCatId = ref<string>()

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
const pendingDeleteCat = computed(() =>
  pendingDeleteCatId.value ? catTrackerStore.catsById.get(pendingDeleteCatId.value) : undefined,
)
const viewingCat = computed(() =>
  viewingCatId.value ? catTrackerStore.catsById.get(viewingCatId.value) : undefined,
)
const pendingDeleteCatUsageCount = computed(() =>
  pendingDeleteCat.value ? catTrackerStore.getCatUsageCount(pendingDeleteCat.value.id) : 0,
)
const deleteCatActionLabel = computed(() =>
  pendingDeleteCatUsageCount.value > 0 ? '停用' : '刪除',
)
const visibleCatAvatarOptions = computed(() =>
  isDogAvatarMode.value ? DOG_AVATAR_OPTIONS : CAT_AVATAR_OPTIONS,
)
const settingsSubtitle = computed(() => {
  return settingsSection.value === 'categories' ? '管理事件分類' : '管理寵物資料'
})
const canManageNotebookData = computed(
  () =>
    !activeNotebookId.value ||
    !isSignedIn.value ||
    !activeNotebookRole.value ||
    activeNotebookRole.value === 'owner',
)
const deleteMessage = computed(() =>
  pendingDeleteUsageCount.value > 0
    ? '停用後，這個分類不會再出現在快速紀錄中，但過去的紀錄仍會保留。'
    : `確定刪除「${pendingDeleteCategory.value?.name}」？`,
)
const deleteCatMessage = computed(() =>
  pendingDeleteCatUsageCount.value > 0
    ? '停用後，這隻寵物不會再出現在切換選單中，但過去的紀錄仍會保留。'
    : `確定刪除「${pendingDeleteCat.value?.name}」？`,
)
const readOnlySettingsMessage = computed(() =>
  settingsSection.value === 'categories'
    ? '共享成員可以使用既有分類新增紀錄，分類設定由筆記簿擁有者管理。'
    : '共享成員可以查看寵物資料，寵物設定由筆記簿擁有者管理。',
)
const isSettingsModalOpen = computed(
  () =>
    isCategoryModalOpen.value ||
    isCatModalOpen.value ||
    Boolean(viewingCat.value) ||
    isStatisticsHelpOpen.value,
)
const categoryGroupOptions = computed<SelectOption[]>(() =>
  CATEGORY_GROUP_ORDER.map((group) => ({
    value: group,
    label: group,
  })),
)
const categoryStatisticsModeOptions: SelectOption[] = [
  { value: 'count', label: '發生次數' },
  { value: 'sum', label: '累積數量' },
  { value: 'measurement', label: '量測紀錄' },
  { value: 'rating', label: '狀態評分' },
]
const catSexOptions: SelectOption[] = [
  { value: '', label: '未設定' },
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' },
]
const catIsNeuteredOptions: SelectOption[] = [
  { value: '', label: '未設定' },
  { value: 'yes', label: '已絕育' },
  { value: 'no', label: '未絕育' },
]
const availableCategoryTemplates = computed(() => {
  const existingTemplateIds = new Set(
    categories.value.map((category) => category.templateId).filter(Boolean),
  )
  const existingNames = new Set(categories.value.map((category) => category.name))

  return CATEGORY_TEMPLATES.filter(
    (template) => !existingTemplateIds.has(template.id) && !existingNames.has(template.name),
  )
})

onMounted(() => {
  void initializeAuth()
})

useBodyScrollLock(isSettingsModalOpen)

watch(categoryStatisticsMode, (statisticsMode) => {
  if (statisticsMode === 'rating') {
    categoryValueLabel.value = categoryValueLabel.value.trim() || '評分'
    categoryValueUnit.value = ''
  }
})

function startCreateCategory(): void {
  if (!canManageNotebookData.value) {
    return
  }

  editingCategoryId.value = undefined
  categoryName.value = ''
  categoryGroup.value = '飲食'
  categoryColorId.value = DEFAULT_CATEGORY_COLOR_ID
  categoryStatisticsMode.value = 'count'
  categoryValueLabel.value = ''
  categoryValueUnit.value = ''
  isQuickAction.value = true
  isCategoryModalOpen.value = true
}

function startEditCategory(category: EventCategory): void {
  if (!canManageNotebookData.value) {
    return
  }

  editingCategoryId.value = category.id
  categoryName.value = category.name
  categoryGroup.value = category.group ?? '飲食'
  categoryColorId.value = getCategoryColorId(category.colorId)
  categoryStatisticsMode.value = category.statisticsMode
  categoryValueLabel.value = category.valueLabel ?? ''
  categoryValueUnit.value = category.valueUnit ?? ''
  isQuickAction.value = category.isQuickAction
  isCategoryModalOpen.value = true
}

function closeCategoryModal(): void {
  isCategoryModalOpen.value = false
  editingCategoryId.value = undefined
  categoryName.value = ''
  categoryGroup.value = '飲食'
  categoryColorId.value = DEFAULT_CATEGORY_COLOR_ID
  categoryStatisticsMode.value = 'count'
  categoryValueLabel.value = ''
  categoryValueUnit.value = ''
  isQuickAction.value = true
  isStatisticsHelpOpen.value = false
}

function saveCategory(): void {
  if (!canManageNotebookData.value) {
    return
  }

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
      statisticsMode: categoryStatisticsMode.value,
      valueLabel:
        categoryStatisticsMode.value === 'count'
          ? undefined
          : categoryStatisticsMode.value === 'rating'
            ? categoryValueLabel.value.trim() || '評分'
            : categoryValueLabel.value.trim() || undefined,
      valueUnit:
        categoryStatisticsMode.value === 'count' || categoryStatisticsMode.value === 'rating'
          ? undefined
          : categoryValueUnit.value.trim() || undefined,
    })
  } else {
    catTrackerStore.createCategory({
      name: trimmedName,
      group: categoryGroup.value,
      colorId: categoryColorId.value,
      isQuickAction: true,
      isArchived: false,
      statisticsMode: categoryStatisticsMode.value,
      valueLabel:
        categoryStatisticsMode.value === 'count'
          ? undefined
          : categoryStatisticsMode.value === 'rating'
            ? categoryValueLabel.value.trim() || '評分'
            : categoryValueLabel.value.trim() || undefined,
      valueMax: categoryStatisticsMode.value === 'rating' ? 10 : undefined,
      valueUnit:
        categoryStatisticsMode.value === 'count' || categoryStatisticsMode.value === 'rating'
          ? undefined
          : categoryValueUnit.value.trim() || undefined,
    })
  }

  closeCategoryModal()
}

function addCategoryTemplate(template: CategoryTemplate): void {
  if (!canManageNotebookData.value) {
    return
  }

  catTrackerStore.createCategory({
    templateId: template.id,
    name: template.name,
    group: template.group,
    colorId: template.colorId,
    isQuickAction: true,
    isArchived: false,
    statisticsMode: template.statisticsMode,
    valueLabel: template.valueLabel,
    valueMax: template.valueMax,
    valueUnit: template.valueUnit,
  })
}

function deleteCategory(category: EventCategory): void {
  if (!canManageNotebookData.value) {
    return
  }

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
  if (!canManageNotebookData.value) {
    return
  }

  catTrackerStore.restoreCategory(category.id)
}

function deleteCat(cat: Cat): void {
  if (!canManageNotebookData.value) {
    return
  }

  pendingDeleteCatId.value = cat.id
}

function cancelDeleteCat(): void {
  pendingDeleteCatId.value = undefined
}

function confirmDeleteCat(): void {
  if (!pendingDeleteCat.value) {
    return
  }

  const deletedCatId = pendingDeleteCat.value.id

  catTrackerStore.deleteCat(deletedCatId)
  pendingDeleteCatId.value = undefined

  if (editingCatId.value === deletedCatId) {
    closeCatModal()
  }
}

function restoreCat(cat: Cat): void {
  if (!canManageNotebookData.value) {
    return
  }

  catTrackerStore.restoreCat(cat.id)
}

function openCatDetails(cat: Cat): void {
  viewingCatId.value = cat.id
}

function closeCatDetails(): void {
  viewingCatId.value = undefined
}

function startEditViewingCat(): void {
  const cat = viewingCat.value

  if (!cat || !canManageNotebookData.value) {
    return
  }

  closeCatDetails()
  startEditCat(cat)
}

function switchSettingsSection(section: SettingsSection): void {
  settingsSection.value = section
}

function startCreatePrimaryItem(): void {
  if (!canManageNotebookData.value) {
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
  if (!canManageNotebookData.value) {
    return
  }

  editingCatId.value = undefined
  catName.value = ''
  catBirthday.value = ''
  catSex.value = ''
  catWeightKg.value = ''
  ensureAvatarMatchesDogMode(isDogAvatarMode.value)
  catIsNeutered.value = ''
  catNote.value = ''
  isCatModalOpen.value = true
}

function startEditCat(cat: Cat): void {
  if (!canManageNotebookData.value) {
    return
  }

  editingCatId.value = cat.id
  catName.value = cat.name
  catBirthday.value = cat.birthday ?? ''
  catSex.value = cat.sex ?? ''
  catWeightKg.value = typeof cat.weightKg === 'number' ? String(cat.weightKg) : ''
  catAvatarId.value = getCatAvatarOption(cat.avatarId).id
  setStoredDogAvatarMode(isDogAvatarId(catAvatarId.value))
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

function setDogAvatarMode(nextValue: boolean): void {
  setStoredDogAvatarMode(nextValue)
  ensureAvatarMatchesDogMode(nextValue)
}

function ensureAvatarMatchesDogMode(nextValue: boolean): void {
  const avatarOptions = nextValue ? DOG_AVATAR_OPTIONS : CAT_AVATAR_OPTIONS
  if (!avatarOptions.some((avatar) => avatar.id === catAvatarId.value)) {
    catAvatarId.value = avatarOptions[0]?.id ?? DEFAULT_CAT_AVATAR_ID
  }
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

function getCatBirthdayText(cat: Cat): string {
  if (!cat.birthday) {
    return ''
  }

  const ageText = getCatAgeText(cat.birthday)

  return ageText ? `${cat.birthday}（${ageText}）` : cat.birthday
}

function getCatNeuteredText(cat: Cat): string {
  if (typeof cat.isNeutered !== 'boolean') {
    return ''
  }

  return cat.isNeutered ? '已絕育' : '未絕育'
}

function getCatDetailRows(cat: Cat): Array<{ label: string; value: string }> {
  return [
    { label: '生日', value: getCatBirthdayText(cat) },
    { label: '性別', value: getCatSexText(cat.sex) },
    {
      label: '體重',
      value: typeof cat.weightKg === 'number' ? `${cat.weightKg} kg` : '',
    },
    { label: '絕育狀態', value: getCatNeuteredText(cat) },
  ].filter((row) => row.value)
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
            <svg
              v-if="isDarkMode"
              class="theme-toggle__svg"
              viewBox="0 0 576 512"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M288 432c13.3 0 24 10.7 24 24l0 64c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-64c0-13.3 10.7-24 24-24zM129.6 380.4c9.4-9.4 24.6-9.4 34 0s9.4 24.6 0 34l-45.3 45.3c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l45.2-45.3zm282.8 0c9.4-9.4 24.6-9.4 34 0l45.3 45.3c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-45.3-45.3c-9.4-9.4-9.4-24.6 0-34zM288 384a128 128 0 1 1 0-256 128 128 0 1 1 0 256zM88 232c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l64 0zm464 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l64 0zM84.3 52.3c9.4-9.4 24.6-9.4 33.9 0l45.3 45.2c9.4 9.4 9.4 24.6 0 34s-24.6 9.4-34 0L84.3 86.3c-9.4-9.4-9.4-24.6 0-33.9zm373.4 0c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-45.3 45.3c-9.4 9.4-24.6 9.4-34 0s-9.4-24.6 0-34l45.3-45.2zM288-32c13.3 0 24 10.7 24 24l0 64c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-64c0-13.3 10.7-24 24-24z"
              />
            </svg>
            <svg v-else class="theme-toggle__svg" viewBox="0 0 512 512" aria-hidden="true">
              <path
                fill="currentColor"
                d="M256 0C114.6 0 0 114.6 0 256S114.6 512 256 512c68.8 0 131.3-27.2 177.3-71.4 7.3-7 9.4-17.9 5.3-27.1s-13.7-14.9-23.8-14.1c-4.9 .4-9.8 .6-14.8 .6-101.6 0-184-82.4-184-184 0-72.1 41.5-134.6 102.1-164.8 9.1-4.5 14.3-14.3 13.1-24.4S322.6 8.5 312.7 6.3C294.4 2.2 275.4 0 256 0z"
              />
            </svg>
          </button>
          <button
            v-if="canManageNotebookData"
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
      <p v-if="!canManageNotebookData" class="settings-readonly-message">
        {{ readOnlySettingsMessage }}
      </p>

      <div v-if="settingsSection === 'categories'" class="category-groups">
        <section
          v-if="canManageNotebookData && availableCategoryTemplates.length > 0"
          class="template-picker"
          aria-labelledby="category-template-title"
        >
          <div class="template-picker__header">
            <h2 id="category-template-title">預設追蹤模板</h2>
            <span>選擇你想追蹤的項目或自行新增</span>
          </div>

          <div class="template-picker__list">
            <button
              v-for="template in availableCategoryTemplates"
              :key="template.id"
              class="template-chip"
              type="button"
              @click="addCategoryTemplate(template)"
            >
              <span
                class="category-color"
                :style="{ '--category-color': getCategoryColorValue(template) }"
                aria-hidden="true"
              ></span>
              <span>{{ template.name }}</span>
              <small v-if="template.statisticsMode !== 'count'">
                {{ template.valueLabel || '數值'
                }}{{ template.valueUnit ? ` ${template.valueUnit}` : '' }}
              </small>
            </button>
          </div>
        </section>

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
                'category-item--readonly': !canManageNotebookData,
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
                v-if="!category.isArchived && canManageNotebookData"
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
                  <template v-if="category.statisticsMode !== 'count'">
                    {{ category.valueLabel || '數值'
                    }}{{ category.valueUnit ? ` (${category.valueUnit})` : '' }} ·
                  </template>
                  {{ catTrackerStore.getCategoryUsageCount(category.id) }} 筆紀錄
                </span>
              </div>
              <div
                v-if="canManageNotebookData && category.isArchived"
                class="category-item__actions"
              >
                <button
                  class="ui-button ui-button--primary compact-button"
                  type="button"
                  @click="restoreCategory(category)"
                >
                  重新使用
                </button>
              </div>
              <div v-else-if="canManageNotebookData" class="category-item__actions">
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
          :class="{
            'pet-item--archived': cat.isArchived,
            'pet-item--selected': selectedCatId === cat.id,
          }"
          role="button"
          tabindex="0"
          @click="openCatDetails(cat)"
          @keydown.enter.prevent="openCatDetails(cat)"
          @keydown.space.prevent="openCatDetails(cat)"
        >
          <div
            class="pet-avatar"
            :class="{ 'pet-avatar--dog': isDogAvatarId(cat.avatarId) }"
            aria-hidden="true"
          >
            <img
              :src="getCatAvatarOption(cat.avatarId).image"
              :alt="getCatAvatarOption(cat.avatarId).label"
            />
          </div>
          <div class="pet-item__content">
            <strong>{{ cat.name }}</strong>
            <span v-if="cat.isArchived">
              已停用 · 過去紀錄仍會保留 ·
              {{ catTrackerStore.getCatUsageCount(cat.id) }} 筆紀錄
            </span>
            <span v-else-if="getCatMeta(cat)">
              {{ getCatMeta(cat) }} · {{ catTrackerStore.getCatUsageCount(cat.id) }} 筆紀錄
            </span>
            <span v-else
              >尚未填寫詳細資料 · {{ catTrackerStore.getCatUsageCount(cat.id) }} 筆紀錄</span
            >
            <p v-if="cat.note">{{ cat.note }}</p>
          </div>
          <div v-if="canManageNotebookData && cat.isArchived" class="pet-item__actions">
            <button
              class="ui-button ui-button--primary compact-button"
              type="button"
              @click.stop="restoreCat(cat)"
            >
              重新使用
            </button>
          </div>
          <div v-else class="pet-item__actions">
            <button
              class="ui-button ui-button--secondary compact-button"
              type="button"
              :disabled="selectedCatId === cat.id"
              @click.stop="catTrackerStore.selectCat(cat.id)"
            >
              {{ selectedCatId === cat.id ? '使用中' : '切換' }}
            </button>
            <button
              v-if="canManageNotebookData"
              class="ui-button ui-button--secondary compact-button"
              type="button"
              @click.stop="startEditCat(cat)"
            >
              編輯
            </button>
            <button
              v-if="canManageNotebookData"
              class="ui-button ui-button--danger compact-button"
              type="button"
              @click.stop="deleteCat(cat)"
            >
              {{ catTrackerStore.getCatUsageCount(cat.id) > 0 ? '停用' : '刪除' }}
            </button>
          </div>
        </article>
      </div>
    </div>

    <FixedModal
      v-if="isCategoryModalOpen"
      panel-tag="form"
      labelledby="category-modal-title"
      @close="closeCategoryModal"
      @submit.prevent="saveCategory"
    >
      <template #header>
        <h2 id="category-modal-title" class="fixed-form-title">{{ formTitle }}</h2>
        <button
          class="ui-button ui-button--icon modal-close"
          type="button"
          aria-label="關閉分類視窗"
          @click="closeCategoryModal"
        >
          ×
        </button>
      </template>

      <template #body>
        <label class="field">
          <span class="field__label">名稱</span>
          <input v-model="categoryName" class="field__control" type="text" required />
        </label>

        <div class="field">
          <span class="field__label">群組</span>
          <FixedSelect v-model="categoryGroup" :options="categoryGroupOptions" />
        </div>

        <div class="field">
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
        </div>

        <div class="field">
          <div class="field__label-row">
            <span class="field__label">統計方式</span>
            <button
              class="field-help-button"
              type="button"
              :aria-expanded="isStatisticsHelpOpen"
              aria-controls="statistics-mode-help"
              aria-label="查看統計方式說明"
              @click="isStatisticsHelpOpen = !isStatisticsHelpOpen"
            >
              ?
            </button>
          </div>
          <FixedSelect v-model="categoryStatisticsMode" :options="categoryStatisticsModeOptions" />
        </div>

        <template v-if="categoryStatisticsMode !== 'count'">
          <label class="field">
            <span class="field__label">數值名稱</span>
            <input
              v-model="categoryValueLabel"
              class="field__control"
              type="text"
              :placeholder="
                categoryStatisticsMode === 'rating' ? '評分' : '例如：飲水量、體重、劑量'
              "
            />
          </label>

          <label v-if="categoryStatisticsMode !== 'rating'" class="field">
            <span class="field__label">單位</span>
            <input
              v-model="categoryValueUnit"
              class="field__control"
              type="text"
              placeholder="例如：ml、g、kg"
            />
          </label>
        </template>
      </template>

      <template #footer>
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
      </template>
    </FixedModal>

    <FixedModal
      v-if="isCatModalOpen"
      panel-tag="form"
      labelledby="cat-modal-title"
      @close="closeCatModal"
      @submit.prevent="saveCat"
    >
      <template #header>
        <h2 id="cat-modal-title" class="fixed-form-title">{{ catFormTitle }}</h2>
        <button
          class="ui-button ui-button--icon modal-close"
          type="button"
          aria-label="關閉寵物視窗"
          @click="closeCatModal"
        >
          ×
        </button>
      </template>

      <template #body>
        <label class="field">
          <span class="field__label">名字</span>
          <input v-model="catName" class="field__control" type="text" required />
        </label>

        <label class="field">
          <span class="field__label">生日</span>
          <input v-model="catBirthday" class="field__control" type="date" />
        </label>

        <div class="field">
          <span class="field__label">性別</span>
          <FixedSelect v-model="catSex" :options="catSexOptions" />
        </div>

        <label class="field">
          <span class="field__label">體重 kg</span>
          <input v-model="catWeightKg" class="field__control" type="number" min="0" step="0.1" />
        </label>

        <div class="field">
          <div class="cat-avatar-header">
            <span class="field__label">頭貼</span>
            <DogAvatarToggle
              :model-value="isDogAvatarMode"
              @update:model-value="setDogAvatarMode"
            />
          </div>
          <div
            class="cat-avatar-options"
            role="radiogroup"
            :aria-label="isDogAvatarMode ? '選擇狗狗頭貼' : '選擇貓咪頭貼'"
          >
            <button
              v-for="avatar in visibleCatAvatarOptions"
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
              <span
                class="pet-avatar pet-avatar--option"
                :class="{ 'pet-avatar--dog': isDogAvatarId(avatar.id) }"
                aria-hidden="true"
              >
                <img :src="avatar.image" :alt="avatar.label" />
              </span>
            </button>
          </div>
        </div>

        <div class="field">
          <span class="field__label">絕育狀態</span>
          <FixedSelect v-model="catIsNeutered" :options="catIsNeuteredOptions" />
        </div>

        <label class="field">
          <span class="field__label">備註</span>
          <textarea v-model="catNote" class="field__control pet-note" rows="4"></textarea>
        </label>
      </template>

      <template #footer>
        <div class="category-form__actions">
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
      </template>
    </FixedModal>

    <div
      v-if="isStatisticsHelpOpen"
      class="category-modal-backdrop"
      role="presentation"
      @click.self="isStatisticsHelpOpen = false"
    >
      <section
        id="statistics-mode-help"
        class="category-modal statistics-help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="statistics-help-title"
      >
        <div class="category-form__header">
          <h2 id="statistics-help-title">統計方式說明</h2>
          <button
            class="ui-button ui-button--icon modal-close"
            type="button"
            aria-label="關閉統計方式說明"
            @click="isStatisticsHelpOpen = false"
          >
            ×
          </button>
        </div>

        <div class="statistics-help">
          <p>
            <strong>發生次數</strong>
            <span>記錄事件發生幾次，適合觀察頻率是否增加或減少。例：嘔吐、腹瀉、夜間不睡。</span>
          </p>
          <p>
            <strong>累積數量</strong>
            <span>把同一天記錄的數值加總，適合看每日總量。例：飲水量、食物量、用藥劑量。</span>
          </p>
          <p>
            <strong>量測紀錄</strong>
            <span>每次都是一次獨立測量，適合看數值變化與趨勢，不會加總。例：體重、體溫。</span>
          </p>
          <p>
            <strong>狀態評分</strong>
            <span>用分數記錄主觀狀態，適合追蹤精神、食慾、疼痛感等變化。例：精神狀態、食慾。</span>
          </p>
        </div>
      </section>
    </div>

    <div
      v-if="viewingCat"
      class="category-modal-backdrop"
      role="presentation"
      @click.self="closeCatDetails"
    >
      <section
        class="category-modal cat-detail-modal"
        aria-labelledby="cat-detail-title"
        role="dialog"
        aria-modal="true"
      >
        <div class="category-form__header">
          <div class="cat-detail-heading">
            <span
              class="pet-avatar cat-detail-heading__avatar"
              :class="{ 'pet-avatar--dog': isDogAvatarId(viewingCat.avatarId) }"
              aria-hidden="true"
            >
              <img
                :src="getCatAvatarOption(viewingCat.avatarId).image"
                :alt="getCatAvatarOption(viewingCat.avatarId).label"
              />
            </span>
            <div>
              <h2 id="cat-detail-title">{{ viewingCat.name }}</h2>
              <span>{{ viewingCat.isArchived ? '已停用' : '使用中' }}</span>
            </div>
          </div>
          <button
            class="ui-button ui-button--icon modal-close"
            type="button"
            aria-label="關閉寵物資料"
            @click="closeCatDetails"
          >
            ×
          </button>
        </div>

        <dl v-if="getCatDetailRows(viewingCat).length > 0" class="cat-detail-list">
          <template v-for="row in getCatDetailRows(viewingCat)" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
        <p v-else class="cat-detail-empty">尚未填寫詳細資料</p>

        <section v-if="viewingCat.note" class="cat-detail-note" aria-label="寵物備註">
          <h3>備註</h3>
          <p>{{ viewingCat.note }}</p>
        </section>

        <div class="category-form__actions cat-detail-actions">
          <button
            class="ui-button ui-button--secondary save-button"
            type="button"
            @click="closeCatDetails"
          >
            關閉
          </button>
          <button
            v-if="canManageNotebookData"
            class="ui-button ui-button--primary save-button"
            type="button"
            @click="startEditViewingCat"
          >
            編輯
          </button>
        </div>
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

    <ConfirmDialog
      v-if="pendingDeleteCat"
      :title="`${deleteCatActionLabel}寵物？`"
      :message="deleteCatMessage"
      :confirm-label="deleteCatActionLabel"
      cancel-label="保留"
      tone="danger"
      @cancel="cancelDeleteCat"
      @confirm="confirmDeleteCat"
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.settings-tab {
  min-height: 38px;
}

.settings-content {
  min-height: 0;
}

.settings-readonly-message {
  margin: 0 0 12px;
  color: var(--color-muted);
  font-size: 0.875rem;
  line-height: 1.45;
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

.account-remember-field {
  justify-self: start;
  font-size: 0.875rem;
}

.notebook-name-form {
  display: grid;
  gap: 12px;
}

.notebook-share-form {
  display: grid;
  gap: 10px;
}

.notebook-name-form__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
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

.template-picker {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.template-picker__header {
  display: grid;
  gap: 2px;
}

.template-picker__header h2 {
  margin: 0;
  font-size: 1.05rem;
}

.template-picker__header span {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.template-picker__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.template-chip:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.template-chip small {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.category-form {
  display: grid;
  gap: 12px;
}

.fixed-form-title {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.25;
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
  min-width: 0;
}

.field__label {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 700;
}

.field__label-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.field-help-button {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-background);
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 900;
  line-height: 1;
}

.field-help-button:hover,
.field-help-button[aria-expanded='true'] {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-text);
}

.statistics-help {
  display: grid;
  gap: 10px;
  color: var(--color-text);
  font-size: 0.8125rem;
}

.statistics-help p {
  display: grid;
  gap: 2px;
  margin: 0;
}

.statistics-help strong {
  font-weight: 900;
}

.statistics-help span {
  color: var(--color-muted);
  line-height: 1.45;
}

.statistics-help-modal {
  display: grid;
  width: min(100%, 420px);
  gap: 14px;
}

.field__control {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
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
  cursor: pointer;
}

.pet-item--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.pet-item:hover,
.pet-item:focus-visible {
  border-color: var(--color-border-strong);
  background: var(--color-primary-light);
  outline: none;
}

.pet-item--archived {
  border-style: dashed;
  background: var(--color-disabled-surface);
}

.pet-item--archived .pet-avatar {
  opacity: 0.58;
}

.pet-item--archived strong {
  color: var(--color-muted);
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

.pet-avatar--dog img {
  transform: scale(1.1);
}

.cat-avatar-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.cat-avatar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cat-avatar-option {
  display: grid;
  min-height: 82px;
  min-width: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
}

.cat-avatar-option:hover,
.cat-avatar-option--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.pet-avatar--option {
  width: 56px;
  height: 56px;
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

.category-item--readonly {
  grid-template-columns: 14px minmax(0, 1fr);
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
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  min-width: 34px;
  place-items: center;
  padding: 0;
}

.theme-toggle__svg {
  display: block;
  width: 18px;
  height: 18px;
  color: var(--color-primary);
  overflow: visible;
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
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  background: var(--overlay-color);
}

.category-modal {
  width: min(100%, 520px);
  max-width: 100%;
  max-height: calc(100dvh - 32px);
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 22px 60px var(--shadow-color);
}

.cat-detail-modal {
  display: grid;
  gap: 14px;
}

.cat-detail-heading {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.cat-detail-heading h2,
.cat-detail-heading span {
  min-width: 0;
  margin: 0;
}

.cat-detail-heading h2 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-detail-heading span {
  color: var(--color-muted);
  font-size: 0.875rem;
  font-weight: 800;
}

.cat-detail-heading__avatar {
  width: 52px;
  height: 52px;
}

.cat-detail-list {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 10px 14px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.cat-detail-list dt {
  color: var(--color-muted);
  font-weight: 800;
}

.cat-detail-list dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 800;
}

.cat-detail-empty {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-muted);
  font-weight: 800;
}

.cat-detail-note {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.cat-detail-note h3,
.cat-detail-note p {
  margin: 0;
}

.cat-detail-note h3 {
  font-size: 0.875rem;
}

.cat-detail-note p {
  overflow-wrap: anywhere;
  color: var(--color-text);
}

.cat-detail-actions {
  padding-top: 12px;
  border-top: 1px solid var(--color-divider);
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
    height: 34px;
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

  .category-item--readonly {
    grid-template-columns: 14px minmax(0, 1fr);
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

  .field__control[type='date'] {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding-right: 6px;
    padding-left: 8px;
    appearance: none;
    -webkit-appearance: none;
    font-size: 0.9375rem;
  }

  .field__control[type='date']::-webkit-date-and-time-value {
    min-width: 0;
    text-align: left;
  }
}
</style>
