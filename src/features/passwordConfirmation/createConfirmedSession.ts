import {type Agent, type Client} from '@atproto/lex'
import {PasswordSession} from '@atproto/lex-password-session'
import {jwtDecode} from 'jwt-decode'

import {logger} from '#/logger'
import {buildPdsClient} from '#/state/session/clients'

/** How long a confirmed session may sit unused before it is deleted. */
export const CONFIRMED_SESSION_IDLE_MS = 5 * 60 * 1000

export type ConfirmationFailure =
  /** There is no host we are willing to send the password to. */
  | 'unusable-host'
  /** The server signed in a different account. */
  | 'wrong-account'
  /** An App Password (or other limited credential) was entered. */
  | 'limited-password'

export class ConfirmationError extends Error {
  reason: ConfirmationFailure

  constructor(reason: ConfirmationFailure) {
    super(reason)
    this.name = 'ConfirmationError'
    this.reason = reason
  }
}

export type ConfirmedSession = {
  did: string
  /** A client for the account's PDS with full account access. */
  client: Client
  /** Deletes the session on the server. Safe to call more than once. */
  end: () => void
}

function isSafeHost(url: string) {
  try {
    const {protocol, hostname} = new URL(url)
    if (protocol === 'https:') return true
    /* local dev environments only */
    return (
      protocol === 'http:' &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    )
  } catch {
    return false
  }
}

/** Only the account password yields this scope; App Passwords get others. */
function hasFullAccess(accessJwt: string) {
  try {
    const {scope} = jwtDecode<{scope?: string}>(accessJwt)
    return scope === 'com.atproto.access'
  } catch {
    return false
  }
}

function deleteSession(session: PasswordSession) {
  if (session.destroyed) return
  session.logout().catch(() => {
    logger.warn('passwordConfirmation: could not delete the session')
  })
}

/**
 * Sign in with the account password alongside the current session. Nothing is
 * persisted. Throws `LexAuthFactorError` if a 2FA code is needed.
 */
export async function createConfirmedSession({
  pdsUrl,
  did,
  password,
  authFactorToken,
  onExpire,
}: {
  pdsUrl: string | undefined
  did: string
  password: string
  authFactorToken?: string
  /** Called if the session is ended for being idle. */
  onExpire?: () => void
}): Promise<ConfirmedSession> {
  if (!pdsUrl || !isSafeHost(pdsUrl)) {
    throw new ConfirmationError('unusable-host')
  }

  const session = await PasswordSession.login({
    service: pdsUrl,
    identifier: did,
    password,
    authFactorToken,
  })

  const {accessJwt, did: sessionDid} = session.session
  if (sessionDid !== did || !hasFullAccess(accessJwt)) {
    deleteSession(session)
    throw new ConfirmationError(
      sessionDid !== did ? 'wrong-account' : 'limited-password',
    )
  }

  let ended = false
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const end = () => {
    if (ended) return
    ended = true
    clearTimeout(idleTimer)
    deleteSession(session)
  }

  const restartIdleTimer = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      end()
      onExpire?.()
    }, CONFIRMED_SESSION_IDLE_MS)
  }

  const agent: Agent = {
    /* `session.did` throws once logged out, so use the value checked above */
    did: sessionDid,
    fetchHandler(path, init) {
      if (ended) {
        return Promise.reject(new Error('Confirmed session has ended'))
      }
      restartIdleTimer()
      return session.fetchHandler(path, init)
    },
  }

  restartIdleTimer()

  return {did, client: buildPdsClient(agent), end}
}
