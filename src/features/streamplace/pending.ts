/**
 * A chat message the viewer sent that hasn't come back over the websocket yet.
 */
export type PendingMessage = {
  localId: string
  text: string
  sentAt: number
  /** AT-URI of the created record, once the PDS has accepted it. */
  uri?: string
  status: 'sending' | 'failed'
}

/**
 * Drops pending messages that the node has echoed back, and marks ones that
 * never arrived within `timeoutMs` as failed. Returns the same array when
 * nothing changed so React can bail out of the state update.
 */
export function reconcilePending(
  pending: PendingMessage[],
  seenUris: ReadonlySet<string>,
  now: number,
  timeoutMs: number,
): PendingMessage[] {
  let changed = false
  const next: PendingMessage[] = []
  for (const m of pending) {
    if (m.uri && seenUris.has(m.uri)) {
      changed = true
      continue
    }
    if (m.status === 'sending' && m.uri && now - m.sentAt > timeoutMs) {
      changed = true
      next.push({...m, status: 'failed'})
      continue
    }
    next.push(m)
  }
  return changed ? next : pending
}
