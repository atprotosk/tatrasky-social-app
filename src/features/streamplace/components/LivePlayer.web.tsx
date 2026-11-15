import {useCallback, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'

import {atoms as a} from '#/alf'
import {loadHls} from '#/components/Post/Embed/VideoEmbed/VideoEmbedInner/loadHls'
import {LiveOffline} from '#/features/streamplace/components/LiveOffline'
import {livePlaylistUrl} from '#/features/streamplace/url'

const RETRY_MS = 2000
const OFFLINE_AFTER_MS = 10_000
const MAX_MEDIA_RECOVERIES = 2

/**
 * Web livestream player. Uses hls.js even where the browser claims native HLS
 * support, since Chrome now reports support but plays live CMAF poorly.
 */
export function LivePlayer({
  did,
  notLive = false,
}: {
  /** Streamer DID. */
  did: string
  /** The websocket says the stream ended, so don't wait for the timeout. */
  notLive?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [offline, setOffline] = useState(false)
  const [failing, setFailing] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // useCallback is required by useFocusEffect's contract.
  useFocusEffect(
    useCallback(() => {
      const video = ref.current
      if (video?.paused) void video.play().catch(() => undefined)
      return () => video?.pause()
    }, []),
  )

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const src = livePlaylistUrl(did)
    let disposed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let offlineTimer: ReturnType<typeof setTimeout> | undefined
    let hls: {destroy: () => void} | undefined
    let mediaRecoveries = 0
    setOffline(false)

    const onFailure = (reload: () => void) => {
      setFailing(true)
      if (!offlineTimer) {
        offlineTimer = setTimeout(() => setOffline(true), OFFLINE_AFTER_MS)
      }
      clearTimeout(retry)
      retry = setTimeout(() => {
        if (!disposed) reload()
      }, RETRY_MS)
    }
    const onPlaying = () => {
      mediaRecoveries = 0
      clearTimeout(offlineTimer)
      offlineTimer = undefined
      setOffline(false)
      setFailing(false)
    }
    video.addEventListener('playing', onPlaying)

    void loadHls()
      .then(Hls => {
        if (disposed) return
        if (Hls.isSupported()) {
          const instance = new Hls({
            liveDurationInfinity: true,
            backBufferLength: 10,
          })
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal) return
            if (
              data.type === Hls.ErrorTypes.MEDIA_ERROR &&
              mediaRecoveries++ < MAX_MEDIA_RECOVERIES
            ) {
              instance.recoverMediaError()
              return
            }
            onFailure(() => {
              instance.loadSource(src)
              instance.startLoad()
            })
          })
          instance.attachMedia(video)
          instance.loadSource(src)
          hls = instance
        } else {
          const load = () => {
            video.src = src
            video.load()
            void video.play().catch(() => undefined)
          }
          video.onerror = () => onFailure(load)
          load()
        }
      })
      .catch(() => {
        if (!disposed) {
          setFailing(true)
          setOffline(true)
        }
      })

    return () => {
      disposed = true
      clearTimeout(retry)
      clearTimeout(offlineTimer)
      video.removeEventListener('playing', onPlaying)
      video.onerror = null
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [did, attempt])

  return (
    <View
      testID="livePlayer"
      style={[a.w_full, {aspectRatio: 16 / 9, backgroundColor: 'black'}]}>
      <video
        ref={ref}
        controls
        autoPlay
        muted
        playsInline
        style={{width: '100%', height: '100%', backgroundColor: 'black'}}
      />
      {failing && (notLive || offline) && (
        <LiveOffline onRetry={() => setAttempt(n => n + 1)} />
      )}
    </View>
  )
}
