export function getIsoNow(): string {
  return new Date().toISOString()
}

export function isSameLocalDate(dateTime: string, date = new Date()): boolean {
  const value = new Date(dateTime)

  return (
    value.getFullYear() === date.getFullYear() &&
    value.getMonth() === date.getMonth() &&
    value.getDate() === date.getDate()
  )
}
