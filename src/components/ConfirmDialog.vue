<script setup lang="ts">
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
  padding: 16px;
  background: rgba(23, 32, 27, 0.42);
}

.confirm-dialog {
  width: min(100%, 360px);
  padding: 18px;
  border: 1px solid #d8e0d8;
  border-radius: 12px;
  background: #ffffff;
  color: #17201b;
  box-shadow: 0 22px 60px rgba(23, 32, 27, 0.24);
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
  color: #65736a;
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
  --button-color: #b33a2b;
  --button-hover-color: #932f24;
}

.confirm-dialog__button--danger:focus-visible {
  outline-color: #e6a097;
}
</style>
