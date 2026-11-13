/** 3:07, or 1:02:45 from an hour on. */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.round(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

/** "1 album", "3 albums". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
]

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago": how long ago an instant (ISO 8601) was. */
export function timeAgo(iso: string, now = Date.now()): string {
  let amount = (Date.parse(iso) - now) / 1000
  if (amount > -45) {
    return 'just now'
  }
  for (const [unit, size] of STEPS) {
    if (Math.abs(amount) < size) {
      return relative.format(Math.round(amount), unit)
    }
    amount /= size
  }
  return relative.format(Math.round(amount), 'year')
}

/** "Nov 13, 2026, 3:04 PM": a date and time (ISO 8601), in the browser's time zone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
}
