import {BRAND} from '#/config/brand'

const ACTOR_RE =
  /^(did:[a-z]+:[a-zA-Z0-9._:-]+|[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)$/

/**
 * Origin of the configured Streamplace node, e.g. `https://stream.place`.
 */
export function streamplaceOrigin() {
  return BRAND.live.serviceUrl
}

function streamplaceHosts() {
  const host = new URL(streamplaceOrigin()).hostname
  return new Set([host, `www.${host}`])
}

/**
 * Extracts the streamer handle or DID from a Streamplace watch or embed URL
 * (`https://stream.place/alice.bsky.social`, `/embed/did:plc:...`). Returns
 * undefined for any other URL.
 */
export function parseStreamplaceActor(url: string): string | undefined {
  let urlp: URL
  try {
    urlp = new URL(url)
  } catch {
    return undefined
  }
  if (!streamplaceHosts().has(urlp.hostname)) return undefined
  const parts = urlp.pathname.split('/').filter(Boolean)
  if (parts[0] === 'embed') parts.shift()
  if (parts.length !== 1) return undefined
  let actor: string
  try {
    actor = decodeURIComponent(parts[0]).replace(/^@/, '')
  } catch {
    return undefined
  }
  if (!ACTOR_RE.test(actor)) return undefined
  return actor.startsWith('did:') ? actor : actor.toLowerCase()
}

/**
 * Whether `actor` looks like a handle or DID we can pass to Streamplace.
 */
export function isValidStreamplaceActor(actor: string) {
  return ACTOR_RE.test(actor)
}

export function livePlaylistUrl(did: string) {
  return `${streamplaceOrigin()}/xrpc/place.stream.playback.getLivePlaylist?streamer=${did}`
}

export function liveSocketUrl(did: string) {
  return `${streamplaceOrigin().replace(/^http/, 'ws')}/api/websocket/${did}`
}

export function liveThumbnailUrl(did: string) {
  return `${streamplaceOrigin()}/api/playback/${did}/stream.jpg`
}

export function streamplaceWebUrl(actor: string) {
  return `${streamplaceOrigin()}/${actor}`
}
