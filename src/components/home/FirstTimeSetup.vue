<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppToast from '@/components/common/AppToast.vue'
import DogAvatarToggle from '@/components/common/DogAvatarToggle.vue'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import {
  CAT_AVATAR_OPTIONS,
  CATEGORY_GROUP_ORDER,
  CATEGORY_TEMPLATES,
  DEFAULT_CAT_AVATAR_ID,
  DOG_AVATAR_OPTIONS,
  getCatAvatarOption,
  isDogAvatarId,
} from '@/constants/defaultData'
import { useDogAvatarPreference } from '@/composables/useDogAvatarPreference'
import { useCatTrackerStore } from '@/stores/catTracker'
import type { CatAvatarId } from '@/types'

const catTrackerStore = useCatTrackerStore()
const { isDogAvatarMode, setDogAvatarMode: setStoredDogAvatarMode } = useDogAvatarPreference()
const { errorMessage, isConfigured, isLoading, isSignedIn, signInWithPassword } = useRemoteAuth()

type SetupStep = 'entry' | 'login' | 'profile' | 'templates'

const signInEmail = ref('')
const signInPassword = ref('')
const catName = ref('')
const catAvatarId = ref<CatAvatarId>(DEFAULT_CAT_AVATAR_ID)
const selectedTemplateIds = ref<string[]>(['water', 'medication'])
const setupStep = ref<SetupStep>(isSignedIn.value ? 'profile' : 'entry')
const toastMessage = ref('')
let toastTimer: ReturnType<typeof window.setTimeout> | undefined

const visibleCatAvatarOptions = computed(() =>
  isDogAvatarMode.value ? DOG_AVATAR_OPTIONS : CAT_AVATAR_OPTIONS,
)
const petNameTitle = computed(() =>
  isDogAvatarMode.value ? '你的狗叫什麼名字？' : '你的貓叫什麼名字？',
)

const groupedTemplates = CATEGORY_GROUP_ORDER.map((group) => ({
  group,
  templates: CATEGORY_TEMPLATES.filter((template) => template.group === group),
})).filter((item) => item.templates.length > 0)

watch(
  isDogAvatarMode,
  (value) => {
    ensureAvatarMatchesDogMode(value)
  },
  { immediate: true },
)

watch(errorMessage, (message) => {
  if (!message) {
    return
  }

  showToast(message)
})

watch(
  isSignedIn,
  (signedIn) => {
    if (signedIn && (setupStep.value === 'entry' || setupStep.value === 'login')) {
      setupStep.value = 'profile'
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  dismissToast()
})

function goToLoginStep(): void {
  setupStep.value = 'login'
}

function goToEntryStep(): void {
  setupStep.value = isSignedIn.value ? 'profile' : 'entry'
}

function goToLocalProfileStep(): void {
  setupStep.value = 'profile'
}

async function submitSignIn(): Promise<void> {
  if (await signInWithPassword(signInEmail.value, signInPassword.value)) {
    signInPassword.value = ''
  }
}

function selectCatAvatar(avatarId: CatAvatarId): void {
  catAvatarId.value = avatarId
}

function setDogAvatarMode(nextValue: boolean): void {
  setStoredDogAvatarMode(nextValue)
  ensureAvatarMatchesDogMode(nextValue)
}

function ensureAvatarMatchesDogMode(nextValue: boolean): void {
  const avatarOptions = nextValue ? DOG_AVATAR_OPTIONS : CAT_AVATAR_OPTIONS
  if (!avatarOptions.some((avatar) => avatar.id === catAvatarId.value)) {
    catAvatarId.value = avatarOptions[0]?.id ?? DEFAULT_CAT_AVATAR_ID
  }
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

function showToast(message: string): void {
  toastMessage.value = message

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    dismissToast()
  }, 3200)
}

function dismissToast(): void {
  toastMessage.value = ''

  if (toastTimer) {
    window.clearTimeout(toastTimer)
    toastTimer = undefined
  }
}
</script>

