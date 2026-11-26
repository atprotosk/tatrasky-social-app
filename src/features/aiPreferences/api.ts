import {currentDatetimeString} from '@atproto/syntax'
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {isNetworkError} from '#/lib/network-error'
import {isRecordNotFoundError} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {community} from '#/lexicons'
import {
  type AIPreferencePatch,
  type AIPreferenceRecord,
  type AIPreferenceValues,
  applyAIPreferencePatch,
  getAIPreferenceValues,
} from './record'

const aiPreferencesQueryKeyRoot = 'ai-preferences'

const createAIPreferencesQueryKey = (args: {did: string}) =>
  createQueryKey(aiPreferencesQueryKeyRoot, args)

async function getRecord(
  client: ReturnType<typeof usePdsClient>,
): Promise<AIPreferenceRecord | null> {
  try {
    const response = await client.get(community.lexicon.preference.ai, {
      rkey: 'self',
    })
    return response.value
  } catch (e) {
    if (isRecordNotFoundError(e)) return null
    throw e
  }
}

/**
 * The account's AI preferences. `values` is undefined until the record has
 * been loaded, and includes changes that are still being saved.
 */
export function useAIPreferencesQuery() {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount!.did

  const query = useQuery({
    queryKey: createAIPreferencesQueryKey({did}),
    queryFn: () => getRecord(client),
    staleTime: STALE.MINUTES.ONE,
  })

  const pendingPatches = useMutationState({
    filters: {
      mutationKey: [aiPreferencesQueryKeyRoot, did],
      status: 'pending',
    },
    select: mutation => mutation.state.variables as AIPreferencePatch,
  })

  const values =
    query.data === undefined
      ? undefined
      : pendingPatches.reduce<AIPreferenceValues>(
          (acc, patch) => ({...acc, ...patch}),
          getAIPreferenceValues(query.data),
        )

  return {values, isError: query.isError, refetch: query.refetch}
}

export function useAIPreferencesMutation({onError}: {onError: () => void}) {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  const did = currentAccount!.did
  const queryKey = createAIPreferencesQueryKey({did})

  return useMutation({
    mutationKey: [aiPreferencesQueryKeyRoot, did],
    /*
     * Every save rewrites the whole record, so saves must run one at a time or
     * a slower earlier one could overwrite a later choice.
     */
    scope: {id: `${aiPreferencesQueryKeyRoot}:${did}`},
    mutationFn: async (patch: AIPreferencePatch) => {
      /*
       * Read from the PDS rather than the cache, so that changes made in other
       * apps since we last fetched are not reverted.
       */
      const record = applyAIPreferencePatch(
        await getRecord(client),
        patch,
        currentDatetimeString(),
      )
      await client.put(community.lexicon.preference.ai, record, {rkey: 'self'})
      return record
    },
    onSuccess: async record => {
      await queryClient.cancelQueries({queryKey})
      queryClient.setQueryData(queryKey, record)
    },
    onError: error => {
      if (!isNetworkError(error)) {
        logger.error('Failed to save AI preferences', {safeMessage: error})
      }
      // the write may have gone through even though the response did not
      void queryClient.invalidateQueries({queryKey})
      onError()
    },
  })
}
