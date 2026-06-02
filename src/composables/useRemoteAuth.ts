import { computed, readonly, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { skipNextLocalImportForNotebook } from '@/composables/useRemoteCatTrackerRefresh'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { rememberSignedOutNotebookCache } from '@/services/localUnsyncedChanges'
import { readJson, writeJson } from '@/utils/storage'

const ACTIVE_NOTEBOOK_STORAGE_KEY = 'meownote:active-notebook-id'
const ACTIVE_NOTEBOOK_NAME_STORAGE_KEY = 'meownote:active-notebook-name'

export interface RemoteNotebook {
  id: string
  name: string
  role: string
}

interface NotebookMemberRow {
  notebook_id: string
  role: string
  notebooks: {
    name: string
  } | null
}

const user = ref<User | null>(null)
const activeNotebookId = ref(readJson<string>(ACTIVE_NOTEBOOK_STORAGE_KEY, ''))
const activeNotebookName = ref(readJson<string>(ACTIVE_NOTEBOOK_NAME_STORAGE_KEY, ''))
const activeNotebookRole = ref('')
const notebooks = ref<RemoteNotebook[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const authMessage = ref('')
let isInitialized = false
let ensureActiveNotebookPromise: Promise<string> | null = null

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string' && message) {
      return message
    }
  }

  return fallback
}

function getRolePriority(role: string): number {
  return role === 'owner' ? 3 : role === 'editor' ? 2 : role === 'viewer' ? 1 : 0
}

function normalizeNotebooks(items: RemoteNotebook[]): RemoteNotebook[] {
  const notebookById = new Map<string, RemoteNotebook>()

  for (const notebook of items) {
    const existing = notebookById.get(notebook.id)

    if (!existing || getRolePriority(notebook.role) > getRolePriority(existing.role)) {
      notebookById.set(notebook.id, notebook)
    }
  }

  return Array.from(notebookById.values())
}

function setSession(session: Session | null): void {
  user.value = session?.user ?? null

  if (!session?.user) {
    activeNotebookId.value = ''
    activeNotebookName.value = ''
    activeNotebookRole.value = ''
    notebooks.value = []
    writeJson(ACTIVE_NOTEBOOK_STORAGE_KEY, '')
    writeJson(ACTIVE_NOTEBOOK_NAME_STORAGE_KEY, '')
  }
}

async function loadNotebooks(): Promise<RemoteNotebook[]> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('notebook_members')
    .select('notebook_id, role, notebooks(name)')
    .eq('user_id', user.value?.id ?? '')
    .order('created_at', { ascending: true })
    .returns<NotebookMemberRow[]>()

  if (error) {
    throw error
  }

  return normalizeNotebooks(
    data.map((row) => ({
      id: row.notebook_id,
      name: row.notebooks?.name ?? '未命名 Notebook',
      role: row.role,
    })),
  )
}

async function loadNotebookRole(notebookId: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('notebook_members')
    .select('role')
    .eq('notebook_id', notebookId)
    .eq('user_id', user.value?.id ?? '')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.role ?? ''
}

async function loadNotebookName(notebookId: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('notebooks')
    .select('name')
    .eq('id', notebookId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.name ?? ''
}

async function createNotebook(name = '我的貓咪紀錄'): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase.rpc('create_notebook', {
    notebook_name: name,
  })

  if (error) {
    throw error
  }

  return String(data)
}

function setActiveNotebook(notebook: RemoteNotebook): void {
  activeNotebookId.value = notebook.id
  activeNotebookName.value = notebook.name
  activeNotebookRole.value = notebook.role
  writeJson(ACTIVE_NOTEBOOK_STORAGE_KEY, notebook.id)
  writeJson(ACTIVE_NOTEBOOK_NAME_STORAGE_KEY, notebook.name)
}

async function activateFallbackNotebook(): Promise<void> {
  notebooks.value = await loadNotebooks()

  if (notebooks.value.length === 0) {
    const notebookId = await createNotebook()

    skipNextLocalImportForNotebook(notebookId)
    notebooks.value = await loadNotebooks()
    const createdNotebook = notebooks.value.find((notebook) => notebook.id === notebookId)

    if (createdNotebook) {
      setActiveNotebook(createdNotebook)
      return
    }
  }

  const nextNotebook = notebooks.value[0]

  if (nextNotebook) {
    setActiveNotebook(nextNotebook)
    return
  }

  activeNotebookId.value = ''
  activeNotebookName.value = ''
  activeNotebookRole.value = ''
  writeJson(ACTIVE_NOTEBOOK_STORAGE_KEY, '')
  writeJson(ACTIVE_NOTEBOOK_NAME_STORAGE_KEY, '')
}

