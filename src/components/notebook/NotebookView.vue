<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useRemoteAuth } from '@/composables/useRemoteAuth'
import { useRemoteCatTrackerRefresh } from '@/composables/useRemoteCatTrackerRefresh'
import { useCatTrackerStore } from '@/stores/catTracker'
import { readJson, removeJson, writeJson } from '@/utils/storage'

const REMEMBERED_EMAIL_STORAGE_KEY = 'meownote:remembered-email'

const catTrackerStore = useCatTrackerStore()
const {
  categories,
  cats,
  events,
  remoteCategorySyncError,
  remoteCatSyncError,
  remoteEventSyncError,
} = storeToRefs(catTrackerStore)
const {
  activeNotebookId,
  activeNotebookName,
  activeNotebookRole,
  authMessage,
  createPersonalNotebook,
  deleteActiveNotebookWithoutEvents,
  errorMessage,
  isConfigured,
  isLoading,
  isSignedIn,
  leaveActiveNotebook,
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
const { isBootstrappingRemoteData, remoteRefreshError } = useRemoteCatTrackerRefresh()

const rememberedEmail = readJson<string>(REMEMBERED_EMAIL_STORAGE_KEY, '')
const signInEmail = ref(rememberedEmail)
const signInPassword = ref('')
const shouldRememberEmail = ref(Boolean(rememberedEmail))
const isEditingNotebookName = ref(false)
const isCreatingNotebook = ref(false)
const isNotebookMenuOpen = ref(false)
const isSharingNotebook = ref(false)
const notebookNameDraft = ref('')
const newNotebookName = ref('')
const shareNotebookEmail = ref('')
const pendingNotebookAction = ref<'delete' | 'leave' | ''>('')
const notebookMenuRef = ref<HTMLElement | null>(null)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof window.setTimeout> | undefined

const localImportSummary = computed(
  () => `${cats.value.length} 隻寵物、${events.value.length} 筆紀錄`,
)
const activeNotebookIdValue = computed(() => activeNotebookId.value)
const activeRoleLabel = computed(() => getNotebookRoleLabel(activeNotebookRole.value))
const canDeleteActiveNotebook = computed(
  () => activeNotebookRole.value === 'owner' && events.value.length === 0,
)
const canEditActiveNotebookName = computed(
  () => activeNotebookRole.value === 'owner' && Boolean(activeNotebookId.value),
)
const shouldShowNotebookManagement = computed(
  () => visibleNotebooks.value.length > 1 || activeNotebookRole.value !== 'owner',
)
const isNotebookFormOpen = computed(
  () => isCreatingNotebook.value || isEditingNotebookName.value || isSharingNotebook.value,
)
const notebookConfirmDialog = computed(() => {
  if (pendingNotebookAction.value === 'delete') {
    return {
      title: '刪除這本筆記簿？',
      message: '沒有紀錄的筆記簿會連同寵物與分類設定一起刪除，刪除後無法復原。',
      confirmLabel: '刪除',
      cancelLabel: '保留',
      tone: 'danger' as const,
    }
  }

  if (pendingNotebookAction.value === 'leave') {
    return {
      title: '離開共享筆記簿？',
      message: '離開後會從你的列表移除；需要擁有者重新分享才能再次使用。',
      confirmLabel: '離開',
      cancelLabel: '取消',
      tone: 'default' as const,
    }
  }

  return null
})
const visibleNotebooks = computed(() => {
  const notebookById = new Map<string, (typeof notebooks.value)[number]>()

  for (const notebook of notebooks.value) {
    notebookById.set(notebook.id, notebook)
  }

  return Array.from(notebookById.values())
})

useBodyScrollLock(isNotebookFormOpen)

onMounted(() => {
  document.addEventListener('pointerdown', closeNotebookMenuWhenClickingOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeNotebookMenuWhenClickingOutside)
  clearToastTimer()
})

watch(authMessage, (message) => {
  if (!message) {
    return
  }

  showToast(message)
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
    closeNotebookMenu()
    closeNotebookForm()
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
    closeNotebookForm()
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

async function submitShareNotebook(): Promise<void> {
  if (await shareActiveNotebook(shareNotebookEmail.value)) {
    closeNotebookForm()
    await refreshNotebooks()
  }
}

async function submitCreateNotebook(): Promise<void> {
  if (await createPersonalNotebook(newNotebookName.value)) {
    closeNotebookForm()
  }
}

function toggleNotebookMenu(): void {
  isNotebookMenuOpen.value = !isNotebookMenuOpen.value
}

function closeNotebookMenu(): void {
  isNotebookMenuOpen.value = false
}

function closeNotebookMenuWhenClickingOutside(event: PointerEvent): void {
  if (!isNotebookMenuOpen.value) {
    return
  }

  const target = event.target

  if (target instanceof Node && notebookMenuRef.value?.contains(target)) {
    return
  }

  closeNotebookMenu()
}

function startCreateNotebookFromMenu(): void {
  closeNotebookMenu()
  closeNotebookForm()
  isCreatingNotebook.value = true
}

function startEditNotebookNameFromMenu(): void {
  closeNotebookMenu()
  closeNotebookForm()
  startEditNotebookName()
}

function startShareNotebookFromMenu(): void {
  closeNotebookMenu()
  closeNotebookForm()
  isSharingNotebook.value = true
}

function closeCreateNotebook(): void {
  isCreatingNotebook.value = false
  newNotebookName.value = ''
}

function closeShareNotebook(): void {
  isSharingNotebook.value = false
  shareNotebookEmail.value = ''
}

function closeNotebookForm(): void {
  closeCreateNotebook()
  closeNotebookNameEditor()
  closeShareNotebook()
}

function clearToastTimer(): void {
  if (toastTimer) {
    window.clearTimeout(toastTimer)
    toastTimer = undefined
  }
}

function showToast(message: string): void {
  toastMessage.value = message
  clearToastTimer()
  toastTimer = window.setTimeout(() => {
    dismissToast()
  }, 2800)
}

function dismissToast(): void {
  toastMessage.value = ''
  clearToastTimer()
}

function openLeaveNotebookConfirm(): void {
  pendingNotebookAction.value = 'leave'
}

function openDeleteNotebookConfirm(): void {
  pendingNotebookAction.value = 'delete'
}

function cancelNotebookConfirm(): void {
  pendingNotebookAction.value = ''
}

async function confirmNotebookAction(): Promise<void> {
  const action = pendingNotebookAction.value

  pendingNotebookAction.value = ''

  if (action === 'delete') {
    await deleteActiveNotebookWithoutEvents()
    return
  }

  if (action === 'leave') {
    await leaveActiveNotebook()
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
        <h1 id="notebook-title">帳戶</h1>
        <p>管理帳戶與共享</p>
      </div>
      <div v-if="isConfigured && isSignedIn" ref="notebookMenuRef" class="notebook-header__menu">
        <button
          class="ui-button ui-button--primary notebook-header__button"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="isNotebookMenuOpen"
          @click="toggleNotebookMenu"
        >
          管理筆記簿
        </button>
        <div v-if="isNotebookMenuOpen" class="notebook-action-menu" role="menu">
          <button type="button" role="menuitem" @click="startCreateNotebookFromMenu">
            新增筆記簿
          </button>
          <button
            v-if="activeNotebookRole === 'owner'"
            type="button"
            role="menuitem"
            :disabled="!canEditActiveNotebookName"
            @click="startEditNotebookNameFromMenu"
          >
            編輯名稱
          </button>
          <button
            v-if="activeNotebookRole === 'owner'"
            type="button"
            role="menuitem"
            :disabled="!activeNotebookId"
            @click="startShareNotebookFromMenu"
          >
            分享筆記簿
          </button>
        </div>
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
          v-if="shouldShowNotebookManagement"
          class="notebook-switcher"
          aria-labelledby="notebook-switcher-title"
        >
          <div class="notebook-switcher__header">
            <h3 id="notebook-switcher-title">筆記簿管理</h3>
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
              <em>{{ notebook.id === activeNotebookIdValue ? '使用中' : '設為預設' }}</em>
            </button>
          </div>

          <div class="notebook-danger-zone">
            <template v-if="activeNotebookRole === 'owner'">
              <button
                class="ui-button ui-button--danger account-button"
                type="button"
                :disabled="isLoading || !canDeleteActiveNotebook"
                @click="openDeleteNotebookConfirm"
              >
                刪除這本筆記簿
              </button>
              <p class="account-message">只有沒有紀錄、沒有共享成員的個人筆記簿可以刪除。</p>
            </template>
            <template v-else>
              <button
                class="ui-button ui-button--secondary account-button"
                type="button"
                :disabled="isLoading || !activeNotebookId"
                @click="openLeaveNotebookConfirm"
              >
                離開共享筆記簿
              </button>
              <p class="account-message">
                離開後會從你的列表移除；需要擁有者重新分享才能再次使用。
              </p>
            </template>
          </div>
        </section>

        <div class="account-details">
          <span>Email</span>
          <strong>{{ user?.email }}</strong>
          <span>筆記簿</span>
          <strong>{{ activeNotebookName || '建立中' }}</strong>
          <span>權限</span>
          <strong>{{ activeRoleLabel }}</strong>
          <span>本機資料</span>
          <strong>{{ localImportSummary }}</strong>
          <span>同步狀態</span>
          <strong>{{ isBootstrappingRemoteData ? '同步中' : '已連線' }}</strong>
        </div>

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
        <button
          class="ui-button ui-button--primary account-button"
          type="submit"
          :disabled="isLoading"
        >
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

      <p v-if="errorMessage" class="account-message account-message--error">
        {{ errorMessage }}
      </p>
    </section>

    <Transition name="account-toast">
      <div v-if="toastMessage" class="account-toast" role="status" aria-live="polite">
        <span>{{ toastMessage }}</span>
        <button type="button" aria-label="關閉提示" @click="dismissToast">×</button>
      </div>
    </Transition>

    <div
      v-if="isNotebookFormOpen"
      class="notebook-form-backdrop"
      role="presentation"
      @click.self="closeNotebookForm"
    >
      <section class="notebook-form-dialog" role="dialog" aria-modal="true">
        <form
          v-if="isCreatingNotebook"
          class="new-notebook-form"
          @submit.prevent="submitCreateNotebook"
        >
          <h2>新增筆記簿</h2>
          <label class="field">
            <span class="field__label">名稱</span>
            <input
              v-model="newNotebookName"
              class="field__control"
              type="text"
              autocomplete="off"
              maxlength="80"
              placeholder="我的貓咪紀錄"
            />
          </label>
          <div class="notebook-form-dialog__actions">
            <button
              class="ui-button ui-button--secondary account-button"
              type="button"
              :disabled="isLoading"
              @click="closeNotebookForm"
            >
              取消
            </button>
            <button
              class="ui-button ui-button--primary account-button"
              type="submit"
              :disabled="isLoading"
            >
              新增
            </button>
          </div>
        </form>

        <form
          v-else-if="isEditingNotebookName && activeNotebookRole === 'owner'"
          class="notebook-name-form"
          @submit.prevent="submitNotebookName"
        >
          <h2>編輯名稱</h2>
          <label class="field">
            <span class="field__label">筆記簿名稱</span>
            <input
              v-model="notebookNameDraft"
              class="field__control"
              type="text"
              autocomplete="off"
              required
              maxlength="80"
            />
          </label>
          <div class="notebook-form-dialog__actions">
            <button
              class="ui-button ui-button--secondary account-button"
              type="button"
              :disabled="isLoading"
              @click="closeNotebookForm"
            >
              取消
            </button>
            <button
              class="ui-button ui-button--primary account-button"
              type="submit"
              :disabled="isLoading || !activeNotebookId"
            >
              儲存
            </button>
          </div>
        </form>

        <form
          v-else-if="isSharingNotebook && activeNotebookRole === 'owner'"
          class="notebook-share-form"
          @submit.prevent="submitShareNotebook"
        >
          <h2>分享筆記簿</h2>
          <label class="field">
            <span class="field__label">對方註冊 Email</span>
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
          <p class="account-message">
            共享成員可以查看這本筆記簿，並新增自己的紀錄；只能編輯或刪除自己建立的紀錄。
          </p>
          <div class="notebook-form-dialog__actions">
            <button
              class="ui-button ui-button--secondary account-button"
              type="button"
              :disabled="isLoading"
              @click="closeNotebookForm"
            >
              取消
            </button>
            <button
              class="ui-button ui-button--primary account-button"
              type="submit"
              :disabled="isLoading || !activeNotebookId"
            >
              分享
            </button>
          </div>
        </form>
      </section>
    </div>

    <ConfirmDialog
      v-if="notebookConfirmDialog"
      :title="notebookConfirmDialog.title"
      :message="notebookConfirmDialog.message"
      :confirm-label="notebookConfirmDialog.confirmLabel"
      :cancel-label="notebookConfirmDialog.cancelLabel"
      :tone="notebookConfirmDialog.tone"
      @cancel="cancelNotebookConfirm"
      @confirm="confirmNotebookAction"
    />
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

.notebook-header__button {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 10px;
  font-size: 0.875rem;
  white-space: nowrap;
}

.notebook-header__menu {
  position: relative;
  flex: 0 0 auto;
}

.notebook-action-menu {
  position: absolute;
  z-index: 12;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  width: max-content;
  min-width: 150px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 14px 36px var(--shadow-color);
}

.notebook-action-menu button {
  min-height: 42px;
  border: 0;
  padding: 8px 12px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-align: left;
}

.notebook-action-menu button:hover:not(:disabled) {
  background: var(--color-primary-light);
}

.notebook-action-menu button:disabled {
  color: var(--color-muted);
  cursor: not-allowed;
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
.new-notebook-form,
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
.new-notebook-form .field,
.notebook-share-form .field {
  display: grid;
  gap: 8px;
}

.account-form .field__control,
.notebook-name-form .field__control,
.new-notebook-form .field__control,
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

.new-notebook-form__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.notebook-danger-zone {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.notebook-form-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  background: var(--overlay-color);
}

.notebook-form-dialog {
  width: min(100%, 390px);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 22px 60px var(--shadow-color);
}

.notebook-form-dialog h2 {
  margin: 0;
  font-size: 1.125rem;
}

.notebook-form-dialog__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-toast {
  position: fixed;
  z-index: 40;
  right: max(14px, calc((100vw - var(--content-width)) / 2 + 14px));
  bottom: calc(78px + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  max-width: min(320px, calc(100vw - 28px));
  padding: 10px 10px 10px 12px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 48%, var(--color-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary) 86%, transparent);
  color: var(--color-on-primary);
  box-shadow: 0 14px 38px var(--shadow-color);
  font-size: 0.875rem;
  font-weight: 800;
}

.account-toast span {
  min-width: 0;
}

.account-toast button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-on-primary) 16%, transparent);
  color: var(--color-on-primary);
  cursor: pointer;
  font: inherit;
  font-size: 1.1rem;
  line-height: 1;
}

.account-toast button:hover {
  background: color-mix(in srgb, var(--color-on-primary) 24%, transparent);
}

.account-toast-enter-active,
.account-toast-leave-active {
  transition:
    opacity 500ms ease,
    transform 500ms ease;
}

.account-toast-enter-from,
.account-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
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
