/** datetime-local is a wall clock in the profile's zone, not the device's zone. */
export function wallTime(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function wallTimeToIso(value: string, timeZone?: string, originalInstant?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Invalid date')
  // Preserve seconds and the selected DST occurrence when an existing clock is untouched.
  if (originalInstant && wallTime(new Date(originalInstant), timeZone) === value) return new Date(originalInstant).toISOString()
  if (!timeZone) {
    const date = new Date(value)
    if (wallTime(date) !== value) throw new Error('Invalid date')
    return date.toISOString()
  }
  const target = Date.parse(value + ':00Z')
  let instant = target
  for (let i = 0; i < 4; i++) {
    const represented = Date.parse(wallTime(new Date(instant), timeZone) + ':00Z')
    const delta = target - represented
    if (delta === 0) {
      if (wallTime(new Date(instant), timeZone) !== value) throw new Error('Invalid date')
      return new Date(instant).toISOString()
    }
    instant += delta
  }
  // A nonexistent wall clock during a DST jump must not silently change the input.
  throw new Error('Invalid local time')
}

export function recordDefaults(date?: string, resetHour = 0, timeZone?: string) {
  const end = new Date()
  const start = new Date(end.getTime() - 3600_000)
  if (!date) return { start: wallTime(start, timeZone), end: wallTime(end, timeZone) }
  // A reset in a DST gap advances to the first valid wall clock of that day.
  for (let offset = 0; offset <= 120; offset += 30) {
    const wall = new Date(Date.parse(`${date}T${String(resetHour).padStart(2, '0')}:00Z`) + offset * 60_000).toISOString().slice(0, 16)
    try { return { start: wall, end: wallTime(new Date(Date.parse(wallTimeToIso(wall, timeZone)) + 3600_000), timeZone) } } catch { /* try the next valid time */ }
  }
  throw new Error('Invalid date')
}
