import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {cleanError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {oauthCreateAccount, oauthSignIn} from '#/state/session/oauth-web-client'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import * as TextField from '#/components/forms/TextField'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {type com} from '#/lexicons'
import {FormContainer} from './FormContainer'

type ServiceDescription = com.atproto.server.describeServer.$OutputBody

type Props = {
  error: string
  serviceUrl: string
  serviceDescription: ServiceDescription | undefined
  initialHandle: string
  setError: (v: string) => void
  setServiceUrl: (v: string) => void
  onPressRetryConnect: () => void
  onPressBack: () => void
  onPressForgotPassword: () => void
  onAttemptSuccess: () => void
  onAttemptFailed: () => void
}

/**
 * Eurosky fork: web sign-in entry. OAuth only - the user is sent to their
 * hosting provider to sign in, and sensitive account operations later go to
 * that provider's account page. Prop type matches upstream LoginForm so
 * screens/Login/index.tsx renders it with the same props on web.
 */
export function OAuthSignin({
  error,
  initialHandle,
  setError,
  onPressBack,
}: Props) {
  const {t: l} = useLingui()
  const [isProcessing, setIsProcessing] = useState(false)
  const [handle, setHandle] = useState(initialHandle)

  const onPressSignIn = async () => {
    if (isProcessing) return
    const value = handle.trim().replace(/^@/, '')
    if (!value) {
      setError(l`Please enter your handle to sign in.`)
      return
    }
    setError('')
    setIsProcessing(true)
    try {
      await oauthSignIn(value)
    } catch (e) {
      logger.warn('oauth: signIn failed', {message: String(e)})
      setError(cleanError(e))
      setIsProcessing(false)
    }
  }

  const onPressCreateAccount = async () => {
    if (isProcessing) return
    setError('')
    setIsProcessing(true)
    try {
      await oauthCreateAccount()
    } catch (e) {
      logger.warn('oauth: createAccount failed', {message: String(e)})
      setError(cleanError(e))
      setIsProcessing(false)
    }
  }

  return (
    <FormContainer testID="oauthSigninForm" titleText={<Trans>Sign in</Trans>}>
      <View>
        <TextField.LabelText>
          <Trans>Account handle</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Icon icon={At} />
          <TextField.Input
            testID="loginHandleInput"
            label={l`Account handle`}
            autoCapitalize="none"
            autoFocus
            autoCorrect={false}
            autoComplete="username"
            keyboardType="default"
            returnKeyType="go"
            defaultValue={initialHandle}
            onChangeText={setHandle}
            onSubmitEditing={() => void onPressSignIn()}
            blurOnSubmit={false}
            editable={!isProcessing}
            accessibilityHint={l`Enter the handle of the account you want to sign in with`}
          />
        </TextField.Root>
      </View>

      <Text style={[a.text_sm, a.pl_sm]}>
        <Trans>
          You'll be sent to your account's hosting provider to sign in securely.
        </Trans>
      </Text>

      <FormError error={error} />

      <View style={[a.gap_sm]}>
        <Button
          testID="loginSignInButton"
          label={l`Sign in`}
          accessibilityHint={l`Sign in with your handle via OAuth`}
          variant="solid"
          color="primary"
          size="large"
          onPress={() => void onPressSignIn()}
          disabled={isProcessing}>
          <ButtonText>
            <Trans>Sign in</Trans>
          </ButtonText>
          {isProcessing && <ButtonIcon icon={Loader} />}
        </Button>
        <Button
          testID="loginCreateAccountButton"
          label={l`Create a new account`}
          accessibilityHint={l`Create a new ${BRAND.name} account`}
          variant="solid"
          color="secondary"
          size="large"
          onPress={() => void onPressCreateAccount()}
          disabled={isProcessing}>
          <ButtonText>
            <Trans>Create a new account</Trans>
          </ButtonText>
        </Button>
        <Button
          testID="loginBackButton"
          label={l`Back`}
          variant="ghost"
          color="secondary"
          size="large"
          onPress={onPressBack}
          disabled={isProcessing}>
          <ButtonText>
            <Trans>Back</Trans>
          </ButtonText>
        </Button>
      </View>
    </FormContainer>
  )
}
