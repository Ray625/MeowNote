<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'

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
const selectRef = ref<HTMLElement>()
const triggerRef = ref<HTMLButtonElement>()
const menuRef = ref<HTMLElement>()
const menuStyle = ref<CSSProperties>({})

watch(isOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  updateMenuPosition()
  menuRef.value
    ?.querySelector<HTMLElement>('.fixed-select__option--selected')
    ?.scrollIntoView({ block: 'nearest' })
})

onMounted(() => {
  document.addEventListener('pointerdown', closeFromOutside, true)
  document.addEventListener('keydown', closeFromEscape)
  window.addEventListener('resize', updateMenuPosition)
  window.addEventListener('scroll', updateMenuPosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeFromOutside, true)
  document.removeEventListener('keydown', closeFromEscape)
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
})

async function toggleMenu(): Promise<void> {
  isOpen.value = !isOpen.value

  if (isOpen.value) {
    await nextTick()
    updateMenuPosition()
  }
}

function selectOption(value: string): void {
  emit('update:modelValue', value)
  isOpen.value = false
  triggerRef.value?.focus()
}

function closeFromOutside(event: PointerEvent): void {
  const target = event.target

  if (
    !isOpen.value ||
    !(target instanceof Node) ||
    selectRef.value?.contains(target) ||
    menuRef.value?.contains(target)
  ) {
    return
  }

  isOpen.value = false
}

function closeFromEscape(event: KeyboardEvent): void {
  if (!isOpen.value || event.key !== 'Escape') {
    return
  }

  isOpen.value = false
  triggerRef.value?.focus()
}

function updateMenuPosition(): void {
  if (!isOpen.value || !triggerRef.value) {
    return
  }

  const viewportMargin = 12
  const menuGap = 8
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - triggerRect.bottom - viewportMargin - menuGap
  const spaceAbove = triggerRect.top - viewportMargin - menuGap
  const shouldOpenAbove = spaceBelow < 180 && spaceAbove > spaceBelow
  const availableHeight = Math.max(80, shouldOpenAbove ? spaceAbove : spaceBelow)
  const maxHeight = Math.min(320, Math.floor(availableHeight))
  const width = Math.min(triggerRect.width, window.innerWidth - viewportMargin * 2)
  const left = Math.min(
    Math.max(viewportMargin, triggerRect.left),
    window.innerWidth - viewportMargin - width,
  )

  menuStyle.value = {
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${maxHeight}px`,
    ...(shouldOpenAbove
      ? {
          bottom: `${Math.round(window.innerHeight - triggerRect.top + menuGap)}px`,
          top: 'auto',
        }
      : {
          top: `${Math.round(triggerRect.bottom + menuGap)}px`,
          bottom: 'auto',
        }),
  }
}
</script>

<template>
  <div ref="selectRef" class="fixed-select">
    <button
      ref="triggerRef"
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

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="fixed-select__menu"
        :style="menuStyle"
        role="listbox"
      >
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
    </Teleport>
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
  position: fixed;
  z-index: 60;
  display: grid;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
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