async function ensureActiveNotebook(): Promise<string> {
  if (ensureActiveNotebookPromise) {
    return ensureActiveNotebookPromise
  }

  ensureActiveNotebookPromise = ensureActiveNotebookInternal().finally(() => {
    ensureActiveNotebookPromise = null
  })

  return ensureActiveNotebookPromise
}

async function ensureActiveNotebookInternal(): Promise<string> {
  notebooks.value = await loadNotebooks()

  if (
    activeNotebookId.value &&
    notebooks.value.some((notebook) => notebook.id === activeNotebookId.value)
  ) {
    activeNotebookName.value = await loadNotebookName(activeNotebookId.value)
    activeNotebookRole.value = await loadNotebookRole(activeNotebookId.value)
    writeJson(ACTIVE_NOTEBOOK_NAME_STORAGE_KEY, activeNotebookName.value)

    return activeNotebookId.value
  }

  const firstNotebook = notebooks.value[0]
  const notebookId = firstNotebook?.id || (await createNotebook())

  if (!firstNotebook) {
    notebooks.value = await loadNotebooks()
  }

  const notebookName = firstNotebook?.name ?? (await loadNotebookName(notebookId))
  const notebookRole = firstNotebook?.role ?? (await loadNotebookRole(notebookId))

  setActiveNotebook({
    id: notebookId,
    name: notebookName,
    role: notebookRole,
  })

  return notebookId
}

