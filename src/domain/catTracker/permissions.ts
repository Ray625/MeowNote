import type { CatEvent } from '@/types'

interface NotebookPermissionContext {
  notebookId: string
  userId?: string
  role: string
}

export function canModifyEventForNotebook(
  event: CatEvent,
  context: NotebookPermissionContext,
): boolean {
  if (!context.notebookId || !context.userId) {
    return true
  }

  if (context.role === 'owner') {
    return true
  }

  return event.createdBy === context.userId
}

export function canManageNotebookData(context: NotebookPermissionContext): boolean {
  if (!context.notebookId || !context.userId) {
    return true
  }

  return !context.role || context.role === 'owner'
}
