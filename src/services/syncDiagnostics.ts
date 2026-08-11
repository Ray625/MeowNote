import { readJson, writeJson } from '@/utils/storage'

const SYNC_DIAGNOSTICS_STORAGE_KEY = 'meownote:sync-diagnostics'
const SYNC_DIAGNOSTICS_CONSOLE_KEY = 'meownote:sync-diagnostics-console'
const MAX_DIAGNOSTIC_ENTRIES = 80

type SyncDiagnosticType =
  | 'event-create-start'
  | 'event-create-success'
  | 'event-create-failure'
  | 'event-create-retry-missing-local-event'
  | 'event-update-start'
  | 'event-update-success'
  | 'event-update-failure'
  | 'event-update-retry-missing-local-event'
  | 'event-delete-start'
  | 'event-delete-success'
  | 'event-delete-failure'
  | 'remote-refresh-local-events-preserved'
  | 'remote-refresh-local-updates-preserved'
  | 'remote-refresh-local-deletes-preserved'
  | 'remote-refresh-overwrite-risk'

export interface SyncDiagnosticEntry {
  id: string
  type: SyncDiagnosticType
  recordedAt: string
  context: Record<string, unknown>
}

interface ErrorInfo {
  code?: string
  details?: string
  hint?: string
  message?: string
  name?: string
  status?: number
}

export function recordSyncDiagnostic(
  type: SyncDiagnosticType,
  context: Record<string, unknown>,
): void {
  const entry: SyncDiagnosticEntry = {
    id: createDiagnosticId(),
    type,
    recordedAt: new Date().toISOString(),
    context: sanitizeContext(context),
  }
  const entries = readJson<SyncDiagnosticEntry[]>(SYNC_DIAGNOSTICS_STORAGE_KEY, [])
  const nextEntries = [...entries, entry].slice(-MAX_DIAGNOSTIC_ENTRIES)

  writeJson(SYNC_DIAGNOSTICS_STORAGE_KEY, nextEntries)

  if (shouldLogToConsole()) {
    console.warn('[MeowNote sync]', entry)
  }
}

export function getSyncDiagnosticErrorInfo(error: unknown): ErrorInfo {
  if (!error || typeof error !== 'object') {
    return {
      message: typeof error === 'string' ? error : undefined,
    }
  }

  const source = error as {
    code?: unknown
    details?: unknown
    hint?: unknown
    message?: unknown
    name?: unknown
    status?: unknown
  }

  return {
    code: typeof source.code === 'string' ? source.code : undefined,
    details: typeof source.details === 'string' ? source.details : undefined,
    hint: typeof source.hint === 'string' ? source.hint : undefined,
    message: typeof source.message === 'string' ? source.message : undefined,
    name: typeof source.name === 'string' ? source.name : undefined,
    status: typeof source.status === 'number' ? source.status : undefined,
  }
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined && value !== ''),
  )
}

function shouldLogToConsole(): boolean {
  return import.meta.env.DEV || readJson<boolean>(SYNC_DIAGNOSTICS_CONSOLE_KEY, false)
}

function createDiagnosticId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
