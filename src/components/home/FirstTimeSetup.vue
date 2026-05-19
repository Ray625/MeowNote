<script setup lang="ts">
import { ref } from 'vue'
import {
  CAT_AVATAR_OPTIONS,
  DEFAULT_CAT_AVATAR_ID,
  getCatAvatarOption,
} from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CatAvatarId } from '@/types'

const catTrackerStore = useCatTrackerStore()

const catName = ref('')
const catAvatarId = ref<CatAvatarId>(DEFAULT_CAT_AVATAR_ID)

function selectCatAvatar(avatarId: CatAvatarId): void {
  catAvatarId.value = avatarId
}

function startTracking(): void {
  const trimmedName = catName.value.trim()

  if (!trimmedName) {
    return
  }

  catTrackerStore.createCat({
    name: trimmedName,
    avatarId: catAvatarId.value,
  })
}
</script>

<template>
  <section class="first-time-setup" aria-labelledby="first-time-setup-title">
    <form class="setup-form" @submit.prevent="startTracking">
      <div class="setup-preview" aria-hidden="true">
        <img
          :src="getCatAvatarOption(catAvatarId).image"
          :alt="getCatAvatarOption(catAvatarId).label"
        />
      </div>

      <div class="field">
        <label id="first-time-setup-title" class="setup-title" for="first-cat-name">
          你的貓叫什麼名字？
        </label>
        <input
          id="first-cat-name"
          v-model="catName"
          class="field__control"
          type="text"
          autocomplete="off"
          autofocus
          maxlength="24"
          placeholder="名字"
          required
        />
      </div>

      <div class="field">
        <span class="field__label">選擇花色</span>
        <div class="cat-avatar-options" role="radiogroup" aria-label="選擇花色">
          <button
            v-for="avatar in CAT_AVATAR_OPTIONS"
            :key="avatar.id"
            class="cat-avatar-option"
            :class="{ 'cat-avatar-option--selected': catAvatarId === avatar.id }"
            type="button"
            role="radio"
            :aria-checked="catAvatarId === avatar.id"
            :aria-label="avatar.label"
            :title="avatar.label"
            @click="selectCatAvatar(avatar.id)"
          >
            <span class="pet-avatar pet-avatar--option" aria-hidden="true">
              <img :src="avatar.image" :alt="avatar.label" />
            </span>
            <span>{{ avatar.label }}</span>
          </button>
        </div>
      </div>

      <button class="ui-button ui-button--primary setup-submit" type="submit" :disabled="!catName.trim()">
        開始記錄
      </button>
    </form>
  </section>
</template>

<style scoped>
.first-time-setup {
  display: grid;
  width: var(--content-width);
  flex: 1;
  place-items: center;
  margin: 0 auto;
}

.setup-form {
  display: grid;
  width: 100%;
  gap: 18px;
  box-sizing: border-box;
  padding: 22px 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.setup-preview {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  justify-self: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 6px;
  background: var(--color-background);
}

.setup-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.setup-title {
  color: var(--color-text);
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.25;
}

.field {
  display: grid;
  gap: 8px;
}

.field__label {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 700;
}

.field__control {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.field__control:focus {
  border-color: var(--color-primary);
  outline: 3px solid var(--color-focus);
}

.cat-avatar-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.cat-avatar-option {
  display: grid;
  gap: 6px;
  min-width: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 4px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
}

.cat-avatar-option:hover,
.cat-avatar-option--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.pet-avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 3px;
  background: var(--color-background);
}

.pet-avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.pet-avatar--option {
  width: 36px;
  height: 36px;
}

.setup-submit {
  min-height: 46px;
}

.setup-submit:disabled {
  cursor: default;
  opacity: 0.62;
}

@media (max-width: 560px) {
  .first-time-setup {
    align-items: start;
    padding-top: 24px;
  }
}
</style>
