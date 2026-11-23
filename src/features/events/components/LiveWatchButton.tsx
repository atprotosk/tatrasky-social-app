import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {type NavigationProp} from '#/lib/routes/types'
import {Button, ButtonText} from '#/components/Button'
import {BRAND} from '#/config/brand'
import {parseStreamplaceActor} from '#/features/streamplace/url'
import {type ParsedEvent} from '../record'
import {useEventLive} from '../useEventLive'

/**
 * Shown while the event's Streamplace channel is live. Opens the stream in
 * the app's own player when Live is enabled, otherwise on Streamplace.
 */
export function LiveWatchButton({parsed}: {parsed: ParsedEvent}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const openLink = useOpenLink()
  const live = useEventLive(parsed)
  if (!live || !parsed.streamplaceUrl) return null
  const url = parsed.streamplaceUrl
  const actor = BRAND.live.enabled ? parseStreamplaceActor(url) : undefined
  return (
    <Button
      label={l`Live now, watch the stream`}
      size="tiny"
      color="negative"
      onPress={e => {
        e.preventDefault()
        e.stopPropagation()
        if (actor) {
          navigation.push('LiveWatch', {actor})
        } else {
          void openLink(url, undefined, true)
        }
      }}>
      <ButtonText>
        {l({
          message: 'LIVE · Watch',
          comment: 'Button on an event whose livestream is on air right now',
        })}
      </ButtonText>
    </Button>
  )
}
