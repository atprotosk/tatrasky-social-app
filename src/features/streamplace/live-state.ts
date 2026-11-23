/*
 * Reducer for the Streamplace websocket feed. Ported from Blacksky
 * (MIT, see README.md).
 */

/**
 * A chat message as received from the node, before moderation.
 */
export type ChatMessage = {
  uri: string
  cid: string
  authorDid: string
  handle: string
  text: string
  indexedAt: string
}

/**
 * Everything we know about a stream from its websocket.
 */
export type LiveState = {
  title?: string
  endedAt?: string
  viewerCount?: number
  lastSegmentAt?: number
  messages: ChatMessage[]
  blockedDids: ReadonlySet<string>
}

export const EMPTY_LIVE_STATE: LiveState = {
  messages: [],
  blockedDids: new Set(),
}

const MAX_MESSAGES = 200
const SEGMENT_STALE_MS = 10_000

type Raw = Record<string, unknown>

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null
}

/**
 * Applies one websocket frame to the state. Unknown or malformed frames are
 * ignored, since the node can add new event types at any time.
 */
export function reduceLiveEvent(
  state: LiveState,
  raw: unknown,
  now: number,
): LiveState {
  if (!raw || typeof raw !== 'object') return state
  const e = raw as Raw
  switch (e.$type) {
    case 'place.stream.chat.defs#messageView':
      return onMessage(state, e)
    case 'place.stream.chat.gate':
      return typeof e.hiddenMessage === 'string'
        ? withMessages(
            state,
            state.messages.filter(m => m.uri !== e.hiddenMessage),
          )
        : state
    case 'place.stream.defs#blockView': {
      const did = isRecord(e.record) ? e.record.subject : undefined
      if (typeof did !== 'string') return state
      const blockedDids = new Set(state.blockedDids).add(did)
      return {
        ...state,
        blockedDids,
        messages: state.messages.filter(m => m.authorDid !== did),
      }
    }
    case 'place.stream.livestream#livestreamView': {
      const record = isRecord(e.record) ? e.record : undefined
      const viewerCount = isRecord(e.viewerCount)
        ? e.viewerCount.count
        : undefined
      return {
        ...state,
        title: typeof record?.title === 'string' ? record.title : state.title,
        endedAt:
          typeof record?.endedAt === 'string' ? record.endedAt : undefined,
        viewerCount:
          typeof viewerCount === 'number' ? viewerCount : state.viewerCount,
      }
    }
    case 'place.stream.livestream#viewerCount':
      return typeof e.count === 'number'
        ? {...state, viewerCount: e.count}
        : state
    case 'place.stream.segment': {
      const started =
        typeof e.startTime === 'string' ? Date.parse(e.startTime) : NaN
      return {
        ...state,
        lastSegmentAt: Number.isFinite(started) ? Math.min(started, now) : now,
      }
    }
    default:
      return state
  }
}

/**
 * A stream is live when a segment arrived recently and it hasn't ended.
 */
export function isLiveAt(state: LiveState, now: number) {
  return (
    !state.endedAt &&
    state.lastSegmentAt !== undefined &&
    now - state.lastSegmentAt < SEGMENT_STALE_MS
  )
}

/**
 * True only when we have positive evidence the stream is not live, as opposed
 * to not having heard from the node yet.
 */
export function isKnownNotLiveAt(state: LiveState, now: number) {
  return (
    !!state.endedAt ||
    (state.lastSegmentAt !== undefined &&
      now - state.lastSegmentAt >= SEGMENT_STALE_MS)
  )
}

function onMessage(state: LiveState, e: Raw): LiveState {
  if (typeof e.uri !== 'string') return state
  if (e.deleted === true) {
    return withMessages(
      state,
      state.messages.filter(m => m.uri !== e.uri),
    )
  }
  const author = isRecord(e.author) ? e.author : undefined
  const record = isRecord(e.record) ? e.record : undefined
  const authorDid = author?.did
  const text = record?.text
  const indexedAt = typeof e.indexedAt === 'string' ? e.indexedAt : ''
  if (typeof authorDid !== 'string' || typeof text !== 'string') return state
  if (state.blockedDids.has(authorDid)) return state
  if (state.messages.some(m => m.uri === e.uri)) return state
  const message: ChatMessage = {
    uri: e.uri,
    cid: typeof e.cid === 'string' ? e.cid : '',
    authorDid,
    handle: typeof author?.handle === 'string' ? author.handle : authorDid,
    text,
    indexedAt,
  }
  const messages = [...state.messages, message].sort((x, y) =>
    x.indexedAt < y.indexedAt ? -1 : x.indexedAt > y.indexedAt ? 1 : 0,
  )
  return withMessages(state, messages.slice(-MAX_MESSAGES))
}

function withMessages(state: LiveState, messages: ChatMessage[]): LiveState {
  return messages.length === state.messages.length &&
    messages.every((m, i) => m === state.messages[i])
    ? state
    : {...state, messages}
}
