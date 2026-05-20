import { readonly, ref } from 'vue'
import { loadRemoteCatTracker } from '@/services/loadRemoteCatTracker'
import type { useCatTrackerStore } from '@/stores/catTracker'

const MIN_REFRESH_INTERVAL_MS = 30_000

const isRefreshingRemoteData = ref(false)
const remoteRefreshError = ref('')
let lastRefreshAt = 0

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string') {
      return message
    }
  }

  return '刷新雲端資料失敗'
}

export function useRemoteCatTrackerRefresh() {
  async function refreshRemoteCatTracker(
    catTrackerStore: ReturnType<typeof useCatTrackerStore>,
    notebookId: string,
    options: { force?: boolean } = {},
  ): Promise<void> {
    if (!notebookId || isRefreshingRemoteData.value) {
      return
    }

    const now = Date.now()

    if (!options.force && now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
      return
    }

    isRefreshingRemoteData.value = true

    try {
      const remoteState = await loadRemoteCatTracker(notebookId)
      catTrackerStore.replacePersistedState(remoteState)
      lastRefreshAt = Date.now()
      remoteRefreshError.value = ''
    } catch (error) {
      remoteRefreshError.value = getErrorMessage(error)
    } finally {
      isRefreshingRemoteData.value = false
    }
  }

  return {
    isRefreshingRemoteData: readonly(isRefreshingRemoteData),
    remoteRefreshError: readonly(remoteRefreshError),
    refreshRemoteCatTracker,
  }
}
