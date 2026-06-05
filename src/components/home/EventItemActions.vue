<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'

const emit = defineEmits<{
  duplicate: []
  delete: []
}>()

const isOpen = ref(false)
const shouldOpenUpward = ref(false)
const actionRef = ref<HTMLElement>()

useClickOutside(actionRef, () => {
  isOpen.value = false
})

function toggleMenu(): void {
  if (!isOpen.value) {
    updateMenuPlacement()
  }

  isOpen.value = !isOpen.value
}

function deleteEvent(): void {
  isOpen.value = false
  emit('delete')
}

function duplicateEvent(): void {
  isOpen.value = false
  emit('duplicate')
}

function updateMenuPlacement(): void {
  const rect = actionRef.value?.getBoundingClientRect()

  if (!rect) {
    shouldOpenUpward.value = false
    return
  }

  const estimatedMenuHeight = 102
  const bottomSafeArea = 92
  shouldOpenUpward.value = rect.bottom + estimatedMenuHeight > window.innerHeight - bottomSafeArea
}
</script>

<template>
  <div ref="actionRef" class="event-item-actions">
    <button
      class="event-item-actions__trigger"
      type="button"
      aria-label="開啟紀錄選單"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      @click="toggleMenu"
    >
      <span aria-hidden="true">⋯</span>
    </button>

    <div
      v-if="isOpen"
      class="event-item-actions__menu"
      :class="{ 'event-item-actions__menu--up': shouldOpenUpward }"
      role="menu"
    >
      <button
        class="event-item-actions__item"
        type="button"
        role="menuitem"
        @click="duplicateEvent"
      >
        複製
      </button>
      <button class="event-item-actions__delete" type="button" role="menuitem" @click="deleteEvent">
        刪除
      </button>
    </div>
  </div>
</template>

<style scoped>
.event-item-actions {
  position: relative;
  display: grid;
  min-width: 0;
  border-left: 1px solid color-mix(in srgb, var(--category-color) 24%, var(--color-border));
}

.event-item-actions__trigger {
  display: grid;
  width: 100%;
  min-height: 100%;
  place-items: center;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--category-color) 82%, var(--color-text));
  cursor: pointer;
  font: inherit;
  font-size: 1.35rem;
  font-weight: 900;
  line-height: 1;
}

.event-item-actions__trigger:hover {
  background: color-mix(in srgb, var(--category-color) 10%, transparent);
}

.event-item-actions__trigger:focus-visible,
.event-item-actions__item:focus-visible,
.event-item-actions__delete:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.event-item-actions__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 4px;
  z-index: 4;
  display: grid;
  width: 112px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 14px 32px var(--shadow-color);
}

.event-item-actions__menu--up {
  top: auto;
  bottom: calc(100% + 6px);
}

.event-item-actions__item,
.event-item-actions__delete {
  min-height: 38px;
  border: 0;
  border-radius: 6px;
  padding: 0 12px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  text-align: left;
}

.event-item-actions__item:hover {
  background: color-mix(in srgb, var(--category-color) 10%, transparent);
}

.event-item-actions__delete {
  color: var(--color-danger);
}

.event-item-actions__delete:hover {
  background: color-mix(in srgb, var(--color-danger-strong) 10%, transparent);
}
</style>
