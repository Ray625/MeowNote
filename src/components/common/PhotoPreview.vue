<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'

export interface PreviewPhoto {
  key: string
  src: string
  alt: string
}

const MIN_SCALE = 1
const MAX_SCALE = 4

const props = defineProps<{
  photos: PreviewPhoto[]
  index: number
  canDelete?: boolean
}>()

const emit = defineEmits<{
  close: []
  delete: []
  'update:index': [index: number]
}>()

const stageRef = ref<HTMLElement>()
const scale = ref(MIN_SCALE)
const translateX = ref(0)
const translateY = ref(0)
const swipeOffset = ref(0)
const isInteracting = ref(false)
const gestureMode = ref<'none' | 'swipe' | 'pan' | 'pinch'>('none')
const gestureStartX = ref(0)
const gestureStartY = ref(0)
const gestureStartTranslateX = ref(0)
const gestureStartTranslateY = ref(0)
const pinchStartDistance = ref(0)
const pinchStartScale = ref(MIN_SCALE)
const pinchStartMidpointX = ref(0)
const pinchStartMidpointY = ref(0)
const lastTapAt = ref(0)

useBodyScrollLock(true)

const canShowPreviousPhoto = computed(() => props.index > 0)
const canShowNextPhoto = computed(() => props.index < props.photos.length - 1)
const isZoomed = computed(() => scale.value > MIN_SCALE)
const trackStyle = computed(() => ({
  transform: `translate3d(calc(${-props.index * 100}% + ${swipeOffset.value}px), 0, 0)`,
  transition: isInteracting.value ? 'none' : undefined,
}))
const activeImageStyle = computed(() => ({
  transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
  transition: isInteracting.value ? 'none' : undefined,
}))

watch(
  () => props.index,
  () => {
    resetView()
  },
)

watch(
  () => props.photos.length,
  (photoCount) => {
    if (photoCount === 0) {
      emit('close')
      return
    }

    if (props.index >= photoCount) {
      emit('update:index', photoCount - 1)
    }
  },
)

function showPreviousPhoto(): void {
  if (!canShowPreviousPhoto.value) {
    return
  }

  resetView()
  emit('update:index', props.index - 1)
}

function showNextPhoto(): void {
  if (!canShowNextPhoto.value) {
    return
  }

  resetView()
  emit('update:index', props.index + 1)
}

function resetView(): void {
  scale.value = MIN_SCALE
  translateX.value = 0
  translateY.value = 0
  swipeOffset.value = 0
  gestureMode.value = 'none'
  isInteracting.value = false
}

function handleTouchStart(event: TouchEvent): void {
  if (event.touches.length >= 2) {
    const [firstTouch, secondTouch] = event.touches

    if (!firstTouch || !secondTouch) {
      return
    }

    gestureMode.value = 'pinch'
    isInteracting.value = true
    swipeOffset.value = 0
    pinchStartDistance.value = getTouchDistance(firstTouch, secondTouch)
    pinchStartScale.value = scale.value
    const midpoint = getTouchMidpoint(firstTouch, secondTouch)
    pinchStartMidpointX.value = midpoint.x
    pinchStartMidpointY.value = midpoint.y
    gestureStartTranslateX.value = translateX.value
    gestureStartTranslateY.value = translateY.value
    return
  }

  const touch = event.touches[0]

  if (!touch) {
    return
  }

  isInteracting.value = true
  gestureStartX.value = touch.clientX
  gestureStartY.value = touch.clientY

  if (isZoomed.value) {
    gestureMode.value = 'pan'
    gestureStartTranslateX.value = translateX.value
    gestureStartTranslateY.value = translateY.value
  } else {
    gestureMode.value = 'swipe'
    swipeOffset.value = 0
  }
}

function handleTouchMove(event: TouchEvent): void {
  if (gestureMode.value === 'pinch' && event.touches.length >= 2) {
    const [firstTouch, secondTouch] = event.touches

    if (!firstTouch || !secondTouch || pinchStartDistance.value <= 0) {
      return
    }

    const distance = getTouchDistance(firstTouch, secondTouch)
    const nextScale = clamp(
      pinchStartScale.value * (distance / pinchStartDistance.value),
      MIN_SCALE,
      MAX_SCALE,
    )
    const midpoint = getTouchMidpoint(firstTouch, secondTouch)
    const scaleRatio = nextScale / pinchStartScale.value

    scale.value = nextScale
    translateX.value =
      gestureStartTranslateX.value +
      (midpoint.x - pinchStartMidpointX.value) +
      (pinchStartMidpointX.value - getStageCenter().x) * (1 - scaleRatio)
    translateY.value =
      gestureStartTranslateY.value +
      (midpoint.y - pinchStartMidpointY.value) +
      (pinchStartMidpointY.value - getStageCenter().y) * (1 - scaleRatio)
    clampTranslation()
    return
  }

  const touch = event.touches[0]

  if (!touch) {
    return
  }

  if (gestureMode.value === 'pan') {
    translateX.value = gestureStartTranslateX.value + (touch.clientX - gestureStartX.value)
    translateY.value = gestureStartTranslateY.value + (touch.clientY - gestureStartY.value)
    clampTranslation()
    return
  }

  if (gestureMode.value !== 'swipe') {
    return
  }

  const deltaX = touch.clientX - gestureStartX.value
  const isDraggingPastStart = deltaX > 0 && !canShowPreviousPhoto.value
  const isDraggingPastEnd = deltaX < 0 && !canShowNextPhoto.value

  swipeOffset.value = isDraggingPastStart || isDraggingPastEnd ? deltaX * 0.16 : deltaX
}

