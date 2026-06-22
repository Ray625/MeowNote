<script setup lang="ts">
import { ref } from 'vue'
import StatsDetailView from '@/components/stats/StatsDetailView.vue'
import StatsOverview from '@/components/stats/StatsOverview.vue'

const selectedDetailCategoryId = ref('')

function openCategory(categoryId: string): void {
  selectedDetailCategoryId.value = categoryId
}

function closeDetail(): void {
  selectedDetailCategoryId.value = ''
}
</script>

<template>
  <StatsDetailView
    v-if="selectedDetailCategoryId"
    :initial-category-id="selectedDetailCategoryId"
    @back="closeDetail"
  />
  <StatsOverview v-else @open-category="openCategory" />
</template>
