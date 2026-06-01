<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { useRemoteCatTrackerRefresh } from '@/composables/useRemoteCatTrackerRefresh'
import {
  importLocalCatTracker,
  type ImportLocalCatTrackerResult,
} from '@/services/importLocalCatTracker'
import { useCatTrackerStore } from '@/stores/catTracker'
import { readJson, removeJson, writeJson } from '@/utils/storage'

const REMEMBERED_EMAIL_STORAGE_KEY = 'meownote:remembered-email'

const catTrackerStore = useCatTrackerStore()
const { categories, cats, events, remoteCategorySyncError, remoteCatSyncError, remoteEventSyncError } =
  storeToRefs(catTrackerStore)
const {
  activeNotebookId,
  activeNotebookName,
  activeNotebookRole,
  authMessage,
  errorMessage,
  isConfigured,
  isLoading,
  isSignedIn,
  notebooks,
  refreshNotebooks,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  shareActiveNotebook,
  switchActiveNotebook,
  updateActiveNotebookName,
  user,
} = useRemoteAuth()
const { isBootstrappingRemoteData, refreshRemoteCatTracker, remoteRefreshError } =
  useRemoteCatTrackerRefresh()

const rememberedEmail = readJson<string>(REMEMBERED_EMAIL_STORAGE_KEY, '')
const signInEmail = ref(rememberedEmail)
const signInPassword = ref('')
const shouldRememberEmail = ref(Boolean(rememberedEmail))
const isEditingNotebookName = ref(false)
const notebookNameDraft = ref('')
const shareNotebookEmail = ref('')
const isImportingLocalData = ref(false)
const isLoadingRemoteData = ref(false)
const importResult = ref<ImportLocalCatTrackerResult>()
const importErrorMessage = ref('')
const remoteLoadMessage = ref('')
const remoteLoadErrorMessage = ref('')

const localImportSummary = computed(
  () =>
    `${cats.value.length} 隻寵物、${categories.value.length} 個分類、${events.value.length} 筆紀錄`,
)
const activeNotebookIdValue = computed(() => activeNotebookId.value)
const visibleNotebooks = computed(() => {
  const notebookById = new Map<string, (typeof notebooks.value)[number]>()

  for (const notebook of notebooks.value) {
    notebookById.set(notebook.id, notebook)
  }

  return Array.from(notebookById.values())
})

async function submitSignIn(): Promise<void> {
  rememberSignInEmail()

  if (await signInWithPassword(signInEmail.value, signInPassword.value)) {
    signInPassword.value = ''
  }
}

async function submitSignUp(): Promise<void> {
  rememberSignInEmail()

  if (await signUpWithPassword(signInEmail.value, signInPassword.value)) {
    signInPassword.value = ''
  }
}

async function submitSignOut(): Promise<void> {
  if (await signOut()) {
    signInPassword.value = ''
    closeNotebookNameEditor()
  }
}

function startEditNotebookName(): void {
  notebookNameDraft.value = activeNotebookName.value || ''
  isEditingNotebookName.value = true
}

function closeNotebookNameEditor(): void {
  isEditingNotebookName.value = false
  notebookNameDraft.value = ''
}

async function submitNotebookName(): Promise<void> {
  if (await updateActiveNotebookName(notebookNameDraft.value)) {
    closeNotebookNameEditor()
  }
}

function rememberSignInEmail(): void {
  const trimmedEmail = signInEmail.value.trim()

  signInEmail.value = trimmedEmail

  if (!shouldRememberEmail.value) {
    removeJson(REMEMBERED_EMAIL_STORAGE_KEY)
    return
  }

  if (trimmedEmail) {
    writeJson(REMEMBERED_EMAIL_STORAGE_KEY, trimmedEmail)
  }
}

async function submitLoadRemoteData(): Promise<void> {
  if (!activeNotebookId.value) {
    remoteLoadErrorMessage.value = 'Notebook 尚未建立完成'
    return
  }

  isLoadingRemoteData.value = true
  remoteLoadMessage.value = ''
  remoteLoadErrorMessage.value = ''

  try {
    await refreshRemoteCatTracker(catTrackerStore, activeNotebookId.value, { force: true })
    remoteLoadMessage.value = `已載入 ${cats.value.length} 隻寵物、${categories.value.length} 個分類、${events.value.length} 筆紀錄。`
  } catch (error) {
    remoteLoadErrorMessage.value = error instanceof Error ? error.message : '載入雲端資料失敗'
  } finally {
    isLoadingRemoteData.value = false
  }
}

async function submitImportLocalData(): Promise<void> {
  if (!activeNotebookId.value || !user.value) {
    importErrorMessage.value = 'Notebook 尚未建立完成'
    return
  }

  isImportingLocalData.value = true
  importResult.value = undefined
  importErrorMessage.value = ''
  remoteLoadMessage.value = ''
  remoteLoadErrorMessage.value = ''

  try {
    importResult.value = await importLocalCatTracker({
      notebookId: activeNotebookId.value,
      cats: cats.value,
      categories: categories.value,
      events: events.value,
      createdBy: user.value.id,
    })
  } catch (error) {
    importErrorMessage.value = error instanceof Error ? error.message : '匯入本機資料失敗'
  } finally {
    isImportingLocalData.value = false
  }
}

