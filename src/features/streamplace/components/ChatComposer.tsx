import {useState} from 'react'
import {Pressable, TextInput, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {countGraphemes} from 'unicode-segmenter/grapheme'

import {useRequireAuth, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {PaperPlaneVertical_Filled_Stroke2_Corner1_Rounded as PaperPlaneIcon} from '#/components/icons/PaperPlane'

/** Limit from the place.stream.chat.message lexicon. */
const MAX_GRAPHEMES = 300

/**
 * Chat input. Logged out, it's replaced by a prompt to sign in.
 */
export function ChatComposer({
  onSend,
  disabled: notReady = false,
}: {
  onSend: (text: string) => void
  disabled?: boolean
}) {
  const {hasSession} = useSession()
  return hasSession ? (
    <Composer onSend={onSend} notReady={notReady} />
  ) : (
    <SignInToChat />
  )
}

function SignInToChat() {
  const {t: l} = useLingui()
  const t = useTheme()
  const requireAuth = useRequireAuth()
  return (
    <View style={[a.px_md, a.py_sm, a.border_t, t.atoms.border_contrast_low]}>
      <Button
        testID="liveChatSignInBtn"
        label={l`Sign in to chat`}
        onPress={() => requireAuth(() => {})}
        size="small"
        color="secondary">
        <ButtonText>
          <Trans>Sign in to chat</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function Composer({
  onSend,
  notReady,
}: {
  onSend: (text: string) => void
  notReady: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [text, setText] = useState('')
  const trimmed = text.trim()
  const disabled =
    notReady || trimmed.length === 0 || countGraphemes(text) > MAX_GRAPHEMES

  const submit = () => {
    if (disabled) return
    setText('')
    onSend(trimmed)
  }

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_md,
        a.py_sm,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <TextInput
        testID="liveChatInput"
        value={text}
        onChangeText={setText}
        placeholder={l`Send a message…`}
        accessibilityLabel={l`Chat message`}
        accessibilityHint={l`Press return to send`}
        returnKeyType="send"
        submitBehavior="submit"
        placeholderTextColor={t.atoms.text_contrast_medium.color}
        style={[
          a.flex_1,
          a.px_md,
          a.py_sm,
          a.rounded_full,
          a.border,
          a.text_md,
          t.atoms.bg_contrast_25,
          t.atoms.border_contrast_low,
          t.atoms.text,
          {minHeight: 40},
        ]}
        onSubmitEditing={submit}
      />
      <Pressable
        testID="liveChatSendBtn"
        accessibilityRole="button"
        accessibilityLabel={l`Send`}
        accessibilityHint=""
        accessibilityState={{disabled}}
        onPress={submit}
        disabled={disabled}
        style={[
          a.rounded_full,
          a.align_center,
          a.justify_center,
          {
            width: 40,
            height: 40,
            backgroundColor: t.palette.primary_500,
            opacity: disabled ? 0.5 : 1,
          },
        ]}>
        <PaperPlaneIcon size="md" fill={t.palette.white} />
      </Pressable>
    </View>
  )
}
