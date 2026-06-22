<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import CatSwitcher from '@/components/common/CatSwitcher.vue'
import FixedModal from '@/components/common/FixedModal.vue'
import { getCategoryColorValue } from '@/constants/defaultData'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import {
  loadStatsPreference,
  saveStatsPreference,
} from '@/repositories/statsPreferenceRepository'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { EventCategory } from '@/types'

const emit = defineEmits<{
  openCategory: [categoryId: string]
}>()

const catTrackerStore = useCatTrackerStore()
const { categories, events, selectedCatId } = storeToRefs(catTrackerStore)
const { activeNotebookId, user } = useRemoteAuth()
const selectedCategoryIds = ref<string[]>([])
const draftCategoryIds = ref<string[]>([])
const isManagerOpen = ref(false)
const draggingCategoryId = ref<string>()
const dragTargetCategoryId = ref<string>()
const dragTargetPosition = ref<'before' | 'after'>('before')

const preferenceScopeKey = computed(
  () => `${user.value?.id ?? 'guest'}:${activeNotebookId.value || 'local'}`,
)
const recordedCategoryIds = computed(
  () =>
    new Set(
      events.value
        .filter((event) => event.catId === selectedCatId.value)
        .map((event) => event.categoryId),
    ),
)
const availableCategories = computed(() =>
  categories.value
    .filter((category) => recordedCategoryIds.value.has(category.id))
    .sort((left, right) => left.sortOrder - right.sortOrder),
)
const availableCategoryIdSet = computed(
  () => new Set(availableCategories.value.map((category) => category.id)),
)
const manageableCategories = computed(() => {
  const categoryIds = new Set([
    ...availableCategories.value.map((category) => category.id),
    ...selectedCategoryIds.value,
  ])

  return categories.value
    .filter((category) => categoryIds.has(category.id))
    .sort((left, right) => left.sortOrder - right.sortOrder)
})
const selectedCategories = computed(() =>
  selectedCategoryIds.value
    .map((categoryId) => categories.value.find((category) => category.id === categoryId))
    .filter((category): category is EventCategory => Boolean(category)),
)
const shouldShowSetup = computed(
  () => selectedCategoryIds.value.length === 0 && availableCategories.value.length > 0,
)
const groupedAvailableCategories = computed(() => {
  const groups = new Map<string, EventCategory[]>()

  for (const category of manageableCategories.value) {
    const group = category.group ?? '其他'

    groups.set(group, [...(groups.get(group) ?? []), category])
  }

  return Array.from(groups.entries()).map(([group, groupCategories]) => ({
    group,
    categories: groupCategories,
  }))
})

useBodyScrollLock(computed(() => isManagerOpen.value || shouldShowSetup.value))

watch(
  preferenceScopeKey,
  (scopeKey) => {
    selectedCategoryIds.value = loadStatsPreference(scopeKey).categoryIds
  },
  { immediate: true },
)

watch(
  availableCategoryIdSet,
  () => {
    const normalizedIds = selectedCategoryIds.value.filter((categoryId) =>
      categories.value.some((category) => category.id === categoryId),
    )

    if (normalizedIds.length !== selectedCategoryIds.value.length) {
      selectedCategoryIds.value = normalizedIds
      persistPreference()
    }

    draftCategoryIds.value = shouldShowSetup.value ? [] : [...selectedCategoryIds.value]
  },
  { immediate: true },
)

function getCategoryStyle(category: EventCategory): Record<string, string> {
  return {
    '--category-color': getCategoryColorValue(category),
  }
}

function openManager(): void {
  draftCategoryIds.value = [...selectedCategoryIds.value]
  isManagerOpen.value = true
}

function closeManager(): void {
  isManagerOpen.value = false
}

function toggleDraftCategory(categoryId: string): void {
  draftCategoryIds.value = draftCategoryIds.value.includes(categoryId)
    ? draftCategoryIds.value.filter((id) => id !== categoryId)
    : [...draftCategoryIds.value, categoryId]
}

