export function createId(_prefix?: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${createRandomHex(8)}-${createRandomHex(4)}-4${createRandomHex(3)}-${createVariantHex()}${createRandomHex(3)}-${createRandomHex(12)}`
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function createRandomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function createVariantHex(): string {
  return ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)] ?? '8'
}
