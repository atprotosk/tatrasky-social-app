import {useState} from 'react'
import {View} from 'react-native'
import {LexAuthFactorError} from '@atproto/lex-password-session'
import {Trans, useLingui} from '@lingui/react/macro'

import {isNetworkError} from '#/lib/strings/errors'
import {checkAndFormatResetCode} from '#/lib/strings/password'
import {toNiceHostingUrl} from '#/lib/strings/url-helpers'
import {getErrorStatus} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {TokenField} from '#/components/dialogs/EmailDialog/components/TokenField'
import {PasswordField} from '#/components/forms/PasswordField'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {ConfirmationError} from './createConfirmedSession'

/**
 * The "confirm your password" step shown before a sensitive action. Inline, so
 * that it can sit inside a dialog without stacking a second one.
 */
export function ConfirmPasswordForm({
  onConfirm,
}: {
  onConfirm: (input: {
    password: string
    authFactorToken?: string
  }) => Promise<void>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const host = toNiceHostingUrl(currentAccount?.pdsUrl ?? '')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [isCodeNeeded, setIsCodeNeeded] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  const messageFor = (e: unknown) => {
    if (e instanceof ConfirmationError) {
      return e.reason === 'limited-password'
        ? l`That’s an app password. Enter your account password instead.`
        : l`We couldn’t verify your account with your hosting provider.`
    }
    if (isNetworkError(e)) {
      return l`Unable to contact your service. Please check your Internet connection.`
    }
    if (String(e).includes('Token is')) {
      return l`Invalid 2FA confirmation code.`
    }
    const status = getErrorStatus(e)
    if (status === 429) {
      return l`Too many attempts. Wait a few minutes and try again.`
    }
    if (status === 401) {
      return l`Incorrect password`
    }
    return l`Something went wrong. Please try again.`
  }

  const onSubmit = async () => {
    if (isPending) return
    if (!password) {
      setError(l`Please enter your password`)
      return
    }
    setError('')
    setIsPending(true)
    try {
      await onConfirm({
        password,
        authFactorToken:
          checkAndFormatResetCode(code) || code.trim() || undefined,
      })
    } catch (e) {
      if (e instanceof LexAuthFactorError) {
        setIsCodeNeeded(true)
      } else {
        /* No error details: they may describe the credentials. */
        logger.debug('passwordConfirmation: confirmation failed', {
          status: getErrorStatus(e),
        })
        setError(messageFor(e))
      }
    }
    setIsPending(false)
  }

  return (
    <View style={[a.gap_md]} testID="confirmPasswordForm">
      <Text style={[a.text_xl, a.font_semi_bold]}>
        <Trans>Confirm your password</Trans>
      </Text>
      <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>For your security, confirm your password to continue.</Trans>
      </Text>

      <View>
        <TextField.LabelText>
          <Trans>Password</Trans>
        </TextField.LabelText>
        <PasswordField
          testID="confirmPasswordInput"
          label={l`Password`}
          placeholder={null}
          autoFocus
          autoComplete="current-password"
          returnKeyType="done"
          value={password}
          onChangeText={value => {
            setPassword(value)
            setError('')
          }}
          onSubmitEditing={() => void onSubmit()}
          editable={!isPending}
        />
      </View>

      {isCodeNeeded && (
        <View>
          <TextField.LabelText>
            <Trans>2FA Confirmation</Trans>
          </TextField.LabelText>
          <TokenField
            testID="confirmPasswordCodeInput"
            autoFocus
            autoComplete="one-time-code"
            returnKeyType="done"
            value={code}
            onChangeText={value => {
              setCode(value)
              setError('')
            }}
            onSubmitEditing={() => void onSubmit()}
            editable={!isPending}
          />
          <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_sm]}>
            <Trans>
              Enter the sign in code from your email or authenticator app.
            </Trans>
          </Text>
        </View>
      )}

      {error ? <Admonition type="error">{error}</Admonition> : null}

      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>Your password is sent only to {host} and is not saved.</Trans>
      </Text>

      <View style={web([a.flex_row, a.justify_end])}>
        <Button
          testID="confirmPasswordButton"
          label={l`Confirm`}
          size="large"
          color="primary"
          disabled={isPending}
          onPress={() => void onSubmit()}>
          <ButtonText>
            <Trans>Confirm</Trans>
          </ButtonText>
          {isPending && <ButtonIcon icon={Loader} />}
        </Button>
      </View>
    </View>
  )
}
