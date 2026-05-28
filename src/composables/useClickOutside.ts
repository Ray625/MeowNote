import { onBeforeUnmount, onMounted, type Ref } from 'vue'

type MaybeElementRef = Ref<HTMLElement | null | undefined>

export function useClickOutside(target: MaybeElementRef, onOutsideClick: () => void): void {
  function handlePointerDown(event: PointerEvent): void {
    const element = target.value
    const eventTarget = event.target

    if (!element || !(eventTarget instanceof Node) || element.contains(eventTarget)) {
      return
    }

    onOutsideClick()
  }

  onMounted(() => {
    document.addEventListener('pointerdown', handlePointerDown, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handlePointerDown, true)
  })
}
