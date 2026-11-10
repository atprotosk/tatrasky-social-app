import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenPdsAccountPage} from '#/lib/hooks/useOpenPdsAccountPage'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {useDialogContext} from '#/components/Dialog'
import {Text} from '#/components/Typography'

/**
 * OAuth sessions can't change the email or manage email 2FA, so point the user
 * at their hosting provider's account page instead.
 */
export function OAuthAccountPage({
  action,
}: {
  action: 'changeEmail' | 'manageEmail2FA'
}) {
  const {t: l} = useLingui()
  const control = useDialogContext()
  const {host, open} = useOpenPdsAccountPage()
  const isChangingEmail = action === 'changeEmail'

  return (
    <View style={[a.gap_lg]}>
      <Text style={[a.text_xl, a.font_bold, a.leading_snug]}>
        {isChangingEmail ? (
          <Trans>Change your email with your hosting provider</Trans>
        ) : (
          <Trans>Manage email 2FA with your hosting provider</Trans>
        )}
      </Text>
      <Admonition type="info">
        {isChangingEmail ? (
          <Trans>
            Your email address is managed by your hosting provider ({host}).
            Open your account settings there to change it.
          </Trans>
        ) : (
          <Trans>
            Email 2FA is managed by your hosting provider ({host}). Open your
            account settings there to turn it on or off.
          </Trans>
        )}
      </Admonition>
      <Button
        testID={
          isChangingEmail
            ? 'oauthChangeEmailAccountPageButton'
            : 'oauthEmail2FAAccountPageButton'
        }
        label={l`Open account settings`}
        accessibilityHint={l`Opens your hosting provider's account settings`}
        color="primary"
        size="large"
        onPress={() => {
          control.close(() => open())
        }}>
        <ButtonText>
          <Trans>Open account settings</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
