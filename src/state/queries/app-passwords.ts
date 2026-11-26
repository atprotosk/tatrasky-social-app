import {type Client} from '@atproto/lex'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {com} from '#/lexicons'
import {useSession} from '../session'

/*
 * Managing app passwords needs a session made with a password, so the caller
 * says which client to use: the normal one for password sessions, a confirmed
 * one for OAuth. Undefined means there is none yet.
 */

const RQKEY_ROOT = 'app-passwords'
export const RQKEY = (did: string | undefined) => [RQKEY_ROOT, did]

export function useAppPasswordsQuery({client}: {client: Client | undefined}) {
  const {currentAccount} = useSession()
  return useQuery({
    enabled: !!client,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: RQKEY(currentAccount?.did),
    queryFn: async () => {
      const data = await requireClient(client).call(
        com.atproto.server.listAppPasswords,
      )
      return data.passwords
    },
  })
}

export function useAppPasswordCreateMutation({
  client,
}: {
  client: Client | undefined
}) {
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  return useMutation<
    com.atproto.server.createAppPassword.$OutputBody,
    Error,
    {name: string; privileged: boolean}
  >({
    mutationFn: async ({name, privileged}) => {
      return await requireClient(client).call(
        com.atproto.server.createAppPassword,
        {name, privileged},
      )
    },
    onSuccess() {
      queryClient.invalidateQueries({
        queryKey: RQKEY(currentAccount?.did),
      })
    },
  })
}

export function useAppPasswordDeleteMutation({
  client,
}: {
  client: Client | undefined
}) {
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  return useMutation<void, Error, {name: string}>({
    mutationFn: async ({name}) => {
      await requireClient(client).call(com.atproto.server.revokeAppPassword, {
        name,
      })
    },
    onSuccess() {
      queryClient.invalidateQueries({
        queryKey: RQKEY(currentAccount?.did),
      })
    },
  })
}

function requireClient(client: Client | undefined) {
  if (!client) {
    throw new Error('No session that can manage app passwords')
  }
  return client
}
