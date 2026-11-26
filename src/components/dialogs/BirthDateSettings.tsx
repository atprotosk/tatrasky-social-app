import {useMemo, useState} from 'react'
import {View} from 'react-native'
import {type Client} from '@atproto/lex'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQuery} from '@tanstack/react-query'

import {useCleanError} from '#/lib/hooks/useCleanError'
import {isAppPassword} from '#/lib/jwt'
import {getAge, getDateAgo} from '#/lib/strings/time'
import {logger} from '#/logger'
import {
  useBirthdateMutation,
  useIsBirthdateUpdateAllowed,
} from '#/state/birthdate'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {useSession} from '#/state/session'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DateField} from '#/components/forms/DateField'
import {SimpleInlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Span, Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {IS_IOS, IS_WEB} from '#/env'
import {ConfirmPasswordForm} from '#/features/passwordConfirmation/ConfirmPasswordForm'
import {useConfirmedSession} from '#/features/passwordConfirmation/useConfirmedSession'
import {app} from '#/lexicons'

export function BirthDateSettingsDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const isBirthdateUpdateAllowed = useIsBirthdateUpdateAllowed()
  const {currentAccount} = useSession()
  const isOauthSession = currentAccount?.isOauthSession === true
  const [isSaving, setIsSaving] = useState(false)

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      preventDismiss={isSaving}>
      <Dialog.Handle />
      {isBirthdateUpdateAllowed ? (
        <Dialog.ScrollableInner
          label={l`My birthdate`}
          style={web({maxWidth: 400})}>
          {isOauthSession ? (
            <OAuthBirthday control={control} onSavingChange={setIsSaving} />
          ) : (
            <PasswordSessionBirthday
              control={control}
              onSavingChange={setIsSaving}
            />
          )}

          <Dialog.Close />
        </Dialog.ScrollableInner>
      ) : (
        <Dialog.ScrollableInner
          label={l`You recently changed your birthdate`}
          style={web({maxWidth: 400})}>
          <View style={[a.gap_sm]}>
            <Text
              style={[
                a.text_xl,
                a.font_semi_bold,
                a.leading_snug,
                {paddingRight: 32},
              ]}>
              <Trans>You recently changed your birthdate</Trans>
            </Text>
            <Text
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                There is a limit to how often you can change your birthdate. You
                may need to wait a day or two before updating it again.
              </Trans>
            </Text>
          </View>

          <Dialog.Close />
        </Dialog.ScrollableInner>
      )}
    </Dialog.Outer>
  )
}

function BirthdateHeading() {
  const t = useTheme()
  return (
    <>
      <Text style={[a.text_xl, a.font_semi_bold]}>
        <Trans>My birthdate</Trans>
      </Text>
      <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          This information is private and not shared with other users.
        </Trans>
      </Text>
    </>
  )
}

type BirthdayProps = {
  control: Dialog.DialogControlProps
  onSavingChange: (isSaving: boolean) => void
}

function PasswordSessionBirthday(props: BirthdayProps) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {isLoading, error, data: preferences} = usePreferencesQuery()
  const isUsingAppPassword = isAppPassword(currentAccount?.accessJwt || '')

  return (
    <View style={[a.gap_md]}>
      <BirthdateHeading />

      {isLoading ? (
        <Loader size="xl" />
      ) : error || !preferences ? (
        <LoadError
          error={error}
          fallback={l`We were unable to load your birthdate preferences. Please try again.`}
        />
      ) : isUsingAppPassword ? (
        <Admonition type="info">
          <Trans>
            Hmm, it looks like you're signed in with an{' '}
            <Span style={[a.italic]}>App Password</Span>. To set your birthdate,
            you'll need to sign in with your main account password, or ask
            whomever controls this account to do so.
          </Trans>
        </Admonition>
      ) : (
        <BirthdayInner {...props} birthDate={preferences.birthDate} />
      )}
    </View>
  )
}

/**
 * An OAuth session can neither read nor write the birthdate, so the password is
 * confirmed first and both go through that session. The shared preferences query
 * is deliberately not used: it has no birthdate here, and its cache is persisted.
 */
function OAuthBirthday(props: BirthdayProps) {
  const {client, confirm} = useConfirmedSession()

  if (!client) {
    return <ConfirmPasswordForm onConfirm={confirm} />
  }
  return <ConfirmedBirthday {...props} client={client} />
}

