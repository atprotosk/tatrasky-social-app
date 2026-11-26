import {useMemo} from 'react'
import {type Client} from '@atproto/lex'
import {setPersonalDetails} from '@bsky/sdk'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {restrictChatSettings} from '#/state/queries/messages/restrictChatSettings'
import {preferencesQueryKey} from '#/state/queries/preferences'
import {usePdsClient, useSession} from '#/state/session'
import {usePatchAgeAssuranceOtherRequiredData} from '#/ageAssurance'
import {setBirthdateForDid} from '#/ageAssurance/data'
import {
  birthdateFromFlags,
  flagsFromBirthDate,
  setMuAgeStatus,
} from '#/ageAssurance/muAgeService'
import {IS_DEV} from '#/env'
import {account} from '#/storage'

// 6s in dev, 48h in prod
const BIRTHDATE_DELAY_HOURS = IS_DEV ? 0.001 : 48

/**
 * Stores the timestamp of the birthday update locally. This is used to
 * debounce birthday updates globally.
 *
 * Use {@link useIsBirthdateUpdateAllowed} to check if an update is allowed.
 */
export function snoozeBirthdateUpdateAllowedForDid(did: string) {
  account.set([did, 'birthdateLastUpdatedAt'], new Date().toISOString())
}

/**
 * Checks if we've already snoozed bday updates. In some cases, if one is
 * present, we don't need to set another, such as in AA when reading initial
 * data on load.
 */
export function hasSnoozedBirthdateUpdateForDid(did: string) {
  return !!account.get([did, 'birthdateLastUpdatedAt'])
}

/**
 * Returns whether a birthdate update is currently allowed, based on the
 * last update timestamp stored locally.
 */
export function useIsBirthdateUpdateAllowed() {
  const {currentAccount} = useSession()
  return useMemo(() => {
    if (!currentAccount) return false
    const lastUpdated = account.get([
      currentAccount.did,
      'birthdateLastUpdatedAt',
    ])
    if (!lastUpdated) return true
    const lastUpdatedDate = new Date(lastUpdated)
    // eslint-disable-next-line react-hooks/purity
    const diffMs = Date.now() - lastUpdatedDate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours >= BIRTHDATE_DELAY_HOURS
  }, [currentAccount])
}

export function useBirthdateMutation() {
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const patchOtherRequiredData = usePatchAgeAssuranceOtherRequiredData()

  return useMutation<
    void,
    unknown,
    {birthDate: Date; confirmedClient?: Client}
  >({
    /**
     * `confirmedClient` is the password-confirmed session an OAuth account
     * needs for the PDS write. Everything else uses the normal session.
     *
     * Safe to run again with the same date, which is how a save that failed
     * halfway is repaired.
     */
    mutationFn: async ({birthDate, confirmedClient}) => {
      await (confirmedClient ?? pdsClient).call(setPersonalDetails, {
        birthDate,
      })

      /*
       * Age assurance reads our age service, not the PDS, so without this the
       * change would be undone by the next refetch.
       */
      const flags = flagsFromBirthDate(birthDate)
      await setMuAgeStatus(pdsClient, flags)

      if (!flags.over18) {
        await restrictChatSettings({
          client: pdsClient,
          restrictIncoming: true,
          restrictGroupInvites: true,
        })
      }

      /*
       * Patch the age assurance data, which may change the access level. Only
       * a date derived from the thresholds, as this cache is persisted.
       */
      const birthdate = birthdateFromFlags(flags)
      if (currentAccount) {
        setBirthdateForDid({did: currentAccount.did, birthdate})
      }
      void patchOtherRequiredData({birthdate})
      if (currentAccount) {
        snoozeBirthdateUpdateAllowedForDid(currentAccount.did)
      }

      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}