async function submitShareNotebook(): Promise<void> {
  if (await shareActiveNotebook(shareNotebookEmail.value)) {
    shareNotebookEmail.value = ''
    await refreshNotebooks()
  }
}

async function selectNotebook(notebookId: string): Promise<void> {
  if (notebookId === activeNotebookId.value) {
    return
  }

  await switchActiveNotebook(notebookId)
}

function getNotebookRoleLabel(role: string): string {
  return role === 'owner' ? '擁有者' : role === 'viewer' ? '唯讀成員' : '共享成員'
}
</script>

<template>
  <section class="notebook-view" aria-labelledby="notebook-title">
    <header class="notebook-header">
      <div>
        <h1 id="notebook-title">筆記本</h1>
        <p>管理帳戶、同步與共享</p>
      </div>
    </header>

    <section class="account-panel" aria-labelledby="account-title">
      <div class="account-panel__header">
        <h2 id="account-title">同步帳戶</h2>
        <span v-if="isSignedIn" class="account-badge">已登入</span>
        <span v-else class="account-badge account-badge--muted">未登入</span>
      </div>

      <p v-if="!isConfigured" class="account-message">
        Supabase 尚未設定，請確認 `.env.local` 已填入專案 URL 和 anon key。
      </p>

      <template v-else-if="isSignedIn">
        <section
          v-if="visibleNotebooks.length > 1"
          class="notebook-switcher"
          aria-labelledby="notebook-switcher-title"
        >
          <div class="notebook-switcher__header">
            <h3 id="notebook-switcher-title">切換 Notebook</h3>
            <span>{{ visibleNotebooks.length }} 本</span>
          </div>
          <div class="notebook-switcher__list">
            <button
              v-for="notebook in visibleNotebooks"
              :key="notebook.id"
              class="notebook-option"
              :class="{ 'notebook-option--active': notebook.id === activeNotebookIdValue }"
              type="button"
              :disabled="isLoading || notebook.id === activeNotebookIdValue"
              @click="selectNotebook(notebook.id)"
            >
              <span>
                <strong>{{ notebook.name }}</strong>
                <small>{{ getNotebookRoleLabel(notebook.role) }}</small>
              </span>
              <em>{{ notebook.id === activeNotebookIdValue ? '使用中' : '切換' }}</em>
            </button>
          </div>
        </section>

        <div class="account-details">
          <span>Email</span>
          <strong>{{ user?.email }}</strong>
          <span>Notebook</span>
          <strong>{{ activeNotebookName || '建立中' }}</strong>
          <span>權限</span>
          <strong>{{ activeNotebookRole === 'owner' ? '擁有者' : '共享成員' }}</strong>
          <span>本機資料</span>
          <strong>{{ localImportSummary }}</strong>
          <span>同步狀態</span>
          <strong>{{ isBootstrappingRemoteData ? '同步中' : '已連線' }}</strong>
        </div>

        <form
          v-if="isEditingNotebookName && activeNotebookRole === 'owner'"
          class="notebook-name-form"
          @submit.prevent="submitNotebookName"
        >
          <label class="field">
            <span class="field__label">Notebook 名稱</span>
            <input
              v-model="notebookNameDraft"
              class="field__control"
              type="text"
              autocomplete="off"
              required
              maxlength="80"
            />
          </label>
          <div class="notebook-name-form__actions">
            <button
              class="ui-button ui-button--primary account-button"
              type="submit"
              :disabled="isLoading || !activeNotebookId"
            >
              儲存名稱
            </button>
            <button
              class="ui-button ui-button--secondary account-button"
              type="button"
              :disabled="isLoading"
              @click="closeNotebookNameEditor"
            >
              取消
            </button>
          </div>
        </form>

        <button
          v-else-if="activeNotebookRole === 'owner'"
          class="ui-button ui-button--secondary account-button"
          type="button"
          :disabled="isLoading || !activeNotebookId"
          @click="startEditNotebookName"
        >
          編輯 Notebook 名稱
        </button>

        <form
          v-if="activeNotebookRole === 'owner'"
          class="notebook-share-form"
          @submit.prevent="submitShareNotebook"
        >
          <label class="field">
            <span class="field__label">分享 Notebook</span>
            <input
              v-model="shareNotebookEmail"
              class="field__control"
              type="email"
              autocomplete="off"
              inputmode="email"
              placeholder="輸入對方註冊 Email"
              required
            />
          </label>
          <button
            class="ui-button ui-button--secondary account-button"
            type="submit"
            :disabled="isLoading || !activeNotebookId"
          >
            分享給使用者
          </button>
          <p class="account-message">
            共享成員可以查看這本 Notebook，並新增自己的紀錄；只能編輯或刪除自己建立的紀錄。
          </p>
        </form>

        <button
          class="ui-button ui-button--primary account-button"
          type="button"
          :disabled="
            isLoading || isImportingLocalData || isBootstrappingRemoteData || !activeNotebookId
          "
          @click="submitImportLocalData"
        >
          {{ isImportingLocalData ? '上傳中' : '上傳本機資料' }}
        </button>

        <button
          class="ui-button ui-button--secondary account-button"
          type="button"
          :disabled="
            isLoading || isLoadingRemoteData || isBootstrappingRemoteData || !activeNotebookId
          "
          @click="submitLoadRemoteData"
        >
          {{ isLoadingRemoteData ? '載入中' : '載入雲端資料' }}
        </button>

        <p v-if="importResult" class="account-message">
          已匯入 {{ importResult.catsImported }} 隻寵物、{{ importResult.categoriesImported }}
          個分類、{{ importResult.eventsImported }} 筆紀錄。
          <template v-if="importResult.eventsSkipped > 0">
            有 {{ importResult.eventsSkipped }} 筆紀錄因找不到寵物或分類而略過。
          </template>
        </p>
        <p v-if="importErrorMessage" class="account-message account-message--error">
          {{ importErrorMessage }}
        </p>
        <p v-if="remoteLoadMessage" class="account-message">
          {{ remoteLoadMessage }}
        </p>
        <p v-if="remoteLoadErrorMessage" class="account-message account-message--error">
          {{ remoteLoadErrorMessage }}
        </p>
        <p v-if="remoteRefreshError" class="account-message account-message--error">
          自動同步失敗：{{ remoteRefreshError }}
        </p>
        <p v-if="remoteEventSyncError" class="account-message account-message--error">
          事件同步失敗：{{ remoteEventSyncError }}
        </p>
        <p v-if="remoteCatSyncError" class="account-message account-message--error">
          寵物同步失敗：{{ remoteCatSyncError }}
        </p>
        <p v-if="remoteCategorySyncError" class="account-message account-message--error">
          分類同步失敗：{{ remoteCategorySyncError }}
        </p>

        <button
          class="ui-button ui-button--secondary account-button"
          type="button"
          :disabled="isLoading"
          @click="submitSignOut"
        >
          登出
        </button>
      </template>

      <form v-else class="account-form" @submit.prevent="submitSignIn">
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
        <label class="toggle-field account-remember-field">
          <input v-model="shouldRememberEmail" type="checkbox" />
          <span>記住 Email</span>
        </label>
        <button class="ui-button ui-button--primary account-button" type="submit" :disabled="isLoading">
          {{ isLoading ? '登入中' : '登入' }}
        </button>
        <button
          class="ui-button ui-button--secondary account-button"
          type="button"
          :disabled="isLoading"
          @click="submitSignUp"
        >
          註冊
        </button>
      </form>

      <p v-if="authMessage" class="account-message">{{ authMessage }}</p>
      <p v-if="errorMessage" class="account-message account-message--error">
        {{ errorMessage }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.notebook-view {
  display: grid;
  width: var(--content-width);
  gap: 12px;
  margin: 0 auto;
}

.notebook-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.notebook-header h1,
.notebook-header p,
.account-panel h2,
.account-message {
  margin: 0;
}

.notebook-header h1 {
  font-size: 1.4rem;
}

.notebook-header p,
.account-details span,
.account-message {
  color: var(--color-muted);
}

.account-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.account-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.account-panel h2 {
  font-size: 1.05rem;
}

.account-badge {
  padding: 4px 8px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 36%, var(--color-border));
  border-radius: 999px;
  background: var(--color-primary-light);
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 700;
}

