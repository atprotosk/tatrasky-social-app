import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {useVideoPlayer, VideoView} from 'expo-video'
import {useIsFocused} from '@react-navigation/native'

import {atoms as a} from '#/alf'
import {LiveOffline} from '#/features/streamplace/components/LiveOffline'
import {livePlaylistUrl} from '#/features/streamplace/url'

const RETRY_MS = 2000
const OFFLINE_AFTER_MS = 10_000

/**
 * Plays a Streamplace livestream over HLS. Keeps retrying while the stream
 * is reachable and shows an offline overlay once it's clearly gone.
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
  const source = livePlaylistUrl(did)
  const player = useVideoPlayer(source, p => {
    p.play()
  })
  const [failing, setFailing] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  const reload = () => {
    player.replace(source)
    player.play()
  }

  const isFocused = useIsFocused()
  useEffect(() => {
    if (isFocused) {
      player.play()
    } else {
      player.pause()
    }
  }, [isFocused, player])

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined
    let offlineTimer: ReturnType<typeof setTimeout> | undefined
    const sub = player.addListener('statusChange', ({status}) => {
      if (status === 'readyToPlay') {
        clearTimeout(offlineTimer)
        offlineTimer = undefined
        setFailing(false)
        setTimedOut(false)
        return
      }
      if (status !== 'error') return
      setFailing(true)
      if (!offlineTimer) {
        offlineTimer = setTimeout(() => setTimedOut(true), OFFLINE_AFTER_MS)
      }
      clearTimeout(retry)
      retry = setTimeout(() => {
        player.replace(source)
        player.play()
      }, RETRY_MS)
    })
    return () => {
      sub.remove()
      clearTimeout(retry)
      clearTimeout(offlineTimer)
    }
  }, [player, source])

  return (
    <View
      testID="livePlayer"
      style={[a.w_full, {aspectRatio: 16 / 9, backgroundColor: 'black'}]}>
      <VideoView
        player={player}
        style={a.flex_1}
        nativeControls
        fullscreenOptions={{enable: true, orientation: 'landscape'}}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      {failing && (notLive || timedOut) && <LiveOffline onRetry={reload} />}
    </View>
  )
}