function handleTouchEnd(event: TouchEvent): void {
  if (gestureMode.value === 'pinch') {
    if (event.touches.length >= 2) {
      return
    }

    if (scale.value <= 1.03) {
      resetView()
    } else {
      clampTranslation()
      gestureMode.value = 'none'
      isInteracting.value = false
    }
    return
  }

  if (gestureMode.value === 'pan') {
    const changedTouch = event.changedTouches[0]
    const deltaX = changedTouch ? changedTouch.clientX - gestureStartX.value : 0
    const deltaY = changedTouch ? changedTouch.clientY - gestureStartY.value : 0

    clampTranslation()
    gestureMode.value = 'none'
    isInteracting.value = false

    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      handleTap()
    }

    return
  }

  if (gestureMode.value !== 'swipe') {
    isInteracting.value = false
    return
  }

  const changedTouch = event.changedTouches[0]
  const deltaX = changedTouch ? changedTouch.clientX - gestureStartX.value : 0
  const deltaY = changedTouch ? changedTouch.clientY - gestureStartY.value : 0
  const swipeThreshold = Math.min(64, (stageRef.value?.clientWidth ?? 320) * 0.16)

  swipeOffset.value = 0
  gestureMode.value = 'none'
  isInteracting.value = false

  if (Math.abs(deltaX) >= swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > 0) {
      showPreviousPhoto()
    } else {
      showNextPhoto()
    }
    return
  }

  if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
    handleTap()
  }
}

function handleTouchCancel(): void {
  swipeOffset.value = 0
  gestureMode.value = 'none'
  isInteracting.value = false
}

function handleTap(): void {
  const now = Date.now()

  if (now - lastTapAt.value <= 280) {
    toggleZoom()
    lastTapAt.value = 0
    return
  }

  lastTapAt.value = now
}

function toggleZoom(): void {
  if (isZoomed.value) {
    resetView()
    return
  }

  scale.value = 2
  translateX.value = 0
  translateY.value = 0
}

function clampTranslation(): void {
  if (!stageRef.value || scale.value <= MIN_SCALE) {
    translateX.value = 0
    translateY.value = 0
    return
  }

  const maxX = (stageRef.value.clientWidth * (scale.value - 1)) / 2
  const maxY = (stageRef.value.clientHeight * (scale.value - 1)) / 2

  translateX.value = clamp(translateX.value, -maxX, maxX)
  translateY.value = clamp(translateY.value, -maxY, maxY)
}

