<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLive?: 'polite' | 'assertive'
    message: string
    tone?: 'primary' | 'danger'
  }>(),
  {
    ariaLive: 'polite',
    tone: 'primary',
  },
)

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Transition name="app-toast">
    <div
      v-if="message"
      class="app-toast"
      :class="`app-toast--${tone}`"
      :role="tone === 'danger' ? 'alert' : 'status'"
      :aria-live="ariaLive"
    >
      <span>{{ message }}</span>
      <button type="button" aria-label="關閉提示" @click="emit('close')">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.app-toast {
  position: fixed;
  z-index: 45;
  right: max(14px, calc((100vw - var(--content-width)) / 2 + 14px));
  bottom: calc(78px + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  max-width: min(340px, calc(100vw - 28px));
  box-sizing: border-box;
  border: 1px solid var(--toast-border);
  border-radius: 10px;
  padding: 10px 10px 10px 12px;
  background: var(--toast-background);
  color: var(--toast-text);
  box-shadow: 0 14px 38px var(--shadow-color);
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.45;
}

.app-toast--primary {
  --toast-border: color-mix(in srgb, var(--color-primary) 48%, var(--color-border));
  --toast-background: color-mix(in srgb, var(--color-primary) 86%, transparent);
  --toast-button-background: color-mix(in srgb, var(--color-on-primary) 16%, transparent);
  --toast-button-hover-background: color-mix(in srgb, var(--color-on-primary) 24%, transparent);
  --toast-text: var(--color-on-primary);
}

.app-toast--danger {
  --toast-border: color-mix(in srgb, var(--color-danger) 42%, var(--color-border));
  --toast-background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface));
  --toast-button-background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  --toast-button-hover-background: color-mix(in srgb, var(--color-danger) 20%, transparent);
  --toast-text: var(--color-danger);
}

.app-toast span {
  min-width: 0;
}

.app-toast button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: var(--toast-button-background);
  color: var(--toast-text);
  cursor: pointer;
  font: inherit;
  font-size: 1.1rem;
  line-height: 1;
}

.app-toast button:hover {
  background: var(--toast-button-hover-background);
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms ease;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
