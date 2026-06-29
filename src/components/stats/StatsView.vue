<script setup lang="ts">
import { ref } from 'vue'
import StatsDetailView from '@/components/stats/StatsDetailView.vue'
import StatsOverview from '@/components/stats/StatsOverview.vue'
import type { StatsOverviewRangeMode } from '@/services/statsOverviewRange'

const selectedDetailCategoryId = ref('')
const selectedStatsCategoryIds = ref<string[]>([])
const selectedRangeMode = ref<StatsOverviewRangeMode>('7d')
const selectedReferenceDate = ref('')
const selectedCustomStartDate = ref('')
const selectedCustomEndDate = ref('')

function openCategory(selection: {
  categoryId: string
  categoryIds: string[]
  rangeMode: StatsOverviewRangeMode
  referenceDate: string
  customStartDate?: string
  customEndDate?: string
}): void {
  selectedDetailCategoryId.value = selection.categoryId
  selectedStatsCategoryIds.value = [...selection.categoryIds]
  selectedRangeMode.value = selection.rangeMode
  selectedReferenceDate.value = selection.referenceDate
  selectedCustomStartDate.value = selection.customStartDate ?? ''
  selectedCustomEndDate.value = selection.customEndDate ?? ''
}

function updateRange(selection: {
  rangeMode: StatsOverviewRangeMode
  referenceDate: string
  customStartDate?: string
  customEndDate?: string
}): void {
  selectedRangeMode.value = selection.rangeMode
  selectedReferenceDate.value = selection.referenceDate
  selectedCustomStartDate.value = selection.customStartDate ?? ''
  selectedCustomEndDate.value = selection.customEndDate ?? ''
}

function closeDetail(): void {
  selectedDetailCategoryId.value = ''
}
</script>

<template>
  <StatsDetailView
    v-if="selectedDetailCategoryId"
    :initial-category-id="selectedDetailCategoryId"
    :category-ids="selectedStatsCategoryIds"
    :initial-range-mode="selectedRangeMode"
    :initial-reference-date="selectedReferenceDate"
    :initial-custom-start-date="selectedCustomStartDate"
    :initial-custom-end-date="selectedCustomEndDate"
    @back="closeDetail"
    @range-change="updateRange"
  />
  <StatsOverview
    v-else
    :initial-range-mode="selectedRangeMode"
    :initial-reference-date="selectedReferenceDate"
    :initial-custom-start-date="selectedCustomStartDate"
    :initial-custom-end-date="selectedCustomEndDate"
    @open-category="openCategory"
  />
</template>
