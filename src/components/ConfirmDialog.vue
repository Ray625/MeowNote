<script setup lang="ts">
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'

withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'default' | 'danger'
  }>(),
  {
    confirmLabel: '確認',
    cancelLabel: '取消',
    tone: 'default',
  },
)

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

useBodyScrollLock(true)
</script>

<template>
  <div class="confirm-backdrop" role="presentation" @click.self="emit('cancel')">
    <section
      class="confirm-dialog"
      :class="`confirm-dialog--${tone}`"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      role="dialog"
      aria-modal="true"
    >
      <div class="confirm-dialog__body">
        <h2 id="confirm-dialog-title" class="confirm-dialog__title">{{ title }}</h2>
        <p id="confirm-dialog-message" class="confirm-dialog__message">{{ message }}</p>
      </div>

      <div class="confirm-dialog__actions">
        <button
          class="ui-button ui-button--secondary confirm-dialog__button"
          type="button"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          class="ui-button confirm-dialog__button"
          :class="
            tone === 'danger'
              ? 'ui-button--primary confirm-dialog__button--danger'
              : 'ui-button--primary'
          "
          type="button"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  background: var(--overlay-color);
}

.confirm-dialog {
  width: min(100%, 360px);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 22px 60px var(--shadow-color);
}

.confirm-dialog__body {
  display: grid;
  gap: 8px;
}

.confirm-dialog__title,
.confirm-dialog__message {
  margin: 0;
}

.confirm-dialog__title {
  font-size: 1.125rem;
  line-height: 1.25;
}

.confirm-dialog__message {
  color: var(--color-muted);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.confirm-dialog__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
}

.confirm-dialog__button {
  min-height: 42px;
}

.confirm-dialog__button--danger {
  --button-color: var(--color-danger-strong);
  --button-hover-color: var(--color-danger-strong-dark);
}

.confirm-dialog__button--danger:focus-visible {
  outline-color: var(--color-danger-focus);
}
</style>
