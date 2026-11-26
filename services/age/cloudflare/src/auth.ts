import {
  CompositeDidDocumentResolver,
  type DidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver'
import {type Did, type Nsid} from '@atcute/lexicons'
import {ServiceJwtVerifier} from '@atcute/xrpc-server/auth'

const MAX_TOKEN_AGE_SECONDS = 300
const CLOCK_LEEWAY_SECONDS = 60

export type CallerVerifier = (request: Request, lxm: Nsid) => Promise<string>

/**
 * The resolvers set `cache` on their requests, and the Workers runtime rejects
 * some cache modes, so drop it. Nothing here caches DID documents anyway.
 */
const fetchWithoutCacheMode: typeof fetch = (input, init) => {
  const {cache: _cache, ...rest} = (init ?? {}) as RequestInit & {
    cache?: unknown
  }
  return fetch(input, rest)
}

export function createDidResolver(): DidDocumentResolver {
  return new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver({fetch: fetchWithoutCacheMode}),
      web: new WebDidDocumentResolver({fetch: fetchWithoutCacheMode}),
    },
  }) as DidDocumentResolver
}

/**
 * Resolves to the caller's DID, or throws if the atproto service-auth token is
 * not signed by that account for exactly this service and method.
 */
export function createCallerVerifier({
  serviceDid,
  resolver = createDidResolver(),
}: {
  serviceDid: string
  resolver?: DidDocumentResolver
}): CallerVerifier {
  const verifier = new ServiceJwtVerifier({
    acceptAudiences: [serviceDid as Did],
    maxAge: MAX_TOKEN_AGE_SECONDS,
    clockLeeway: CLOCK_LEEWAY_SECONDS,
    resolver,
  })
  return async (request, lxm) => {
    const {issuer} = await verifier.verifyRequest(request, {lxm})
    return issuer
  }
}
