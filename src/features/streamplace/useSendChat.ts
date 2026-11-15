import {useEffect, useMemo, useRef, useState} from 'react'

import {logger} from '#/logger'
import {usePdsClient} from '#/state/session'
import {com} from '#/lexicons'
import {type ChatMessage} from './live-state'
import {type PendingMessage, reconcilePending} from './pending'

const COLLECTION = 'place.stream.chat.message'
export const CHAT_DELIVERY_TIMEOUT_MS = 10_000

/**
 * Sends chat messages as `place.stream.chat.message` records in the viewer's
 * own repo and tracks them as pending until the node echoes them back.
 */
export function useSendChat(
  streamerDid: string | undefined,
  messages: ChatMessage[],
) {
  const pdsClient = usePdsClient()
  const [pending, setPending] = useState<PendingMessage[]>([])
  const retrying = useRef(new Set<string>())
  // Memoized because it's an effect dependency.
  const seenUris = useMemo(() => new Set(messages.map(m => m.uri)), [messages])

  useEffect(() => {
    const initial = setTimeout(
      () =>
        setPending(prev =>
          reconcilePending(
            prev,
            seenUris,
            Date.now(),
            CHAT_DELIVERY_TIMEOUT_MS,
          ),
        ),
      0,
    )
    const id = setInterval(
      () =>
        setPending(prev =>
          reconcilePending(
            prev,
            seenUris,
            Date.now(),
            CHAT_DELIVERY_TIMEOUT_MS,
          ),
        ),
      2000,
    )
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [seenUris])

  const send = async (text: string, replacing?: PendingMessage) => {
    if (!streamerDid || !pdsClient.did) return
    if (replacing) {
      if (retrying.current.has(replacing.localId)) return
      retrying.current.add(replacing.localId)
    }
    const localId = `${Date.now()}-${Math.random()}`
    setPending(prev => [
      ...prev.filter(m => m.localId !== replacing?.localId),
      {localId, text, sentAt: Date.now(), status: 'sending'},
    ])
    try {
      if (replacing?.uri) {
        const rkey = replacing.uri.split('/').pop()!
        await pdsClient
          .call(com.atproto.repo.deleteRecord, {
            repo: pdsClient.assertDid,
            collection: COLLECTION,
            rkey,
          })
          .catch(() => undefined)
      }
      const res = await pdsClient.call(com.atproto.repo.createRecord, {
        repo: pdsClient.assertDid,
        collection: COLLECTION,
        record: {
          $type: COLLECTION,
          text,
          streamer: streamerDid,
          createdAt: new Date().toISOString(),
        },
      })
      setPending(prev =>
        prev.map(m =>
          m.localId === localId ? {...m, uri: res.uri, sentAt: Date.now()} : m,
        ),
      )
    } catch (err) {
      logger.warn('streamplace: chat send failed', {safeMessage: err})
      setPending(prev =>
        prev.map(m => (m.localId === localId ? {...m, status: 'failed'} : m)),
      )
    }
  }

  return {pending, send}
}
