<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { useRemoteCatTrackerRefresh } from '@/composables/useRemoteCatTrackerRefresh'
import { useTheme } from '@/composables/useTheme'
import { useCatTrackerStore } from '@/stores/catTracker'

useTheme()
const { activeNotebookId, activeNotebookRole, initializeAuth, user } = useRemoteAuth()
const {
  bootstrapRemoteCatTracker,
  isBootstrappingRemoteData,
  mergePendingLocalChangesToRemote,
  pendingUnsyncedLocalChanges,
  refreshRemoteCatTracker,
  replacePendingLocalChangesWithRemote,
} = useRemoteCatTrackerRefresh()

const catTrackerStore = useCatTrackerStore()
const {
  activeTab,
  calendarDisplayMode,
  deleteConfirmEvent,
  isEventSearchActive,
  isEventSearchOpen,
  needsFirstTimeSetup,
} = storeToRefs(catTrackerStore)
const isUnsyncedLocalDialogOpen = computed(() => Boolean(pendingUnsyncedLocalChanges.value))
const unsyncedLocalAction = ref<'merge' | 'remote' | ''>('')
const isResolvingUnsyncedLocalChanges = computed(() => Boolean(unsyncedLocalAction.value))

useBodyScrollLock(isUnsyncedLocalDialogOpen)

onMounted(() => {
  void initializeAuth().then(() => {
    void bootstrapRemoteCatTracker(catTrackerStore, activeNotebookId.value, {
      notebookRole: activeNotebookRole.value,
      userId: user.value?.id ?? null,
    })
  })

  window.addEventListener('focus', refreshRemoteData)
  window.addEventListener('online', refreshRemoteDataAfterOnline)
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
  window.removeEventListener('online', refreshRemoteDataAfterOnline)
  document.removeEventListener('visibilitychange', refreshRemoteDataWhenVisible)
})

function refreshRemoteData(): void {
  void refreshRemoteCatTracker(catTrackerStore, activeNotebookId.value, { reason: 'foreground' })
}

function refreshRemoteDataWhenVisible(): void {
  if (document.visibilityState === 'visible') {
    refreshRemoteData()
  }
}

function refreshRemoteDataAfterOnline(): void {
  void refreshRemoteCatTracker(catTrackerStore, activeNotebookId.value, { reason: 'online' })
}

watch(activeTab, (tab) => {
  if (tab === 'calendar' || tab === 'stats') {
    void refreshRemoteCatTracker(catTrackerStore, activeNotebookId.value, { reason: 'view' })
  }
})

async function submitMergePendingLocalChanges(): Promise<void> {
  if (isResolvingUnsyncedLocalChanges.value) {
    return
  }

  unsyncedLocalAction.value = 'merge'

  try {
    await mergePendingLocalChangesToRemote(catTrackerStore)
  } finally {
    unsyncedLocalAction.value = ''
  }
}

async function submitUseRemoteData(): Promise<void> {
  if (isResolvingUnsyncedLocalChanges.value) {
    return
  }

  unsyncedLocalAction.value = 'remote'

  try {
    await replacePendingLocalChangesWithRemote(catTrackerStore)
  } finally {
    unsyncedLocalAction.value = ''
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

    <div
      v-if="pendingUnsyncedLocalChanges"
      class="unsynced-local-backdrop"
      role="presentation"
    >
      <section
        class="unsynced-local-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsynced-local-title"
        aria-describedby="unsynced-local-description"
      >
        <h2 id="unsynced-local-title">發現本機未同步資料</h2>
        <p id="unsynced-local-description">
          你登出後曾在本機新增或修改資料。請選擇要合併本機變更，或改用雲端資料後再繼續。
        </p>
        <p
          v-if="isResolvingUnsyncedLocalChanges"
          class="unsynced-local-dialog__status"
          role="status"
          aria-live="polite"
        >
          {{ unsyncedLocalAction === 'merge' ? '正在同步本機變更...' : '正在載入雲端資料...' }}
        </p>
        <div class="unsynced-local-dialog__actions">
          <button
            class="ui-button ui-button--primary"
            type="button"
            :disabled="isBootstrappingRemoteData || isResolvingUnsyncedLocalChanges"
            @click="submitMergePendingLocalChanges"
          >
            {{ unsyncedLocalAction === 'merge' ? '同步中' : '同步本機變更' }}
          </button>
          <button
            class="ui-button ui-button--secondary"
            type="button"
            :disabled="isBootstrappingRemoteData || isResolvingUnsyncedLocalChanges"
            @click="submitUseRemoteData"
          >
            {{ unsyncedLocalAction === 'remote' ? '載入中' : '改用雲端資料' }}
          </button>
        </div>
      </section>
    </div>

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

.unsynced-local-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  background: var(--overlay-color);
}

.unsynced-local-dialog {
  display: grid;
  width: min(100%, 390px);
  gap: 12px;
  box-sizing: border-box;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 22px 60px var(--shadow-color);
}

.unsynced-local-dialog h2,
.unsynced-local-dialog p {
  margin: 0;
}

.unsynced-local-dialog h2 {
  font-size: 1.125rem;
}

.unsynced-local-dialog p {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.unsynced-local-dialog__status {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--color-primary-light);
  color: var(--color-text) !important;
  font-weight: 800;
}

.unsynced-local-dialog__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.unsynced-local-dialog__actions .ui-button {
  min-height: 42px;
}
</style>
