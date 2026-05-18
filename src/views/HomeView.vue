<script setup lang="ts">
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BottomQuickActions from '@/components/home/BottomQuickActions.vue'
import EventEditModal from '@/components/home/EventEditModal.vue'
import EventTimeline from '@/components/home/EventTimeline.vue'
import HomeCalendar from '@/components/home/HomeCalendar.vue'
import SettingsView from '@/components/settings/SettingsView.vue'
import { useCatTrackerStore } from '@/stores/catTracker'

const catTrackerStore = useCatTrackerStore()
const { activeTab, deleteConfirmEvent } = storeToRefs(catTrackerStore)
</script>

<template>
  <main class="home-view" aria-labelledby="timeline-title">
    <template v-if="activeTab === 'calendar'">
      <HomeCalendar />
      <EventTimeline />
    </template>
    <SettingsView v-else />
    <BottomQuickActions />
    <EventEditModal />

    <ConfirmDialog
      v-if="deleteConfirmEvent"
      title="刪除這筆紀錄？"
      message="刪除後無法復原，這筆紀錄會從列表中移除。"
      confirm-label="刪除"
      cancel-label="保留"
      tone="danger"
      @cancel="catTrackerStore.cancelDeleteEvent"
      @confirm="catTrackerStore.confirmDeleteEvent"
    />
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  height: 100%;
  margin: 0;
}

:global(body) {
  overflow: auto;
}

.home-view {
  --content-width: min(100%, 430px);

  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
  padding: 14px 14px 96px;
  background: #f8faf7;
  color: #17201b;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

@media (max-width: 560px) {
  :global(body) {
    overflow: hidden;
  }

  .home-view {
    height: 100vh;
    height: 100dvh;
    gap: 12px;
    overflow: hidden;
    padding: 10px 10px 94px;
  }

}
</style>
