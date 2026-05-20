import { readonly, ref, watch } from 'vue'
import { readJson, writeJson } from '@/utils/storage'

const THEME_STORAGE_KEY = 'meownote:theme'

type ThemeMode = 'light' | 'dark'

const isDarkMode = ref(readStoredTheme() === 'dark')

function readStoredTheme(): ThemeMode {
  return readJson<ThemeMode>(THEME_STORAGE_KEY, 'light')
}

function applyTheme(): void {
  document.documentElement.dataset.theme = isDarkMode.value ? 'dark' : 'light'
}

watch(
  isDarkMode,
  () => {
    applyTheme()
    writeJson<ThemeMode>(THEME_STORAGE_KEY, isDarkMode.value ? 'dark' : 'light')
  },
  { immediate: true },
)

export function useTheme() {
  function setDarkMode(value: boolean): void {
    isDarkMode.value = value
  }

  function toggleDarkMode(): void {
    isDarkMode.value = !isDarkMode.value
  }

  return {
    isDarkMode: readonly(isDarkMode),
    setDarkMode,
    toggleDarkMode,
  }
}
