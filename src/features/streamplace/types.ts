/*
 * Hand-written subsets of the place.stream.* lexicons we read. We parse
 * defensively instead of depending on the `streamplace` package, which pulls
 * in the legacy @atproto/api.
 */

/**
 * `place.stream.livestream#livestreamView`, as returned by
 * `place.stream.live.getLiveUsers`.
 */
export type LivestreamView = {
  uri: string
  cid: string
  indexedAt?: string
  author: {did: string; handle?: string}
  record: {
    title?: string
    createdAt?: string
    lastSeenAt?: string
    endedAt?: string
    tags?: string[]
  }
  viewerCount?: {count?: number}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Validates one entry of a `getLiveUsers` response. Returns undefined for
 * malformed entries so one bad record can't break the whole list.
 */
export function parseLivestreamView(raw: unknown): LivestreamView | undefined {
  if (!isRecord(raw)) return undefined
  const {uri, cid, author, record, viewerCount, indexedAt} = raw
  if (typeof uri !== 'string' || typeof cid !== 'string') return undefined
  if (!isRecord(author) || typeof author.did !== 'string') return undefined
  if (!author.did.startsWith('did:')) return undefined
  const rec = isRecord(record) ? record : {}
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    uri,
    cid,
    indexedAt: str(indexedAt),
    author: {did: author.did, handle: str(author.handle)},
    record: {
      title: str(rec.title),
      createdAt: str(rec.createdAt),
      lastSeenAt: str(rec.lastSeenAt),
      endedAt: str(rec.endedAt),
      tags: Array.isArray(rec.tags)
        ? rec.tags.filter((t): t is string => typeof t === 'string')
        : undefined,
    },
    viewerCount:
      isRecord(viewerCount) && typeof viewerCount.count === 'number'
        ? {count: viewerCount.count}
        : undefined,
  }
}