function getStageCenter(): { x: number; y: number } {
  const bounds = stageRef.value?.getBoundingClientRect()

  return bounds
    ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

function getTouchDistance(firstTouch: Touch, secondTouch: Touch): number {
  return Math.hypot(
    secondTouch.clientX - firstTouch.clientX,
    secondTouch.clientY - firstTouch.clientY,
  )
}

function getTouchMidpoint(firstTouch: Touch, secondTouch: Touch): { x: number; y: number } {
  return {
    x: (firstTouch.clientX + secondTouch.clientX) / 2,
    y: (firstTouch.clientY + secondTouch.clientY) / 2,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
</script>

<template>
  <div
    class="photo-preview"
    role="dialog"
    aria-modal="true"
    aria-label="照片預覽"
    @click.self="emit('close')"
    @wheel.prevent
  >
    <header class="photo-preview__header">
      <button
        class="photo-preview__header-button photo-preview__back"
        type="button"
        aria-label="返回"
        @click="emit('close')"
      >
        <span aria-hidden="true"></span>
        返回
      </button>
      <strong>照片</strong>
      <button
        v-if="canDelete"
        class="photo-preview__header-button photo-preview__delete"
        type="button"
        aria-label="刪除照片"
        @click="emit('delete')"
      >
        刪除
      </button>
      <span v-else class="photo-preview__header-spacer" aria-hidden="true"></span>
    </header>

    <div
      ref="stageRef"
      class="photo-preview__stage"
      :class="{ 'photo-preview__stage--zoomed': isZoomed }"
      @touchstart="handleTouchStart"
      @touchmove.prevent="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchCancel"
      @dblclick.prevent="toggleZoom"
    >
      <button
        class="photo-preview__edge-hit-area photo-preview__edge-hit-area--previous"
        type="button"
        aria-label="上一張照片"
        :disabled="!canShowPreviousPhoto"
        @click="showPreviousPhoto"
      ></button>
      <div class="photo-preview__track" :style="trackStyle">
        <div v-for="(photo, photoIndex) in photos" :key="photo.key" class="photo-preview__slide">
          <img
            class="photo-preview__image"
            :class="{ 'photo-preview__image--active': photoIndex === index }"
            :style="photoIndex === index ? activeImageStyle : undefined"
            :src="photo.src"
            :alt="photo.alt"
            draggable="false"
          />
        </div>
      </div>
      <button
        class="photo-preview__edge-hit-area photo-preview__edge-hit-area--next"
        type="button"
        aria-label="下一張照片"
        :disabled="!canShowNextPhoto"
        @click="showNextPhoto"
      ></button>
    </div>

    <div v-if="photos.length > 1" class="photo-preview__dots" aria-label="照片頁數">
      <span
        v-for="(photo, photoIndex) in photos"
        :key="photo.key"
        :class="{ 'photo-preview__dot--active': photoIndex === index }"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.photo-preview {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: grid;
  min-height: 100dvh;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  overscroll-behavior: none;
  background: #000;
  color: #fff;
}

.photo-preview__header {
  display: grid;
  min-height: 58px;
  grid-template-columns: minmax(84px, 1fr) auto minmax(84px, 1fr);
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid color-mix(in srgb, #fff 14%, transparent);
  padding: calc(env(safe-area-inset-top) + 8px) 16px 8px;
}

.photo-preview__header strong {
  font-size: 1.05rem;
  text-align: center;
}

.photo-preview__header-button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  border: 0;
  padding: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1;
}

.photo-preview__back {
  justify-self: start;
  gap: 4px;
}

.photo-preview__back span {
  display: block;
  width: 12px;
  height: 12px;
  border-bottom: 3px solid currentColor;
  border-left: 3px solid currentColor;
  transform: rotate(45deg);
}

.photo-preview__delete {
  justify-self: end;
}

.photo-preview__header-spacer {
  min-width: 84px;
}

.photo-preview__stage {
  position: relative;
  display: block;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
}

.photo-preview__stage--zoomed {
  cursor: grab;
}

.photo-preview__track {
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 180ms ease;
  will-change: transform;
}

.photo-preview__slide {
  display: grid;
  min-width: 100%;
  height: 100%;
  place-items: center;
  overflow: hidden;
}

.photo-preview__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center;
  transition: transform 160ms ease;
  user-select: none;
  -webkit-user-drag: none;
}

.photo-preview__edge-hit-area {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 24%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: none;
}

.photo-preview__stage--zoomed .photo-preview__edge-hit-area {
  pointer-events: none;
}

.photo-preview__edge-hit-area--previous {
  left: 0;
}

.photo-preview__edge-hit-area--next {
  right: 0;
}

.photo-preview__dots {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px calc(env(safe-area-inset-bottom) + 12px);
}

.photo-preview__dots span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: color-mix(in srgb, #fff 38%, transparent);
}

.photo-preview__dots .photo-preview__dot--active {
  background: var(--color-primary);
}

@media (min-width: 768px) {
  .photo-preview {
    min-height: 100dvh;
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 18px;
    background: color-mix(in srgb, #000 82%, transparent);
  }

  .photo-preview__header {
    width: min(100%, 920px);
    min-height: 0;
    justify-self: center;
    border-bottom: 0;
    padding: 0 0 12px;
  }

  .photo-preview__stage {
    width: min(100%, 920px);
    min-height: 0;
    justify-self: center;
  }

  .photo-preview__track {
    transition: none;
  }

  .photo-preview__image {
    max-width: 100%;
    max-height: calc(100dvh - 132px);
    border-radius: 10px;
    box-shadow: 0 18px 56px color-mix(in srgb, #000 56%, transparent);
  }

  .photo-preview__edge-hit-area {
    top: 50%;
    bottom: auto;
    width: 44px;
    height: 56px;
    border: 1px solid color-mix(in srgb, #fff 22%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, #000 46%, transparent);
    color: #fff;
    pointer-events: auto;
    transform: translateY(-50%);
    transition:
      border-color 160ms ease,
      background-color 160ms ease,
      color 160ms ease,
      opacity 160ms ease;
  }

  .photo-preview__edge-hit-area:hover {
    border-color: color-mix(in srgb, #fff 50%, transparent);
    color: color-mix(in srgb, #fff 80%, transparent);
  }

  .photo-preview__edge-hit-area:disabled {
    border-color: color-mix(in srgb, #fff 70%, transparent);
    color: color-mix(in srgb, #fff 70%, transparent);
    cursor: default;
    opacity: 0.58;
  }

  .photo-preview__edge-hit-area::before {
    position: absolute;
    top: 50%;
    left: 50%;
    display: block;
    width: 13px;
    height: 13px;
    border-bottom: 4px solid currentColor;
    content: '';
    transform-origin: center;
  }

  .photo-preview__edge-hit-area--previous {
    left: 12px;
  }

  .photo-preview__edge-hit-area--previous::before {
    border-left: 4px solid currentColor;
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .photo-preview__edge-hit-area--next {
    right: 12px;
  }

  .photo-preview__edge-hit-area--next::before {
    border-right: 4px solid currentColor;
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  .photo-preview__dots {
    min-height: 34px;
    padding: 12px 16px 0;
  }
}
</style>