.account-badge--muted {
  border-color: var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
}

.account-form,
.notebook-name-form,
.notebook-share-form {
  display: grid;
  gap: 12px;
}

.notebook-switcher {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.notebook-switcher__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.notebook-switcher__header h3 {
  margin: 0;
  font-size: 0.95rem;
}

.notebook-switcher__header span {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.notebook-switcher__list {
  display: grid;
  gap: 8px;
}

.notebook-option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.notebook-option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-primary-light);
}

.notebook-option:disabled {
  cursor: default;
}

.notebook-option--active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.notebook-option span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.notebook-option strong,
.notebook-option small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notebook-option small {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.notebook-option em {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-style: normal;
  font-weight: 800;
}

.notebook-option--active em {
  color: var(--color-text);
}

.account-form .field,
.notebook-name-form .field,
.notebook-share-form .field {
  display: grid;
  gap: 8px;
}

.account-form .field__control,
.notebook-name-form .field__control,
.notebook-share-form .field__control {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.account-button {
  min-height: 42px;
}

.account-remember-field {
  justify-self: start;
  font-size: 0.875rem;
}

.notebook-name-form__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 12px;
  min-width: 0;
}

.account-details strong {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-message {
  font-size: 0.875rem;
}

.account-message--error {
  color: var(--color-danger);
}
</style>