function saveManagedCategories(): void {
  selectedCategoryIds.value = [...draftCategoryIds.value]
  persistPreference()
  closeManager()
}

function persistPreference(): void {
  saveStatsPreference(preferenceScopeKey.value, {
    categoryIds: selectedCategoryIds.value,
  })
}

function startDrag(categoryId: string, event: DragEvent): void {
  draggingCategoryId.value = categoryId
  dragTargetCategoryId.value = undefined

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', categoryId)
  }
}

function dragOverCategory(targetCategoryId: string, event: DragEvent): void {
  if (!draggingCategoryId.value || draggingCategoryId.value === targetCategoryId) {
    dragTargetCategoryId.value = undefined
    return
  }

  const target = event.currentTarget as HTMLElement
  const bounds = target.getBoundingClientRect()

  dragTargetCategoryId.value = targetCategoryId
  dragTargetPosition.value = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
}

function dropCategory(targetCategoryId: string): void {
  const sourceCategoryId = draggingCategoryId.value
  const position = dragTargetPosition.value

  if (!sourceCategoryId || sourceCategoryId === targetCategoryId) {
    clearDragState()
    return
  }

  const nextIds = selectedCategoryIds.value.filter((categoryId) => categoryId !== sourceCategoryId)
  const targetIndex = nextIds.indexOf(targetCategoryId)
  const insertIndex = Math.max(targetIndex + (position === 'after' ? 1 : 0), 0)

  nextIds.splice(insertIndex, 0, sourceCategoryId)
  selectedCategoryIds.value = nextIds
  persistPreference()
  clearDragState()
}

function clearDragState(): void {
  draggingCategoryId.value = undefined
  dragTargetCategoryId.value = undefined
}
</script>

<template>
  <section class="stats-overview" aria-labelledby="stats-overview-title">
    <header class="stats-overview__header">
      <CatSwitcher />
      <h1 id="stats-overview-title">統計</h1>
      <button class="ui-button ui-button--primary stats-overview__manage" type="button" @click="openManager">
        管理統計
      </button>
    </header>

    <div v-if="selectedCategories.length > 0" class="stats-overview__cards">
      <article
        v-for="category in selectedCategories"
        :key="category.id"
        class="stats-overview-card"
        :class="{
          'stats-overview-card--dragging': draggingCategoryId === category.id,
          'stats-overview-card--drop-before':
            dragTargetCategoryId === category.id && dragTargetPosition === 'before',
          'stats-overview-card--drop-after':
            dragTargetCategoryId === category.id && dragTargetPosition === 'after',
        }"
        :style="getCategoryStyle(category)"
        @dragover.prevent="dragOverCategory(category.id, $event)"
        @dragend="clearDragState"
        @drop="dropCategory(category.id)"
      >
        <span
          class="stats-overview-card__drag-handle"
          draggable="true"
          aria-label="拖曳排序"
          title="拖曳排序"
          @dragstart="startDrag(category.id, $event)"
        >
          ⋮⋮
        </span>
        <button
          class="stats-overview-card__main"
          type="button"
          @click="emit('openCategory', category.id)"
        >
          <span class="stats-overview-card__dot" aria-hidden="true"></span>
          <span>
            <strong>{{ category.name }}</strong>
            <small>統計摘要將在下一階段接上</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </article>
    </div>

    <p v-else-if="availableCategories.length === 0" class="stats-overview__empty">
      目前還沒有可統計的紀錄。
    </p>

    <FixedModal
      v-if="isManagerOpen || shouldShowSetup"
      labelledby="stats-manager-title"
      :close-on-backdrop="!shouldShowSetup"
      @close="shouldShowSetup ? undefined : closeManager()"
    >
      <template #header>
        <h2 id="stats-manager-title">
          {{ shouldShowSetup ? '選擇統計項目' : '管理統計項目' }}
        </h2>
        <button
          v-if="!shouldShowSetup"
          class="stats-manager__close"
          type="button"
          aria-label="關閉管理統計項目"
          @click="closeManager"
        >
          ×
        </button>
      </template>

      <template #body>
        <p class="stats-manager__hint">只會列出目前寵物實際有紀錄的分類。</p>
        <section
          v-for="group in groupedAvailableCategories"
          :key="group.group"
          class="stats-manager__group"
        >
          <h3>{{ group.group }}</h3>
          <div class="stats-manager__options">
            <button
              v-for="category in group.categories"
              :key="category.id"
              class="stats-manager__option"
              :class="{ 'stats-manager__option--selected': draftCategoryIds.includes(category.id) }"
              :style="getCategoryStyle(category)"
              type="button"
              @click="toggleDraftCategory(category.id)"
            >
              <span class="stats-overview-card__dot" aria-hidden="true"></span>
              <span>{{ category.name }}</span>
              <span aria-hidden="true">
                {{ draftCategoryIds.includes(category.id) ? '✓' : '' }}
              </span>
            </button>
          </div>
        </section>
      </template>

      <template #footer>
        <button
          class="ui-button ui-button--primary stats-manager__save"
          type="button"
          :disabled="draftCategoryIds.length === 0"
          @click="saveManagedCategories"
        >
          完成
        </button>
      </template>
    </FixedModal>
  </section>
