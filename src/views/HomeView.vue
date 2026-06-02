<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BottomQuickActions from '@/components/home/BottomQuickActions.vue'
import EventEditModal from '@/components/home/EventEditModal.vue'
import EventTimeline from '@/components/home/EventTimeline.vue'
import FirstTimeSetup from '@/components/home/FirstTimeSetup.vue'
import HomeCalendar from '@/components/home/HomeCalendar.vue'
import MonthlyEventList from '@/components/home/MonthlyEventList.vue'
import NotebookView from '@/components/notebook/NotebookView.vue'
import SettingsView from '@/components/settings/SettingsView.vue'
import StatsView from '@/components/stats/StatsView.vue'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { useRemoteCatTrackerRefresh } from '@/composables/useRemoteCatTrackerRefresh'
import { useTheme } from '@/composables/useTheme'
import { useCatTrackerStore } from '@/stores/catTracker'

useTheme()
const { activeNotebookId, activeNotebookRole, initializeAuth, user } = useRemoteAuth()
const { bootstrapRemoteCatTracker, refreshRemoteCatTracker } = useRemoteCatTrackerRefresh()

const catTrackerStore = useCatTrackerStore()
const {
  activeTab,
  calendarDisplayMode,
  deleteConfirmEvent,
  isEventSearchActive,
  isEventSearchOpen,
  needsFirstTimeSetup,
} = storeToRefs(catTrackerStore)

onMounted(() => {
  void initializeAuth().then(() => {
    void bootstrapRemoteCatTracker(catTrackerStore, activeNotebookId.value, {
      notebookRole: activeNotebookRole.value,
      userId: user.value?.id ?? null,
    })
  })

  window.addEventListener('focus', refreshRemoteData)
  document.addEventListener('visibilitychange', refreshRemoteDataWhenVisible)
})

watch(activeNotebookId, (notebookId) => {
  if (notebookId) {
    void bootstrapRemoteCatTracker(catTrackerStore, notebookId, {
      notebookRole: activeNotebookRole.value,
      userId: user.value?.id ?? null,
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshRemoteData)
  document.removeEventListener('visibilitychange', refreshRemoteDataWhenVisible)
})

function refreshRemoteData(): void {
  void refreshRemoteCatTracker(catTrackerStore, activeNotebookId.value)
}

function refreshRemoteDataWhenVisible(): void {
  if (document.visibilityState === 'visible') {
    refreshRemoteData()
  }
}
</script>

<template>
  <main class="home-view" aria-labelledby="timeline-title">
    <FirstTimeSetup v-if="needsFirstTimeSetup" />

    <template v-else-if="activeTab === 'calendar'">
      <HomeCalendar />
      <EventTimeline
        v-if="calendarDisplayMode === 'calendar' && !isEventSearchOpen && !isEventSearchActive"
      />
      <MonthlyEventList v-else />
    </template>
    <NotebookView v-else-if="activeTab === 'notebook'" />
    <StatsView v-else-if="activeTab === 'stats'" />
    <SettingsView v-else />
    <BottomQuickActions v-if="!needsFirstTimeSetup" />
    <EventEditModal v-if="!needsFirstTimeSetup" />

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
  --content-width: min(100%, 390px);

  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
  padding: 14px 14px 80px;
  background: var(--color-background);
  color: var(--color-text);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

@media (max-width: 560px) {
  :global(body) {
    overflow: auto;
  }

  .home-view {
    min-height: 100vh;
    min-height: 100dvh;
    gap: 12px;
    overflow: visible;
    padding: 10px 10px 78px;
  }
}
</style>
