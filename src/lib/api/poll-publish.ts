import {TID} from '@atproto/common-web'
import {type Client} from '@atproto/lex'

import {type PollDraft, pollEndsAt, pollOptionsForPublish} from '#/lib/api/poll'
import {logger} from '#/logger'
import {
  TOKIMEKI_HOSTS,
  TOKIMEKI_POLL_COLLECTION,
} from '#/features/tokimeki/types'
import {com} from '#/lexicons'

/**
 * The post a poll belongs to, by URI only: the post points back at the poll
 * with a strongRef (`external.associatedRefs`), so it is written after the
 * poll and its CID isn't known yet. TOKIMEKI's lexicon makes the CID optional
 * for exactly this.
 */
export type PollPostRef = {uri: string}

export function tokimekiPollUrl(did: string, rkey: string): string {
  return `https://${TOKIMEKI_HOSTS[0]}/p/${did}/${rkey}`
}

function pollRecord(draft: PollDraft, post: PollPostRef, now: Date) {
  return {
    $type: TOKIMEKI_POLL_COLLECTION,
    subject: {uri: post.uri},
    options: pollOptionsForPublish(draft),
    createdAt: now.toISOString(),
    endsAt: pollEndsAt(draft, now),
  }
}

/**
 * Writes a `tech.tokimeki.poll.poll` record to the author's repo. `putRecord`
 * keeps a retry on the same key rather than leaving duplicate records behind.
 */
export async function createPoll(
  client: Client,
  draft: PollDraft,
  post: PollPostRef,
  now = new Date(),
): Promise<{rkey: string; uri: string; cid: string}> {
  const rkey = draft.rkey ?? TID.nextStr()
  const res = await client.call(com.atproto.repo.putRecord, {
    repo: client.assertDid,
    collection: TOKIMEKI_POLL_COLLECTION,
    rkey,
    record: pollRecord(draft, post, now),
    // The PDS does not know this lexicon.
    validate: false,
  })
  return {rkey, uri: res.uri, cid: res.cid}
}

/** Removes a poll left behind by a post that never got written. */
export async function deletePoll(client: Client, rkey: string): Promise<void> {
  try {
    await client.call(com.atproto.repo.deleteRecord, {
      repo: client.assertDid,
      collection: TOKIMEKI_POLL_COLLECTION,
      rkey,
    })
  } catch (err) {
    logger.warn('Could not clean up an unsent poll', {safeMessage: err})
  }
}
