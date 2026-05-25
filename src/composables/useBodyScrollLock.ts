import { onBeforeUnmount, unref, watch, type MaybeRef } from 'vue'

let lockCount = 0
let scrollY = 0
let previousBodyOverflow = ''
let previousBodyPosition = ''
let previousBodyTop = ''
let previousBodyWidth = ''

function lockBodyScroll(): void {
  if (typeof document === 'undefined') {
    return
  }

  if (lockCount === 0) {
    scrollY = window.scrollY
    previousBodyOverflow = document.body.style.overflow
    previousBodyPosition = document.body.style.position
    previousBodyTop = document.body.style.top
    previousBodyWidth = document.body.style.width

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
  }

  lockCount += 1
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined' || lockCount === 0) {
    return
  }

  lockCount -= 1

  if (lockCount > 0) {
    return
  }

  document.body.style.overflow = previousBodyOverflow
  document.body.style.position = previousBodyPosition
  document.body.style.top = previousBodyTop
  document.body.style.width = previousBodyWidth
  window.scrollTo(0, scrollY)
}

export function useBodyScrollLock(isLocked: MaybeRef<boolean>): void {
  let isCurrentlyLocked = false

  watch(
    () => unref(isLocked),
    (nextIsLocked) => {
      if (nextIsLocked && !isCurrentlyLocked) {
        lockBodyScroll()
        isCurrentlyLocked = true
        return
      }

      if (!nextIsLocked && isCurrentlyLocked) {
        unlockBodyScroll()
        isCurrentlyLocked = false
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (isCurrentlyLocked) {
      unlockBodyScroll()
      isCurrentlyLocked = false
    }
  })
}