</template>

<style scoped>
.stats-overview {
  display: grid;
  width: var(--content-width);
  gap: 14px;
  margin: 0 auto;
}

.stats-overview__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
  background: var(--color-surface);
}

.stats-overview__header h1 {
  margin: 0;
  font-size: 1.25rem;
}

.stats-overview__manage {
  justify-self: end;
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.875rem;
}

.stats-overview__cards {
  display: grid;
  gap: 10px;
}

.stats-overview-card {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: stretch;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--category-color) 34%, var(--color-border));
  border-left: 5px solid var(--category-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--category-color) 6%, var(--color-surface));
}

.stats-overview-card--dragging {
  opacity: 0.55;
}

.stats-overview-card--drop-before,
.stats-overview-card--drop-after {
  overflow: visible;
}

.stats-overview-card--drop-before::before,
.stats-overview-card--drop-after::after {
  position: absolute;
  left: 8px;
  right: 8px;
  z-index: 1;
  height: 3px;
  border-radius: 999px;
  background: var(--color-primary);
  content: '';
}

.stats-overview-card--drop-before::before {
  top: -6px;
}

.stats-overview-card--drop-after::after {
  bottom: -6px;
}

.stats-overview-card__drag-handle {
  display: grid;
  place-items: center;
  color: var(--color-muted);
  cursor: grab;
  font-size: 0.875rem;
  letter-spacing: -0.18em;
  user-select: none;
}

.stats-overview-card__drag-handle:active {
  cursor: grabbing;
}

.stats-overview-card__main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  border: 0;
  padding: 14px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.stats-overview-card__main > span:nth-child(2) {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.stats-overview-card__main strong {
  color: color-mix(in srgb, var(--category-color) 82%, var(--color-text));
}

.stats-overview-card__main small,
.stats-manager__hint {
  color: var(--color-muted);
}

.stats-overview-card__dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--category-color);
}

.stats-manager__close {
  border: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.stats-overview__empty {
  margin: 0;
  padding: 32px 0;
  color: var(--color-muted);
  text-align: center;
}

.stats-manager__hint {
  margin: 0;
  font-size: 0.875rem;
}

.stats-manager__group {
  display: grid;
  gap: 8px;
}

.stats-manager__group h3 {
  margin: 0;
  font-size: 0.875rem;
}

.stats-manager__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stats-manager__option {
  display: inline-grid;
  grid-template-columns: auto auto 16px;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.stats-manager__option--selected {
  border-color: var(--category-color);
  background: color-mix(in srgb, var(--category-color) 12%, var(--color-surface));
}

.stats-manager__save {
  min-height: 44px;
}

@media (max-width: 560px) {
  .stats-overview__header {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .stats-overview__header h1 {
    grid-column: 1 / -1;
    grid-row: 1;
    justify-self: center;
  }

  .stats-overview__header :deep(.cat-switcher) {
    grid-column: 1;
    grid-row: 1;
  }

  .stats-overview__manage {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