function ConfirmedBirthday({
  client,
  ...props
}: BirthdayProps & {client: Client}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {data, error, isPending} = useQuery({
    queryKey: ['confirmed-birthdate', currentAccount?.did],
    /* the real birthdate: drop it as soon as the dialog closes */
    gcTime: 0,
    staleTime: Infinity,
    queryFn: async () => {
      const {preferences} = await client.call(app.bsky.actor.getPreferences, {})
      const pref = preferences.find(p =>
        app.bsky.actor.defs.personalDetailsPref.$isTypeOf(p),
      )
      return {
        birthDate: pref?.birthDate ? new Date(pref.birthDate) : undefined,
      }
    },
  })

  return (
    <View style={[a.gap_md]}>
      <BirthdateHeading />

      {isPending ? (
        <Loader size="xl" />
      ) : error || !data ? (
        <LoadError
          error={error}
          fallback={l`We were unable to load your birthdate preferences. Please try again.`}
        />
      ) : (
        <BirthdayInner
          {...props}
          birthDate={data.birthDate}
          confirmedClient={client}
        />
      )}
    </View>
  )
}

function LoadError({error, fallback}: {error: unknown; fallback: string}) {
  const cleanError = useCleanError()
  const {raw, clean} = cleanError(error)
  return (
    <ErrorMessage message={clean || raw || fallback} style={[a.rounded_sm]} />
  )
}

function BirthdayInner({
  control,
  onSavingChange,
  birthDate,
  confirmedClient,
}: BirthdayProps & {
  birthDate: Date | undefined
  confirmedClient?: Client
}) {
  const {t: l} = useLingui()
  const cleanError = useCleanError()
  const [date, setDate] = useState(birthDate || getDateAgo(18))
  const {isPending, error, mutateAsync: setBirthDate} = useBirthdateMutation()
  const hasChanged = date?.getTime() !== birthDate?.getTime()
  const errorMessage = useMemo(() => {
    if (error) {
      const {raw, clean} = cleanError(error)
      return clean || raw
    }
  }, [error, cleanError])

  const age = getAge(new Date(date))
  const isUnder13 = age < 13
  const isUnder18 = age >= 13 && age < 18

  /*
   * Saves even an unchanged date: that is how a save which only got halfway
   * through gets repaired.
   */
  const onSave = async () => {
    onSavingChange(true)
    try {
      await setBirthDate({birthDate: date, confirmedClient})
      onSavingChange(false)
      control.close()
    } catch (error) {
      onSavingChange(false)
      const e = error as Error
      logger.error(`setBirthDate failed`, {message: e.message})
    }
  }

  return (
    <View style={a.gap_lg} testID="birthDateSettingsDialog">
      <View style={IS_IOS && [a.w_full, a.align_center]}>
        <DateField
          testID="birthdayInput"
          value={date}
          onChangeDate={newDate => setDate(new Date(newDate))}
          label={l`Birthdate`}
          accessibilityHint={l`Enter your birthdate`}
        />
      </View>
      {isUnder18 && hasChanged && (
        <Admonition type="info">
          <Trans>
            The birthdate you've entered means you are under 18 years old.
            Certain content and features may be unavailable to you.
          </Trans>
        </Admonition>
      )}
      {isUnder13 && (
        <Admonition type="error">
          <Trans>
            You must be at least 13 years old to use mu. Read our{' '}
            <SimpleInlineLinkText
              to={BRAND.links.tos}
              label={l`Terms of Service`}>
              Terms of Service
            </SimpleInlineLinkText>{' '}
            for more information.
          </Trans>
        </Admonition>
      )}
      {errorMessage ? (
        <ErrorMessage message={errorMessage} style={[a.rounded_sm]} />
      ) : undefined}
      <View style={IS_WEB && [a.flex_row, a.justify_end]}>
        <Button
          label={l`Save birthdate`}
          size="large"
          onPress={() => void onSave()}
          variant="solid"
          color="primary"
          disabled={isUnder13 || isPending}>
          <ButtonText>
            <Trans>Save</Trans>
          </ButtonText>
          {isPending && <ButtonIcon icon={Loader} />}
        </Button>
      </View>
    </View>
  )
}
