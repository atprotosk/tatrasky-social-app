import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'

/**
 * Overlay shown on top of the player when the stream can't be played.
 */
export function LiveOffline({onRetry}: {onRetry: () => void}) {
  const {t: l} = useLingui()
  return (
    <View
      style={[
        a.absolute,
        a.inset_0,
        a.align_center,
        a.justify_center,
        a.gap_md,
        {backgroundColor: 'rgba(0,0,0,0.7)'},
      ]}>
      <Text style={[a.text_md, {color: 'white'}]}>
        <Trans>This stream is offline</Trans>
      </Text>
      <Button
        label={l`Try again`}
        onPress={onRetry}
        size="small"
        color="secondary">
        <ButtonText>
          <Trans>Try again</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
