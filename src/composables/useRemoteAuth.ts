import { computed, readonly, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { readJson, writeJson } from '@/utils/storage'

const ACTIVE_NOTEBOOK_STORAGE_KEY = 'meownote:active-notebook-id'

const user = ref<User | null>(null)
const activeNotebookId = ref(readJson<string>(ACTIVE_NOTEBOOK_STORAGE_KEY, ''))
const isLoading = ref(false)
const errorMessage = ref('')
const authMessage = ref('')
let isInitialized = false

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

function setSession(session: Session | null): void {
  user.value = session?.user ?? null

  if (!session?.user) {
    activeNotebookId.value = ''
    writeJson(ACTIVE_NOTEBOOK_STORAGE_KEY, '')
  }
}

async function loadFirstNotebook(): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const { data, error } = await supabase
    .from('notebook_members')
    .select('notebook_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.notebook_id ?? ''
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

async function ensureActiveNotebook(): Promise<string> {
  if (activeNotebookId.value) {
    return activeNotebookId.value
  }

  const notebookId = (await loadFirstNotebook()) || (await createNotebook())

  activeNotebookId.value = notebookId
  writeJson(ACTIVE_NOTEBOOK_STORAGE_KEY, notebookId)

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

  async function signInWithPassword(email: string, password: string): Promise<void> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return
    }

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      errorMessage.value = '請輸入 Email'
      return
    }

    if (!password) {
      errorMessage.value = '請輸入密碼'
      return
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
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '登入失敗')
    } finally {
      isLoading.value = false
    }
  }

  async function signUpWithPassword(email: string, password: string): Promise<void> {
    if (!supabase) {
      errorMessage.value = 'Supabase 尚未設定'
      return
    }

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      errorMessage.value = '請輸入 Email'
      return
    }

    if (password.length < 6) {
      errorMessage.value = '密碼至少需要 6 個字元'
      return
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
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '註冊失敗')
    } finally {
      isLoading.value = false
    }
  }

  async function signOut(): Promise<void> {
    if (!supabase) {
      return
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }

      setSession(null)
      authMessage.value = ''
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '登出失敗')
    } finally {
      isLoading.value = false
    }
  }

  return {
    activeNotebookId: readonly(activeNotebookId),
    errorMessage: readonly(errorMessage),
    authMessage: readonly(authMessage),
    isConfigured: isSupabaseConfigured,
    isLoading: readonly(isLoading),
    isSignedIn,
    user: readonly(user),
    ensureActiveNotebook,
    initializeAuth,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  }
}
