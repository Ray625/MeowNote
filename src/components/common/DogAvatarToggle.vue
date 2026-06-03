<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <button
    class="dog-avatar-toggle"
    :class="{ 'dog-avatar-toggle--active': modelValue }"
    type="button"
    :aria-pressed="modelValue"
    @click="emit('update:modelValue', !modelValue)"
  >
    我是狗派
  </button>
</template>

<style scoped>
.dog-avatar-toggle {
  min-height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0 12px;
  background: var(--color-surface);
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.dog-avatar-toggle:hover,
.dog-avatar-toggle--active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-text);
}
</style>
