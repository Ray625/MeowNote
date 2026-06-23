import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CatEvent } from '@/types'

export const useEventEditorStore = defineStore('eventEditor', () => {
  const editingEventId = ref<string>()
  const draftEvent = ref<CatEvent>()
  const deleteConfirmEventId = ref<string>()

  function openDraft(event: CatEvent): void {
    draftEvent.value = event
    editingEventId.value = undefined
  }

  function openExisting(eventId: string): void {
    draftEvent.value = undefined
    editingEventId.value = eventId
  }

  function close(): void {
    draftEvent.value = undefined
    editingEventId.value = undefined
    deleteConfirmEventId.value = undefined
  }

  function requestDelete(eventId: string): void {
    deleteConfirmEventId.value = eventId
  }

  function cancelDelete(): void {
    deleteConfirmEventId.value = undefined
  }

  function replaceEventId(previousId: string, nextId: string): void {
    if (editingEventId.value === previousId) {
      editingEventId.value = nextId
    }

    if (deleteConfirmEventId.value === previousId) {
      deleteConfirmEventId.value = nextId
    }
  }

  return {
    editingEventId,
    draftEvent,
    deleteConfirmEventId,
    openDraft,
    openExisting,
    close,
    requestDelete,
    cancelDelete,
    replaceEventId,
  }
})
