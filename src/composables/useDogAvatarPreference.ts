import { readonly, ref, watch } from 'vue'
import { readJson, writeJson } from '@/utils/storage'

const DOG_AVATAR_MODE_STORAGE_KEY = 'meownote:dog-avatar-mode'

const isDogAvatarMode = ref(readJson<boolean>(DOG_AVATAR_MODE_STORAGE_KEY, false))

watch(
  isDogAvatarMode,
  () => {
    writeJson<boolean>(DOG_AVATAR_MODE_STORAGE_KEY, isDogAvatarMode.value)
  },
  { immediate: true },
)

export function useDogAvatarPreference() {
  function setDogAvatarMode(value: boolean): void {
    isDogAvatarMode.value = value
  }

  return {
    isDogAvatarMode: readonly(isDogAvatarMode),
    setDogAvatarMode,
  }
}