<template>
  <section class="first-time-setup" aria-labelledby="first-time-setup-title">
    <form
      class="setup-form"
      @submit.prevent="
        setupStep === 'login'
          ? submitSignIn()
          : setupStep === 'profile'
            ? goToTemplateStep()
            : startTracking()
      "
    >
      <template v-if="setupStep === 'entry'">
        <div class="setup-entry">
          <h1 id="first-time-setup-title">使用MeowNote快速紀錄</h1>
          <div class="setup-entry__avatars" aria-hidden="true">
            <span class="setup-entry__avatar">
              <img
                :src="getCatAvatarOption('orange').image"
                :alt="getCatAvatarOption('orange').label"
              />
            </span>
            <span class="setup-entry__avatar setup-entry__avatar--dog">
              <img
                :src="getCatAvatarOption('dog-mixed').image"
                :alt="getCatAvatarOption('dog-mixed').label"
              />
            </span>
          </div>
        </div>

        <button
          class="ui-button ui-button--primary setup-submit"
          type="button"
          :disabled="!isConfigured"
          @click="goToLoginStep"
        >
          登入已有帳號
        </button>
        <button
          class="ui-button ui-button--secondary setup-submit"
          type="button"
          @click="goToLocalProfileStep"
        >
          尚無帳號，直接開始紀錄
        </button>
        <p v-if="!isConfigured" class="setup-message setup-message--error">
          Supabase 尚未設定，暫時只能先在本機開始記錄。
        </p>
      </template>

      <template v-else-if="setupStep === 'login'">
        <div class="setup-entry">
          <h1 id="first-time-setup-title">登入已有帳號</h1>
        </div>

        <label class="field">
          <span class="field__label">Email</span>
          <input
            v-model="signInEmail"
            class="field__control"
            type="email"
            autocomplete="email"
            inputmode="email"
            required
          />
        </label>
        <label class="field">
          <span class="field__label">密碼</span>
          <input
            v-model="signInPassword"
            class="field__control"
            type="password"
            autocomplete="current-password"
            required
            minlength="6"
          />
        </label>

        <div class="setup-actions">
          <button
            class="ui-button ui-button--secondary setup-submit"
            type="button"
            :disabled="isLoading"
            @click="goToEntryStep"
          >
            返回
          </button>
          <button
            class="ui-button ui-button--primary setup-submit"
            type="submit"
            :disabled="isLoading"
          >
            {{ isLoading ? '登入中' : '登入' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div
          class="setup-preview"
          :class="{ 'setup-preview--dog': isDogAvatarId(catAvatarId) }"
          aria-hidden="true"
        >
          <img
            :src="getCatAvatarOption(catAvatarId).image"
            :alt="getCatAvatarOption(catAvatarId).label"
          />
        </div>

        <template v-if="setupStep === 'profile'">
          <div class="field">
            <label id="first-time-setup-title" class="setup-title" for="first-cat-name">
              {{ petNameTitle }}
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
            <div class="cat-avatar-header">
              <span class="field__label">選擇花色</span>
              <DogAvatarToggle
                :model-value="isDogAvatarMode"
                @update:model-value="setDogAvatarMode"
              />
            </div>
            <div
              class="cat-avatar-options"
              role="radiogroup"
              :aria-label="isDogAvatarMode ? '選擇狗狗頭貼' : '選擇貓咪花色'"
            >
              <button
                v-for="avatar in visibleCatAvatarOptions"
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
                <span
                  class="pet-avatar pet-avatar--option"
                  :class="{ 'pet-avatar--dog': isDogAvatarId(avatar.id) }"
                  aria-hidden="true"
                >
                  <img :src="avatar.image" :alt="avatar.label" />
                </span>
              </button>
            </div>
          </div>

          <div class="setup-actions" :class="{ 'setup-actions--single': isSignedIn }">
            <button
              v-if="!isSignedIn"
              class="ui-button ui-button--secondary setup-submit"
              type="button"
              @click="goToEntryStep"
            >
              返回
            </button>
            <button
              class="ui-button ui-button--primary setup-submit"
              type="submit"
              :disabled="!catName.trim()"
            >
              下一步
            </button>
          </div>
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
            <button class="ui-button ui-button--primary setup-submit" type="submit">
              開始記錄
            </button>
          </div>
        </template>
      </template>
    </form>
    <AppToast :message="toastMessage" tone="danger" @close="dismissToast" />
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

.setup-entry {
  display: grid;
  justify-items: center;
  gap: 14px;
  text-align: center;
}

.setup-entry h1,
.setup-entry p {
  margin: 0;
}

.setup-entry h1 {
  color: var(--color-text);
  font-size: 1.55rem;
  font-weight: 900;
  line-height: 1.2;
}

.setup-entry__avatars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.setup-entry__avatar {
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 6px;
  background: var(--color-background);
}

.setup-entry__avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.setup-entry__avatar--dog img {
  transform: scale(1.1);
}

.setup-entry p,
.setup-message {
  color: var(--color-muted);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.setup-message {
  margin: 0;
}

.setup-message--error {
  color: var(--color-danger);
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

.setup-preview--dog img {
  transform: scale(1.1);
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

.cat-avatar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
  min-height: 82px;
  min-width: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
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

.pet-avatar--dog img {
  transform: scale(1.1);
}

.pet-avatar--option {
  width: 56px;
  height: 56px;
}

.setup-submit {
  min-height: 46px;
}

.setup-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.setup-actions--single {
  grid-template-columns: 1fr;
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
