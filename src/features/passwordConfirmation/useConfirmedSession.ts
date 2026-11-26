import {useCallback, useEffect, useRef, useState} from 'react'

import {useSession} from '#/state/session'
import {
  type ConfirmedSession,
  createConfirmedSession,
} from './createConfirmedSession'

/**
 * A password-confirmed session for the current account, held for as long as the
 * calling component is mounted.
 */
export function useConfirmedSession() {
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  const pdsUrl = currentAccount?.pdsUrl
  const [session, setSession] = useState<ConfirmedSession>()
  const sessionRef = useRef<ConfirmedSession>(undefined)
  /** Bumped on every release, so a slower sign-in knows it is no longer wanted. */
  const attemptRef = useRef(0)

  /* Stable identity: used as an effect dependency by this hook and callers. */
  const release = useCallback(() => {
    attemptRef.current++
    sessionRef.current?.end()
    sessionRef.current = undefined
    setSession(undefined)
  }, [])

  useEffect(() => release, [did, release])

  const confirm = async ({
    password,
    authFactorToken,
  }: {
    password: string
    authFactorToken?: string
  }) => {
    if (!did) return
    release()
    const attempt = attemptRef.current
    const next = await createConfirmedSession({
      pdsUrl,
      did,
      password,
      authFactorToken,
      onExpire: () => {
        if (attemptRef.current === attempt) release()
      },
    })
    if (attemptRef.current !== attempt) {
      next.end()
      return
    }
    sessionRef.current = next
    setSession(next)
  }

  return {
    client: session && session.did === did ? session.client : undefined,
    confirm,
    release,
  }
}