async function refreshSession(): Promise<void> {
  if (!supabase) {
    return
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  setSession(data.session)

  if (data.session?.user) {
    await ensureActiveNotebook()
  }
}

export function useRemoteAuth() {
  const isSignedIn = computed(() => Boolean(user.value))

  async function initializeAuth(): Promise<void> {
    if (isInitialized) {
      return
    }

    isInitialized = true

    if (!supabase) {
      return
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      await refreshSession()

      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)

        if (session?.user) {
          window.setTimeout(() => {
            ensureActiveNotebook().catch((error: unknown) => {
              errorMessage.value = getErrorMessage(error, '建立同步空間失敗')
            })
          }, 0)
        }
      })
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '讀取登入狀態失敗')
    } finally {
      isLoading.value = false
    }
  }

  async function signInWithPassword(email: string, password: string): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      errorMessage.value = '請輸入 Email'
      return false
    }

    if (!password) {
      errorMessage.value = '請輸入密碼'
      return false
    }

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        throw error
      }

      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '登入失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function signUpWithPassword(email: string, password: string): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      errorMessage.value = '請輸入 Email'
      return false
    }

    if (password.length < 6) {
      errorMessage.value = '密碼至少需要 6 個字元'
      return false
    }

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const emailRedirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo,
        },
      })

      if (error) {
        throw error
      }

      authMessage.value = data.session
        ? '註冊成功，已登入。'
        : '註冊成功，請到信箱確認 Email 後再登入。'
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '註冊失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function signOut(): Promise<boolean> {
    if (!supabase) {
      return false
    }

    const signedOutUserId = user.value?.id ?? ''
    const signedOutNotebookId = activeNotebookId.value
    const signedOutNotebookRole = activeNotebookRole.value

    isLoading.value = true
    errorMessage.value = ''

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }

      rememberSignedOutNotebookCache({
        userId: signedOutUserId,
        notebookId: signedOutNotebookId,
        notebookRole: signedOutNotebookRole,
      })
      setSession(null)
      authMessage.value = ''
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '登出失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function updatePassword(currentPassword: string, nextPassword: string): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    const email = user.value?.email

    if (!email) {
      errorMessage.value = '請先登入後再修改密碼'
      return false
    }

    if (!currentPassword) {
      errorMessage.value = '請輸入目前密碼'
      return false
    }

    if (nextPassword.length < 6) {
      errorMessage.value = '新密碼至少需要 6 個字元'
      return false
    }

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        throw signInError
      }

      const { error } = await supabase.auth.updateUser({
        password: nextPassword,
      })

      if (error) {
        throw error
      }

      authMessage.value = '密碼已更新。'
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '更新密碼失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function updateActiveNotebookName(name: string): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    const trimmedName = name.trim()

    if (!activeNotebookId.value) {
      errorMessage.value = 'Notebook 尚未建立完成'
      return false
    }

    if (!trimmedName) {
      errorMessage.value = '請輸入 Notebook 名稱'
      return false
    }

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ name: trimmedName })
        .eq('id', activeNotebookId.value)

      if (error) {
        throw error
      }

      activeNotebookName.value = trimmedName
      notebooks.value = notebooks.value.map((notebook) =>
        notebook.id === activeNotebookId.value ? { ...notebook, name: trimmedName } : notebook,
      )
      writeJson(ACTIVE_NOTEBOOK_NAME_STORAGE_KEY, trimmedName)
      authMessage.value = 'Notebook 名稱已更新。'
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '更新 Notebook 名稱失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function shareActiveNotebook(email: string): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    const trimmedEmail = email.trim()

    if (!activeNotebookId.value) {
      errorMessage.value = 'Notebook 尚未建立完成'
      return false
    }

    if (activeNotebookRole.value !== 'owner') {
      errorMessage.value = '只有 Notebook 擁有者可以分享'
      return false
    }

    if (!trimmedEmail) {
      errorMessage.value = '請輸入要分享的 Email'
      return false
    }

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const { error } = await supabase.rpc('share_notebook_with_user', {
        target_notebook_id: activeNotebookId.value,
        target_email: trimmedEmail,
        member_role: 'editor',
      })

      if (error) {
        throw error
      }

      authMessage.value = `已分享給 ${trimmedEmail}。`
      await refreshNotebooks()
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '分享 Notebook 失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function createPersonalNotebook(name = '我的貓咪紀錄'): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    const normalizedName = name.trim() || '我的貓咪紀錄'

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const notebookId = await createNotebook(normalizedName)

      notebooks.value = await loadNotebooks()
      const notebook = notebooks.value.find((item) => item.id === notebookId)

      if (!notebook) {
        throw new Error('Notebook 已建立，但無法讀取')
      }

      skipNextLocalImportForNotebook(notebook.id)
      setActiveNotebook(notebook)
      authMessage.value = `已建立 ${notebook.name}，並設為預設 Notebook。`
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '新增 Notebook 失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function leaveActiveNotebook(): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    if (!activeNotebookId.value) {
      errorMessage.value = 'Notebook 尚未建立完成'
      return false
    }

    if (activeNotebookRole.value === 'owner') {
      errorMessage.value = '擁有者不能離開自己的 Notebook'
      return false
    }

    const leavingNotebookName = activeNotebookName.value

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const { error } = await supabase.rpc('leave_shared_notebook', {
        target_notebook_id: activeNotebookId.value,
      })

      if (error) {
        throw error
      }

      await activateFallbackNotebook()
      authMessage.value = `已離開 ${leavingNotebookName || '共享 Notebook'}。`
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '離開共享 Notebook 失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function deleteActiveNotebookWithoutEvents(): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    if (!activeNotebookId.value) {
      errorMessage.value = 'Notebook 尚未建立完成'
      return false
    }

    if (activeNotebookRole.value !== 'owner') {
      errorMessage.value = '只有 Notebook 擁有者可以刪除'
      return false
    }

    const deletedNotebookName = activeNotebookName.value

    isLoading.value = true
    errorMessage.value = ''
    authMessage.value = ''

    try {
      const { error } = await supabase.rpc('delete_owned_notebook_without_events', {
        target_notebook_id: activeNotebookId.value,
      })

      if (error) {
        throw error
      }

      await activateFallbackNotebook()
      authMessage.value = `已刪除 ${deletedNotebookName || 'Notebook'}。`
      return true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '刪除 Notebook 失敗')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function refreshNotebooks(): Promise<void> {
    if (!supabase || !user.value) {
      notebooks.value = []
      return
    }

    notebooks.value = await loadNotebooks()
  }

  async function switchActiveNotebook(notebookId: string): Promise<boolean> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return false
    }

    const notebook = notebooks.value.find((item) => item.id === notebookId)

    if (!notebook) {
      errorMessage.value = '找不到這本 Notebook'
      return false
    }

    setActiveNotebook(notebook)
    authMessage.value = `已將 ${notebook.name} 設為這台裝置的預設 Notebook。`

    return true
  }

  return {
    activeNotebookId: readonly(activeNotebookId),
    activeNotebookName: readonly(activeNotebookName),
    activeNotebookRole: readonly(activeNotebookRole),
    errorMessage: readonly(errorMessage),
    authMessage: readonly(authMessage),
    isConfigured: isSupabaseConfigured,
    isLoading: readonly(isLoading),
    isSignedIn,
    notebooks: readonly(notebooks),
    user: readonly(user),
    createPersonalNotebook,
    deleteActiveNotebookWithoutEvents,
    ensureActiveNotebook,
    initializeAuth,
    leaveActiveNotebook,
    refreshNotebooks,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    shareActiveNotebook,
    switchActiveNotebook,
    updateActiveNotebookName,
    updatePassword,
  }
}
