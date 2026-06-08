import { supabase } from '@/lib/supabase'
import type { EventPhoto } from '@/types'
import { createId } from '@/utils/id'

export const EVENT_PHOTO_BUCKET = 'event-photos'
export const MAX_EVENT_PHOTO_COUNT = 3

const INITIAL_MAX_PHOTO_EDGE = 1280
const MIN_PHOTO_EDGE = 960
const INITIAL_WEBP_QUALITY = 0.76
const MIN_WEBP_QUALITY = 0.58
const TARGET_PHOTO_BYTES = 900 * 1024
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000

interface SignedUrlCacheEntry {
  url: string
  expiresAt: number
}

const signedUrlCache = new Map<string, SignedUrlCacheEntry>()

interface UploadEventPhotoInput {
  file: File
  notebookId: string
  eventId: string
  index: number
}

interface ProcessedPhoto {
  file: File
  width: number
  height: number
}

export async function uploadEventPhoto({
  file,
  notebookId,
  eventId,
  index,
}: UploadEventPhotoInput): Promise<EventPhoto> {
  if (!supabase) {
    throw new Error('Supabase 尚未設定')
  }

  const processedPhoto = await processEventPhoto(file)
  const path = buildEventPhotoPath(notebookId, eventId, index)
  const { error } = await supabase.storage
    .from(EVENT_PHOTO_BUCKET)
    .upload(path, processedPhoto.file, {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: true,
    })

  if (error) {
    throw error
  }

  return {
    path,
    width: processedPhoto.width,
    height: processedPhoto.height,
  }
}

export async function createEventPhotoSignedUrls(paths: string[]): Promise<Map<string, string>> {
  const signedUrls = new Map<string, string>()
  const uniquePaths = [...new Set(paths)]

  if (!supabase || uniquePaths.length === 0) {
    return signedUrls
  }

  const now = Date.now()
  const pathsToSign: string[] = []

  for (const path of uniquePaths) {
    const cachedUrl = signedUrlCache.get(path)

    if (cachedUrl && cachedUrl.expiresAt - SIGNED_URL_REFRESH_BUFFER_MS > now) {
      signedUrls.set(path, cachedUrl.url)
    } else {
      signedUrlCache.delete(path)
      pathsToSign.push(path)
    }
  }

  if (pathsToSign.length === 0) {
    return signedUrls
  }

  const { data, error } = await supabase.storage
    .from(EVENT_PHOTO_BUCKET)
    .createSignedUrls(pathsToSign, SIGNED_URL_EXPIRES_IN_SECONDS)

  if (error) {
    throw error
  }

  const expiresAt = now + SIGNED_URL_EXPIRES_IN_SECONDS * 1000

  for (const item of data) {
    if (item.path && item.signedUrl) {
      signedUrls.set(item.path, item.signedUrl)
      signedUrlCache.set(item.path, {
        url: item.signedUrl,
        expiresAt,
      })
    }
  }

  return signedUrls
}

export async function deleteEventPhotoPaths(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) {
    return
  }

  const { error } = await supabase.storage.from(EVENT_PHOTO_BUCKET).remove(paths)

  if (error) {
    throw error
  }

  for (const path of paths) {
    signedUrlCache.delete(path)
  }
}

async function processEventPhoto(file: File): Promise<ProcessedPhoto> {
  const imageBlob = await normalizeReadableImageBlob(file)
  const bitmap = await createImageBitmap(imageBlob)
  const encodedPhoto = await encodeWebpUnderTarget(bitmap)

  bitmap.close()

  return {
    file: new File([encodedPhoto.blob], `${createId('event-photo')}.webp`, { type: 'image/webp' }),
    width: encodedPhoto.width,
    height: encodedPhoto.height,
  }
}

async function encodeWebpUnderTarget(bitmap: ImageBitmap): Promise<{
  blob: Blob
  width: number
  height: number
}> {
  let maxEdge = INITIAL_MAX_PHOTO_EDGE
  let quality = INITIAL_WEBP_QUALITY
  let bestResult: { blob: Blob; width: number; height: number } | undefined

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))
    const blob = await drawAndEncodeWebp(bitmap, width, height, quality)

    bestResult = { blob, width, height }

    if (blob.size <= TARGET_PHOTO_BYTES) {
      return bestResult
    }

    if (quality > MIN_WEBP_QUALITY) {
      quality = Math.max(MIN_WEBP_QUALITY, quality - 0.08)
    } else if (maxEdge > MIN_PHOTO_EDGE) {
      maxEdge = Math.max(MIN_PHOTO_EDGE, Math.round(maxEdge * 0.84))
      quality = INITIAL_WEBP_QUALITY
    } else {
      return bestResult
    }
  }

  if (!bestResult) {
    throw new Error('圖片轉檔失敗')
  }

  return bestResult
}

async function drawAndEncodeWebp(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('無法處理圖片')
  }

  context.drawImage(bitmap, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('圖片轉檔失敗'))
          return
        }

        resolve(blob)
      },
      'image/webp',
      quality,
    )
  })
}

async function normalizeReadableImageBlob(file: File): Promise<Blob> {
  if (isHeicFile(file)) {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    })

    const convertedBlob = Array.isArray(converted) ? converted[0] : converted

    if (!convertedBlob) {
      throw new Error('HEIC 圖片轉檔失敗')
    }

    return convertedBlob
  }

  return file
}

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()

  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

function buildEventPhotoPath(notebookId: string, eventId: string, index: number): string {
  return `notebooks/${notebookId}/events/${eventId}/${Date.now()}-${index}-${createId('photo')}.webp`
}
