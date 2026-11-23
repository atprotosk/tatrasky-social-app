const pad = (n: number) => String(n).padStart(2, '0')

/** A Date as a local `YYYY-MM-DDTHH:mm` string. */
export function toDateTimeLocal(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * A local `YYYY-MM-DDTHH:mm` string as a Date, or undefined if it is not one.
 * The components are read as device-local time, as the pickers produce them.
 */
export function fromDateTimeLocal(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return undefined
  const [, y, mo, d, h, mi] = m.map(Number)
  const date = new Date(y, mo - 1, d, h, mi, 0, 0)
  return isNaN(date.getTime()) ? undefined : date
}
