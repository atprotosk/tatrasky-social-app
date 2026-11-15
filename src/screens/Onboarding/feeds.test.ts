import {type Client} from '@atproto/lex'
import {overwriteSavedFeeds} from '@bsky/sdk'

import {
  DEFAULT_FEED_URI,
  DISCOVER_FEED_URI,
  VIDEO_FEED_URI,
} from '#/lib/constants'
import {getOnboardingFeeds, saveOnboardingFeeds} from './feeds'

describe('onboarding feeds', () => {
  it('pins the default feed first, followed by Following and Video', () => {
    const feeds = getOnboardingFeeds()
    expect(feeds.map(feed => feed.value)).toEqual([
      DEFAULT_FEED_URI,
      'following',
      VIDEO_FEED_URI,
    ])
    expect(feeds.every(feed => feed.pinned && feed.id)).toBe(true)
    expect(new Set(feeds.map(feed => feed.id)).size).toBe(feeds.length)
  })

  it('retains starter-pack feeds after defaults without duplicating them', () => {
    const feeds = getOnboardingFeeds([
      {uri: DEFAULT_FEED_URI},
      {uri: DISCOVER_FEED_URI},
      {uri: VIDEO_FEED_URI},
      {uri: DISCOVER_FEED_URI},
    ])
    expect(feeds.map(feed => feed.value)).toEqual([
      DEFAULT_FEED_URI,
      'following',
      VIDEO_FEED_URI,
      DISCOVER_FEED_URI,
    ])
  })

  it('writes the defaults to server preferences', async () => {
    const call = jest.fn().mockResolvedValue(undefined)
    await saveOnboardingFeeds({call} as unknown as Client)
    expect(call).toHaveBeenCalledTimes(1)
    expect(call.mock.calls[0]).toEqual([
      overwriteSavedFeeds,
      expect.arrayContaining([
        expect.objectContaining({value: DEFAULT_FEED_URI, pinned: true}),
      ]),
    ])
  })
})
