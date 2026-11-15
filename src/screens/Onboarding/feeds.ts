import {TID} from '@atproto/common-web'
import {type Client} from '@atproto/lex'
import {overwriteSavedFeeds} from '@bsky/sdk'

import {
  DEFAULT_SAVED_FEED,
  TIMELINE_SAVED_FEED,
  VIDEO_SAVED_FEED,
} from '#/lib/constants'
import {type app} from '#/lexicons'

type SavedFeed = app.bsky.actor.defs.SavedFeed

/**
 * Default pinned feeds for a new account: the Slovak default feed, Following
 * and Video, followed by any starter-pack feeds not already included.
 */
export function getOnboardingFeeds(
  starterPackFeeds: {uri: string}[] = [],
): SavedFeed[] {
  const feeds: SavedFeed[] = [
    {...DEFAULT_SAVED_FEED, id: TID.nextStr()},
    {...TIMELINE_SAVED_FEED, id: TID.nextStr()},
    {...VIDEO_SAVED_FEED, id: TID.nextStr()},
  ]
  const seen = new Set(feeds.map(feed => feed.value))
  for (const {uri} of starterPackFeeds) {
    if (!seen.has(uri)) {
      feeds.push({type: 'feed', value: uri, pinned: true, id: TID.nextStr()})
      seen.add(uri)
    }
  }
  return feeds
}

/** Only called for newly created accounts completing onboarding. */
export async function saveOnboardingFeeds(
  client: Client,
  starterPackFeeds?: {uri: string}[],
) {
  await client.call(overwriteSavedFeeds, getOnboardingFeeds(starterPackFeeds))
}
