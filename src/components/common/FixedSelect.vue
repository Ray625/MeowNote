<script setup lang="ts">
import { ref } from 'vue'

export interface FixedSelectOption {
  value: string
  label: string
}

defineProps<{
  modelValue: string
  options: FixedSelectOption[]
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)

function toggleMenu(): void {
  isOpen.value = !isOpen.value
}

function selectOption(value: string): void {
  emit('update:modelValue', value)
  isOpen.value = false
}

function closeOnFocusOut(event: FocusEvent): void {
  const currentTarget = event.currentTarget
  const nextTarget = event.relatedTarget

  if (
    currentTarget instanceof HTMLElement &&
    nextTarget instanceof Node &&
    currentTarget.contains(nextTarget)
  ) {
    return
  }

  isOpen.value = false
}
</script>

<template>
  <div class="fixed-select" @focusout="closeOnFocusOut">
    <button
      class="fixed-select__trigger"
      type="button"
      :disabled="disabled || options.length === 0"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggleMenu"
    >
      <span class="fixed-select__value">
        {{ options.find((option) => option.value === modelValue)?.label ?? placeholder ?? '請選擇' }}
      </span>
      <span class="fixed-select__chevron" aria-hidden="true">▾</span>
    </button>

    <div v-if="isOpen" class="fixed-select__menu" role="listbox">
      <button
        v-for="option in options"
        :key="option.value"
        class="fixed-select__option"
        :class="{ 'fixed-select__option--selected': option.value === modelValue }"
        type="button"
        role="option"
        :aria-selected="option.value === modelValue"
        @click="selectOption(option.value)"
      >
        <span class="fixed-select__check" aria-hidden="true">
          {{ option.value === modelValue ? '✓' : '' }}
        </span>
        <span class="fixed-select__label">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.fixed-select {
  position: relative;
  min-width: 0;
}

.fixed-select__trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.fixed-select__trigger:disabled {
  background: var(--color-disabled-surface);
  color: var(--color-muted);
  cursor: not-allowed;
}

.fixed-select__value {
  min-width: 0;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fixed-select__chevron {
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1;
}

.fixed-select__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 20;
  display: grid;
  max-height: min(320px, 42dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.fixed-select__option {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 38px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-align: left;
}

.fixed-select__option:hover,
.fixed-select__option--selected {
  border-color: var(--color-border-strong);
  background: var(--color-primary-light);
}

.fixed-select__check {
  color: var(--color-primary);
  font-weight: 900;
}

.fixed-select__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
