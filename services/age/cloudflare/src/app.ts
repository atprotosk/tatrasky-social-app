import {AuthRequiredError} from '@atcute/xrpc-server'

import {type CallerVerifier} from './auth.ts'
import {type AgeFlags, type AgeStore} from './store.ts'

const GET_STATUS = 'social.mu.age.getStatus'
const SET_STATUS = 'social.mu.age.setStatus'
const MAX_BODY_BYTES = 1024

/*
 * Any origin is fine: requests are authorised by a bearer token the caller has
 * to attach on purpose, never by cookies.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}

function error(status: number, name: string, message: string): Response {
  return json({error: name, message}, status)
}

/** Returns the flags only if all three are booleans that agree with each other. */
function parseFlags(input: unknown): AgeFlags | undefined {
  if (!input || typeof input !== 'object') return undefined
  const {over13, over16, over18} = input as Record<string, unknown>
  if (
    typeof over13 !== 'boolean' ||
    typeof over16 !== 'boolean' ||
    typeof over18 !== 'boolean'
  ) {
    return undefined
  }
  if ((over18 && !over16) || (over16 && !over13)) return undefined
  return {over13, over16, over18}
}

async function readFlags(request: Request): Promise<AgeFlags | undefined> {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return undefined
  try {
    return parseFlags(JSON.parse(text))
  } catch {
    return undefined
  }
}

export function createApp({
  serviceDid,
  store,
  verifyCaller,
}: {
  serviceDid: string
  store: AgeStore
  verifyCaller: CallerVerifier
}) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {status: 204, headers: CORS})
    }
    const {pathname} = new URL(request.url)
    const route = `${request.method} ${pathname}`

    try {
      if (route === 'GET /.well-known/did.json') {
        return json({
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: serviceDid,
        })
      }
      if (route === 'GET /xrpc/_health') {
        return json({status: 'ok'})
      }
      if (route === `GET /xrpc/${GET_STATUS}`) {
        const did = await verifyCaller(request, GET_STATUS)
        const flags = await store.get(did)
        return json(flags ? {declared: true, ...flags} : {declared: false})
      }
      if (route === `POST /xrpc/${SET_STATUS}`) {
        const did = await verifyCaller(request, SET_STATUS)
        const flags = await readFlags(request)
        if (!flags) {
          return error(400, 'InvalidRequest', 'Invalid age flags')
        }
        await store.set(did, flags)
        return json({})
      }
      return error(404, 'NotFound', 'Not found')
    } catch (e) {
      if (e instanceof AuthRequiredError) {
        return error(401, 'AuthenticationRequired', e.message)
      }
      /* Name only: no DIDs, tokens or flags in logs. */
      console.error('request failed', e instanceof Error ? e.name : typeof e)
      return error(500, 'InternalServerError', 'Something went wrong')
    }
  }
}
