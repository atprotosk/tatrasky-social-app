import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Poll_Stroke2_Corner0_Rounded as PollIcon} from '#/components/icons/Poll'

export function SelectPollBtn({
  onPress,
  disabled = false,
}: {
  onPress: () => void
  disabled?: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()

  return (
    <Button
      testID="openPollBtn"
      onPress={onPress}
      label={l({
        message: 'Add poll',
        comment:
          'Accessibility label for the button in the post composer that attaches a poll to the post.',
      })}
      accessibilityHint={l({
        message: 'Attaches a poll to this post',
        comment:
          'Accessibility hint announced after the poll button label, describing what activating it will do.',
      })}
      style={a.p_sm}
      variant="ghost"
      shape="round"
      color="primary"
      disabled={disabled}>
      <PollIcon size="lg" style={disabled && t.atoms.text_contrast_low} />
    </Button>
  )
}
