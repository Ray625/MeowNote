import type { CatEvent, EventCategory } from '@/types'

export function getEventValueText(
  event: Pick<CatEvent, 'values'>,
  category?: Pick<EventCategory, 'name' | 'valueLabel' | 'valueUnit'>,
): string {
  const amount = event.values?.amount
  const numericAmount =
    typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : undefined

  if (typeof numericAmount !== 'number' || !Number.isFinite(numericAmount)) {
    return ''
  }

  const valueLabel = category?.valueLabel && category.valueLabel !== category.name ? category.valueLabel : ''

  return [valueLabel, formatEventAmount(numericAmount), category?.valueUnit]
    .filter(Boolean)
    .join(' ')
}

function formatEventAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)))
}
