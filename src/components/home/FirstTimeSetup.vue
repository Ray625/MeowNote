<script setup lang="ts">
import { ref } from 'vue'
import {
  CAT_AVATAR_OPTIONS,
  CATEGORY_GROUP_ORDER,
  CATEGORY_TEMPLATES,
  DEFAULT_CAT_AVATAR_ID,
  getCatAvatarOption,
} from '@/constants/defaultData'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CatAvatarId } from '@/types'

const catTrackerStore = useCatTrackerStore()

type SetupStep = 'profile' | 'templates'

const catName = ref('')
const catAvatarId = ref<CatAvatarId>(DEFAULT_CAT_AVATAR_ID)
const selectedTemplateIds = ref<string[]>(['water', 'medication'])
const setupStep = ref<SetupStep>('profile')

const groupedTemplates = CATEGORY_GROUP_ORDER.map((group) => ({
  group,
  templates: CATEGORY_TEMPLATES.filter((template) => template.group === group),
})).filter((item) => item.templates.length > 0)

function selectCatAvatar(avatarId: CatAvatarId): void {
  catAvatarId.value = avatarId
}

function toggleTemplate(templateId: string): void {
  if (selectedTemplateIds.value.includes(templateId)) {
    selectedTemplateIds.value = selectedTemplateIds.value.filter((id) => id !== templateId)
    return
  }

  selectedTemplateIds.value = [...selectedTemplateIds.value, templateId]
}

function goToTemplateStep(): void {
  if (!catName.value.trim()) {
    return
  }

  setupStep.value = 'templates'
}

function goToProfileStep(): void {
  setupStep.value = 'profile'
}

function startTracking(): void {
  const trimmedName = catName.value.trim()

  if (!trimmedName) {
    setupStep.value = 'profile'
    return
  }

  catTrackerStore.createCat({
    name: trimmedName,
    avatarId: catAvatarId.value,
  })

  CATEGORY_TEMPLATES.filter((template) => selectedTemplateIds.value.includes(template.id)).forEach(
    (template) => {
      catTrackerStore.createCategory({
        templateId: template.id,
        name: template.name,
        group: template.group,
        colorId: template.colorId,
        isQuickAction: true,
        isArchived: false,
        statisticsMode: template.statisticsMode,
        valueLabel: template.valueLabel,
        valueUnit: template.valueUnit,
      })
    },
  )
}
</script>

<template>
  <section class="first-time-setup" aria-labelledby="first-time-setup-title">
    <form
      class="setup-form"
      @submit.prevent="setupStep === 'profile' ? goToTemplateStep() : startTracking()"
    >
      <div class="setup-preview" aria-hidden="true">
        <img
          :src="getCatAvatarOption(catAvatarId).image"
          :alt="getCatAvatarOption(catAvatarId).label"
        />
      </div>

      <template v-if="setupStep === 'profile'">
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

        <button
          class="ui-button ui-button--primary setup-submit"
          type="submit"
          :disabled="!catName.trim()"
        >
          下一步
        </button>
      </template>

      <template v-else>
        <div class="field">
          <label id="first-time-setup-title" class="setup-title">想紀錄哪些項目？</label>
          <div class="template-groups">
            <section v-for="group in groupedTemplates" :key="group.group" class="template-group">
              <h2>{{ group.group }}</h2>
              <div class="template-options">
                <button
                  v-for="template in group.templates"
                  :key="template.id"
                  class="template-option"
                  :class="{
                    'template-option--selected': selectedTemplateIds.includes(template.id),
                  }"
                  type="button"
                  :aria-pressed="selectedTemplateIds.includes(template.id)"
                  @click="toggleTemplate(template.id)"
                >
                  {{ template.name }}
                </button>
              </div>
            </section>
          </div>
        </div>

        <div class="setup-actions">
          <button
            class="ui-button ui-button--secondary setup-submit"
            type="button"
            @click="goToProfileStep"
          >
            上一步
          </button>
          <button class="ui-button ui-button--primary setup-submit" type="submit">開始記錄</button>
        </div>
      </template>
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

.template-groups {
  display: grid;
  gap: 10px;
}

.template-group {
  display: grid;
  gap: 8px;
}

.template-group h2 {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.875rem;
}

.template-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.template-option--selected {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-background);
}

@media (hover: hover) and (pointer: fine) {
  .template-option:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    color: var(--color-text);
  }
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

.setup-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
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
