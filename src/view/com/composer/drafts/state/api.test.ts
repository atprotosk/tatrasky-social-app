import {type LinkResolvers} from '#/lib/api/resolve'
import {
  composerReducer,
  createComposerState,
} from '#/view/com/composer/state/composer'
import {app} from '#/lexicons'
import {composerStateToDraft, draftToComposerPosts} from './api'

jest.mock('#/lib/api/resolve', () => ({resolveLink: jest.fn()}))
jest.mock('#/lib/deviceName', () => ({getDeviceName: () => 'Test device'}))
jest.mock('#/lib/media/manip', () => ({getImageDim: jest.fn()}))
jest.mock('#/lib/media/video/util', () => ({mimeToExt: jest.fn()}))
jest.mock('#/analytics/identifiers', () => ({getDeviceId: () => 'test-device'}))
jest.mock('#/state/gallery', () => ({createInitialImages: jest.fn()}))
jest.mock('#/state/queries/threadgate/util', () => ({
  threadgateAllowUISettingToAllowRecordValue: () => [],
}))
jest.mock('#/state/queries/threadgate', () => ({
  threadgateRecordToAllowUISetting: () => [],
}))
jest.mock('#/state/queries/postgate/util', () => ({
  createPostgateRecord: () => ({}),
}))
jest.mock('./logger', () => ({logger: {debug: jest.fn()}}))
jest.mock('./storage', () => ({}))

it('restores legacy seasonal drafts as ordinary posts without losing their text', async () => {
  let state = createComposerState({
    initText: 'Trick or treat',
    initExternalUri: undefined,
    initEditPost: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
  state = composerReducer(state, {type: 'add_post'})
  const {draft} = await composerStateToDraft({} as LinkResolvers, state)
  const legacy = {
    ...draft,
    posts: draft.posts.map((post, index) =>
      index === 0 ? {...post, halloweenCostumeNumber: 3} : post,
    ),
  }
  const parsed = app.bsky.draft.defs.draft.parse(legacy)
  const {posts} = await draftToComposerPosts(parsed, new Map())
  expect(posts).toHaveLength(2)
  expect(posts[0].richtext.text).toBe('Trick or treat')
  expect(posts[0]).not.toHaveProperty('halloweenCostumeNumber')
  expect(posts[1]).not.toHaveProperty('halloweenCostumeNumber')
})

it('keeps a poll, with its custom closing time, through a saved draft', async () => {
  let state = createComposerState({
    initText: 'Tea or coffee?',
    initExternalUri: undefined,
    initEditPost: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
  const postId = state.thread.posts[0].id
  for (const postAction of [
    {type: 'embed_add_poll'},
    {type: 'embed_update_poll_option', index: 0, text: 'Tea'},
    {type: 'embed_update_poll_option', index: 1, text: 'Coffee'},
    {type: 'embed_set_poll_end', endsAt: '2030-01-01T12:00'},
    {type: 'embed_set_poll_rkey', rkey: '3abc'},
  ] as const) {
    state = composerReducer(state, {type: 'update_post', postId, postAction})
  }
  const {draft} = await composerStateToDraft({} as LinkResolvers, state)
  const parsed = app.bsky.draft.defs.draft.parse(draft)
  const {posts} = await draftToComposerPosts(parsed, new Map())
  // The record key belongs to one publish attempt and is not saved.
  expect(posts[0].embed.poll).toEqual({
    options: ['Tea', 'Coffee', ''],
    duration: '1d',
    endsAt: '2030-01-01T12:00',
  })
})
