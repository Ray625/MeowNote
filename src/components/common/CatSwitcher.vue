<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getCatAvatarOption, isDogAvatarId } from '@/constants/defaultData'
import { useClickOutside } from '@/composables/useClickOutside'
import { useCatTrackerStore } from '@/stores/catTracker'

const catTrackerStore = useCatTrackerStore()
const { cats, selectedCat, selectedCatId } = storeToRefs(catTrackerStore)
const isCatMenuOpen = ref(false)
const catSwitcherRef = ref<HTMLElement>()

useClickOutside(catSwitcherRef, () => {
  isCatMenuOpen.value = false
})

function toggleCatMenu(): void {
  isCatMenuOpen.value = !isCatMenuOpen.value
}

function selectCat(catId: string): void {
  catTrackerStore.selectCat(catId)
  isCatMenuOpen.value = false
}
</script>

<template>
  <div ref="catSwitcherRef" class="cat-switcher">
    <button
      class="selected-cat"
      type="button"
      :aria-expanded="isCatMenuOpen"
      aria-haspopup="listbox"
      @click="toggleCatMenu"
    >
      <span
        class="selected-cat__avatar selected-cat__avatar--plain"
        :class="{ 'selected-cat__avatar--dog': isDogAvatarId(selectedCat?.avatarId) }"
        aria-hidden="true"
      >
        <img
          :src="getCatAvatarOption(selectedCat?.avatarId).image"
          :alt="getCatAvatarOption(selectedCat?.avatarId).label"
        />
      </span>
      <strong class="cat-name">{{ selectedCat?.name ?? '我的貓' }}</strong>
      <span v-if="selectedCat?.isArchived" class="archived-badge">已停用</span>
      <span class="cat-switcher__chevron" aria-hidden="true">▾</span>
    </button>

    <div v-if="isCatMenuOpen" class="cat-menu" role="listbox" aria-label="選擇寵物">
      <button
        v-for="cat in cats"
        :key="cat.id"
        class="cat-menu__item"
        :class="{
          'cat-menu__item--archived': cat.isArchived,
          'cat-menu__item--selected': selectedCatId === cat.id,
        }"
        type="button"
        role="option"
        :aria-selected="selectedCatId === cat.id"
        @click="selectCat(cat.id)"
      >
        <span
          class="selected-cat__avatar"
          :class="{ 'selected-cat__avatar--dog': isDogAvatarId(cat.avatarId) }"
          aria-hidden="true"
        >
          <img :src="getCatAvatarOption(cat.avatarId).image" :alt="getCatAvatarOption(cat.avatarId).label" />
        </span>
        <span>
          {{ cat.name }}
          <small v-if="cat.isArchived">已停用</small>
        </span>
        <span class="cat-menu__check" aria-hidden="true">{{ selectedCatId === cat.id ? '✓' : '' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cat-switcher {
  position: relative;
  justify-self: start;
  min-width: 0;
  max-width: 100%;
}

.selected-cat {
  display: flex;
  width: 100%;
  max-width: 112px;
  min-width: 0;
  align-items: center;
  gap: 8px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.selected-cat:hover .cat-name {
  color: var(--color-primary-dark);
}

.selected-cat__avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 2px;
  background: var(--color-background);
}

.selected-cat__avatar--plain {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.selected-cat__avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.selected-cat__avatar--dog img {
  transform: scale(1.1);
}

.cat-name {
  min-width: 0;
  max-width: 56px;
  overflow: hidden;
  font-size: 1.125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-switcher__chevron {
  color: var(--color-muted);
  font-size: 0.875rem;
  line-height: 1;
}

.archived-badge {
  flex: 0 0 auto;
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.cat-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 7;
  display: grid;
  min-width: 190px;
  max-width: min(280px, calc(100vw - 28px));
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px var(--shadow-color);
}

.cat-menu__item {
  display: grid;
  grid-template-columns: 30px 1fr 18px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 6px 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.cat-menu__item:hover,
.cat-menu__item--selected {
  border-color: var(--color-border);
  background: var(--color-primary-light);
}

.cat-menu__item--archived {
  color: var(--color-muted);
}

.cat-menu__item--archived .selected-cat__avatar {
  opacity: 0.58;
}

.cat-menu__item span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-menu__item small {
  margin-left: 4px;
  color: var(--color-muted);
  font-size: 0.75rem;
}

.cat-menu__check {
  color: var(--color-primary);
  font-weight: 900;
  text-align: center;
}
</style>
