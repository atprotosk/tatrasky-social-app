import {PasswordSession} from '@atproto/lex-password-session'

import {
  CONFIRMED_SESSION_IDLE_MS,
  createConfirmedSession,
} from '../createConfirmedSession'

jest.mock('#/logger', () => ({logger: {warn: jest.fn(), debug: jest.fn()}}))
jest.mock('#/state/session/clients', () => ({
  /* hand the agent back so tests can make requests through it */
  buildPdsClient: (agent: unknown) => agent,
}))
jest.mock('@atproto/lex-password-session', () => ({
  PasswordSession: {login: jest.fn()},
}))

const login = jest.mocked(PasswordSession.login)
const DID = 'did:plc:alice'
const PDS = 'https://pds.example.com/'

function jwt(scope: string) {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({alg: 'HS256'})}.${part({scope})}.sig`
}

function mockSession({did = DID, scope = 'com.atproto.access'} = {}) {
  const session = {
    destroyed: false,
    session: {did, accessJwt: jwt(scope)},
    logout: jest.fn(() => Promise.resolve()),
    fetchHandler: jest.fn(() => Promise.resolve('response')),
  }
  login.mockResolvedValue(session as unknown as PasswordSession)
  return session
}

const input = {pdsUrl: PDS, did: DID, password: 'hunter2'}

type TestAgent = {
  fetchHandler: (path: string, init: object) => Promise<unknown>
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

describe('createConfirmedSession', () => {
  it('signs in by DID against the account PDS', async () => {
    mockSession()
    await createConfirmedSession(input)
    expect(login).toHaveBeenCalledWith({
      service: PDS,
      identifier: DID,
      password: 'hunter2',
      authFactorToken: undefined,
    })
  })

  it.each([undefined, '', 'http://pds.example.com', 'not a url'])(
    'never sends the password to %p',
    async pdsUrl => {
      await expect(
        createConfirmedSession({...input, pdsUrl}),
      ).rejects.toMatchObject({reason: 'unusable-host'})
      expect(login).not.toHaveBeenCalled()
    },
  )

  it.each(['com.atproto.appPass', 'com.atproto.appPassPrivileged'])(
    'deletes and rejects a %s session',
    async scope => {
      const session = mockSession({scope})
      await expect(createConfirmedSession(input)).rejects.toMatchObject({
        reason: 'limited-password',
      })
      expect(session.logout).toHaveBeenCalledTimes(1)
    },
  )

  it('deletes and rejects a session for another account', async () => {
    const session = mockSession({did: 'did:plc:mallory'})
    await expect(createConfirmedSession(input)).rejects.toMatchObject({
      reason: 'wrong-account',
    })
    expect(session.logout).toHaveBeenCalledTimes(1)
  })

  it('deletes the session once on end, and refuses later requests', async () => {
    const session = mockSession()
    const confirmed = await createConfirmedSession(input)
    confirmed.end()
    confirmed.end()
    expect(session.logout).toHaveBeenCalledTimes(1)
    await expect(
      (confirmed.client as unknown as TestAgent).fetchHandler('/xrpc/x', {}),
    ).rejects.toThrow('ended')
    expect(session.fetchHandler).not.toHaveBeenCalled()
  })

  it('expires after sitting idle, counted from the last request', async () => {
    const session = mockSession()
    const onExpire = jest.fn()
    const confirmed = await createConfirmedSession({...input, onExpire})

    jest.advanceTimersByTime(CONFIRMED_SESSION_IDLE_MS - 1)
    await (confirmed.client as unknown as TestAgent).fetchHandler('/x', {})
    jest.advanceTimersByTime(CONFIRMED_SESSION_IDLE_MS - 1)
    expect(onExpire).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(session.logout).toHaveBeenCalledTimes(1)
  })
})
