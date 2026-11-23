import {RichText} from '@bsky/sdk/richtext'

import {type PollDraft} from '#/lib/api/poll'
import {type ComposerImage} from '#/state/gallery'
import {
  type ComposerAction,
  composerReducer,
  type ComposerState,
  createComposerState,
  isPollPostable,
  type PostAction,
  postHasAttachment,
  threadHasPoll,
} from './composer'

jest.mock('#/state/gallery', () => ({
  createInitialImages: jest.fn(),
}))
jest.mock('#/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}))
jest.mock('#/state/queries/postgate/util', () => ({
  createPostgateRecord: jest.fn(() => ({})),
}))
jest.mock('#/state/queries/threadgate', () => ({
  threadgateRecordToAllowUISetting: jest.fn(() => []),
}))

const image = {
  source: {id: 'img-1', path: 'file://a', mime: 'image/jpeg'},
} as unknown as ComposerImage

function createState() {
  return createComposerState({
    initText: undefined,
    initExternalUri: undefined,
    initEditPost: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
}

function apply(
  state: ComposerState,
  actions: PostAction[],
  postIndex = 0,
): ComposerState {
  for (const postAction of actions) {
    state = composerReducer(state, {
      type: 'update_post',
      postId: state.thread.posts[postIndex].id,
      postAction,
    })
  }
  return state
}

function postAfter(actions: PostAction[]) {
  return apply(createState(), actions).thread.posts[0]
}

const withText = (text: string): PostAction => ({
  type: 'update_richtext',
  richtext: new RichText({text}),
})

describe('composer polls', () => {
  it('adds an empty two-choice poll', () => {
    const post = postAfter([{type: 'embed_add_poll'}])
    expect(post.embed.poll).toEqual({options: ['', ''], duration: '1d'})
    expect(postHasAttachment(post)).toBe(true)
  })

  it('offers one spare choice once every choice has text, up to four', () => {
    let post = postAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_update_poll_option', index: 0, text: 'Yes'},
      {type: 'embed_update_poll_option', index: 1, text: 'No'},
    ])
    expect(post.embed.poll?.options).toEqual(['Yes', 'No', ''])

    post = postAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_update_poll_option', index: 0, text: 'A'},
      {type: 'embed_update_poll_option', index: 1, text: 'B'},
      {type: 'embed_update_poll_option', index: 2, text: 'C'},
      {type: 'embed_update_poll_option', index: 3, text: 'D'},
    ])
    expect(post.embed.poll?.options).toEqual(['A', 'B', 'C', 'D'])
  })

  it('a preset duration replaces a custom closing time', () => {
    const post = postAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_end', endsAt: '2030-01-01T12:00'},
      {type: 'embed_set_poll_duration', duration: '3d'},
    ])
    expect(post.embed.poll).toMatchObject({duration: '3d', endsAt: undefined})
  })

  it('keeps the record key picked while publishing', () => {
    const post = postAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_rkey', rkey: '3abc'},
    ])
    expect(post.embed.poll?.rkey).toBe('3abc')
  })

  it('removes the poll', () => {
    const post = postAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_remove_poll'},
    ])
    expect(post.embed.poll).toBeUndefined()
  })

  it('refuses media, links and GIFs while a poll is attached', () => {
    const post = postAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_add_images', images: [image]},
      {type: 'embed_add_uri', uri: 'https://example.com'},
    ])
    expect(post.embed.media).toBeUndefined()
    expect(post.embed.link).toBeUndefined()
    expect(post.embed.poll).toBeDefined()
  })

  it('refuses a poll on a post that already has an attachment', () => {
    const post = postAfter([
      {type: 'embed_add_uri', uri: 'https://example.com'},
      {type: 'embed_add_poll'},
    ])
    expect(post.embed.poll).toBeUndefined()
  })

  it('allows only one poll per thread', () => {
    let state = apply(createState(), [{type: 'embed_add_poll'}])
    state = composerReducer(state, {type: 'add_post'})
    state = apply(state, [{type: 'embed_add_poll'}], 1)
    expect(state.thread.posts[1].embed.poll).toBeUndefined()
    expect(threadHasPoll(state.thread)).toBe(true)
  })

  it('keeps only the first poll when restoring a draft', () => {
    const base = createState().thread.posts[0]
    const poll: PollDraft = {options: ['A', 'B'], duration: '1d'}
    const action: ComposerAction = {
      type: 'restore_from_draft',
      draftId: 'draft',
      posts: [
        {...base, id: 'a', embed: {...base.embed, poll}},
        {...base, id: 'b', embed: {...base.embed, poll}},
      ],
      threadgateAllow: undefined,
      postgateEmbeddingRules: undefined,
      loadedMedia: new Map(),
      originalLocalRefs: new Set(),
    }
    const state = composerReducer(createState(), action)
    expect(state.thread.posts[0].embed.poll).toEqual(poll)
    expect(state.thread.posts[1].embed.poll).toBeUndefined()
  })

  describe('isPollPostable', () => {
    it('is true for a post without a poll', () => {
      expect(isPollPostable(postAfter([]))).toBe(true)
    })

    it('needs the question as post text and two valid choices', () => {
      const choices: PostAction[] = [
        {type: 'embed_add_poll'},
        {type: 'embed_update_poll_option', index: 0, text: 'Yes'},
        {type: 'embed_update_poll_option', index: 1, text: 'No'},
      ]
      expect(isPollPostable(postAfter(choices))).toBe(false)
      expect(isPollPostable(postAfter([...choices, withText('Tea?')]))).toBe(
        true,
      )
      expect(
        isPollPostable(
          postAfter([
            withText('Tea?'),
            {type: 'embed_add_poll'},
            {type: 'embed_update_poll_option', index: 0, text: 'Yes'},
          ]),
        ),
      ).toBe(false)
    })
  })
})
