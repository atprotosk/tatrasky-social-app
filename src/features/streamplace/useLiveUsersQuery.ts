import {type DidString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {BRAND} from '#/config/brand'
import {app} from '#/lexicons'
import {type LivestreamView, parseLivestreamView} from './types'
import {streamplaceOrigin} from './url'

const PROFILE_BATCH = 25
const REFETCH_INTERVAL_MS = 30_000

/**
 * A live stream plus the streamer's AppView profile, when it resolved.
 */
export type LiveUser = {
  stream: LivestreamView
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}

const liveUsersQueryKeyRoot = 'liveUsers'

export const createLiveUsersQueryKey = () =>
  createQueryKey(liveUsersQueryKeyRoot, {})

/**
 * Fetches who is live right now from the configured Streamplace node, newest
 * first, and attaches the streamers' profiles so cards can show names and
 * avatars and be moderated.
 */
export function useLiveUsersQuery() {
  const client = useAppviewClient()
  return useQuery({
    enabled: BRAND.live.enabled,
    queryKey: createLiveUsersQueryKey(),
    queryFn: async ({signal}): Promise<LiveUser[]> => {
      const res = await fetch(
        `${streamplaceOrigin()}/xrpc/place.stream.live.getLiveUsers?limit=50`,
        {signal},
      )
      if (!res.ok) {
        throw new Error(`getLiveUsers failed with status ${res.status}`)
      }
      const body: unknown = await res.json()
      const raw =
        typeof body === 'object' && body !== null && 'streams' in body
          ? body.streams
          : undefined
      const streams = (Array.isArray(raw) ? raw : [])
        .map(parseLivestreamView)
        .filter((s): s is LivestreamView => !!s && !s.record.endedAt)

      const dids = [...new Set(streams.map(s => s.author.did))]
      const profiles = new Map<
        string,
        app.bsky.actor.defs.ProfileViewDetailed
      >()
      for (let i = 0; i < dids.length; i += PROFILE_BATCH) {
        const chunk = dids.slice(i, i + PROFILE_BATCH) as DidString[]
        try {
          const data = await client.call(app.bsky.actor.getProfiles, {
            actors: chunk,
          })
          for (const p of data.profiles) profiles.set(p.did, p)
        } catch {
          // Cards fall back to the handle from Streamplace.
        }
      }
      return streams.map(stream => ({
        stream,
        profile: profiles.get(stream.author.did),
      }))
    },
    staleTime: STALE.SECONDS.FIFTEEN,
    refetchInterval: REFETCH_INTERVAL_MS,
  })
}
