import {readFileSync} from 'node:fs'
import {DatabaseSync} from 'node:sqlite'
import {P256PrivateKeyExportable} from '@atcute/crypto'
import {createServiceJwt} from '@atcute/xrpc-server/auth'
import {beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {createApp} from '../src/app.ts'
import {createCallerVerifier} from '../src/auth.ts'
import {createD1Store} from '../src/store.ts'

const SERVICE_DID = 'did:web:age.example.com'
const ALICE = 'did:plc:alicealicealicealicealic'
const BOB = 'did:plc:bobbobbobbobbobbobbobbob'
const GET = 'social.mu.age.getStatus'
const SET = 'social.mu.age.setStatus'

const keys = new Map<string, P256PrivateKeyExportable>()

beforeAll(async () => {
  for (const did of [ALICE, BOB]) {
    keys.set(did, await P256PrivateKeyExportable.createKeypair())
  }
})

const resolver = {
  async resolve(did: string) {
    const key = keys.get(did)
    if (!key) throw new Error('unknown did')
    return {
      id: did,
      verificationMethod: [
        {
          id: `${did}#atproto`,
          type: 'Multikey',
          controller: did,
          publicKeyMultibase: await key.exportPublicKey('multikey'),
        },
      ],
    }
  },
}

/** Just enough of D1 over a real SQLite, so the migration and SQL both run. */
function fakeD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(
    readFileSync(
      `${import.meta.dirname}/../migrations/0001_age_status.sql`,
      'utf8',
    ).toString(),
  )
  return {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql)
      return {
        bind(...args: (string | number)[]) {
          const params = Object.fromEntries(
            args.map((value, i) => [`?${i + 1}`, value]),
          )
          return {
            first: async () => statement.get(params) ?? null,
            run: async () => statement.run(params),
          }
        },
      }
    },
  } as unknown as D1Database
}

let app: ReturnType<typeof createApp>

beforeEach(() => {
  app = createApp({
    serviceDid: SERVICE_DID,
    store: createD1Store(fakeD1()),
    verifyCaller: createCallerVerifier({
      serviceDid: SERVICE_DID,
      resolver: resolver as never,
    }),
  })
})

type TokenOptions = {
  issuer?: string
  signer?: string
  audience?: string
  issuedAt?: number
  expiresIn?: number
}

async function token(
  lxm: typeof GET | typeof SET,
  options: TokenOptions = {},
): Promise<string> {
  const {
    issuer = ALICE,
    signer = issuer,
    audience = SERVICE_DID,
    issuedAt = Math.floor(Date.now() / 1000),
    expiresIn = 60,
  } = options
  return createServiceJwt({
    keypair: keys.get(signer)!,
    issuer: issuer as `did:plc:${string}`,
    audience: audience as `did:web:${string}`,
    lxm,
    issuedAt,
    expiresIn,
  })
}

function call(lxm: string, jwt?: string, body?: unknown) {
  return app(
    new Request(`https://age.example.com/xrpc/${lxm}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: jwt ? {authorization: `Bearer ${jwt}`} : {},
      body:
        body === undefined || typeof body === 'string'
          ? body
          : JSON.stringify(body),
    }),
  )
}

const ADULT = {over13: true, over16: true, over18: true}
const TEEN = {over13: true, over16: true, over18: false}

describe('status', () => {
  it('is undeclared until set, then returns the stored flags', async () => {
    expect(await (await call(GET, await token(GET))).json()).toEqual({
      declared: false,
    })
    expect((await call(SET, await token(SET), ADULT)).status).toBe(200)
    expect(await (await call(GET, await token(GET))).json()).toEqual({
      declared: true,
      ...ADULT,
    })
  })

  it('allows flags to be lowered', async () => {
    await call(SET, await token(SET), ADULT)
    await call(SET, await token(SET), TEEN)
    expect(await (await call(GET, await token(GET))).json()).toEqual({
      declared: true,
      ...TEEN,
    })
  })

  it('keeps accounts separate', async () => {
    await call(SET, await token(SET), ADULT)
    const res = await call(GET, await token(GET, {issuer: BOB}))
    expect(await res.json()).toEqual({declared: false})
  })

  it.each([
    {over13: true, over16: false, over18: true},
    {over13: false, over16: true, over18: false},
    {over13: true, over16: true},
    {over13: 'true', over16: true, over18: true},
    'not json',
    'x'.repeat(2000),
  ])('rejects %j', async body => {
    expect((await call(SET, await token(SET), body)).status).toBe(400)
  })
})

describe('auth', () => {
  const now = (): number => Math.floor(Date.now() / 1000)

  const cases: [string, () => Promise<string | undefined>][] = [
    ['no token', async () => undefined],
    ['wrong audience', () => token(GET, {audience: 'did:web:age.mu.social'})],
    ['wrong method', () => token(SET)],
    ['expired', () => token(GET, {issuedAt: now() - 600, expiresIn: 60})],
    ['too long lived', () => token(GET, {expiresIn: 3600})],
    ['signed by someone else', () => token(GET, {signer: BOB})],
    ['garbage', async () => 'a.b.c'],
  ]
  it.each(cases)('rejects %s', async (_name, make) => {
    const res = await call(GET, await make())
    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('public routes', () => {
  it('serves the DID document', async () => {
    const res = await app(
      new Request('https://age.example.com/.well-known/did.json'),
    )
    expect(await res.json()).toMatchObject({id: SERVICE_DID})
  })

  it('answers preflight', async () => {
    const res = await app(
      new Request(`https://age.example.com/xrpc/${SET}`, {method: 'OPTIONS'}),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-headers')).toContain(
      'authorization',
    )
  })
})
