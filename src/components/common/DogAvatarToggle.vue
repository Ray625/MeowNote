<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <div class="pet-avatar-toggle" role="group" aria-label="選擇寵物派別">
    <button
      class="pet-avatar-toggle__option"
      :class="{ 'pet-avatar-toggle__option--active': !modelValue }"
      type="button"
      :aria-pressed="!modelValue"
      @click="emit('update:modelValue', false)"
    >
      我是貓派
    </button>
    <button
      class="pet-avatar-toggle__option"
      :class="{ 'pet-avatar-toggle__option--active': modelValue }"
      type="button"
      :aria-pressed="modelValue"
      @click="emit('update:modelValue', true)"
    >
      我是狗派
    </button>
  </div>
</template>

<style scoped>
.pet-avatar-toggle {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
}

.pet-avatar-toggle__option {
  min-height: 32px;
  border: 0;
  padding: 0 12px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.pet-avatar-toggle__option:hover,
.pet-avatar-toggle__option--active {
  background: var(--color-primary-light);
  color: var(--color-text);
}

.pet-avatar-toggle__option--active {
  color: var(--color-primary-dark);
}
</style>
