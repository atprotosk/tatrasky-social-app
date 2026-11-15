import {FlatList, Pressable, View} from 'react-native'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {useGlobalReportDialogControl} from '#/components/moderation/ReportDialog'
import {Text} from '#/components/Typography'
import {type ChatMessage} from '#/features/streamplace/live-state'
import {type PendingMessage} from '#/features/streamplace/pending'
import {type app} from '#/lexicons'

/**
 * A chat message whose author passed the viewer's moderation.
 */
export type VisibleMessage = {
  message: ChatMessage
  profile: app.bsky.actor.defs.ProfileViewDetailed
}

type ChatItem =
  | {kind: 'message'; item: VisibleMessage}
  | {kind: 'pending'; item: PendingMessage}

/**
 * Live chat, newest at the bottom. Long-press a message to report its author.
 */
export function ChatList({
  messages,
  pending,
  moderationOpts,
  onRetry,
}: {
  messages: VisibleMessage[]
  pending: PendingMessage[]
  moderationOpts: ModerationOpts
  onRetry: (message: PendingMessage) => void
}) {
  const t = useTheme()
  const data: ChatItem[] = [
    ...messages.map(item => ({kind: 'message' as const, item})),
    ...pending.map(item => ({kind: 'pending' as const, item})),
  ].reverse()

  return (
    <FlatList
      testID="liveChatList"
      inverted
      data={data}
      style={a.flex_1}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item: ChatItem) =>
        item.kind === 'message'
          ? item.item.message.uri
          : `pending:${item.item.localId}`
      }
      ListEmptyComponent={
        <Text
          style={[
            a.px_md,
            a.py_lg,
            a.text_center,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>No messages yet</Trans>
        </Text>
      }
      renderItem={({item}: {item: ChatItem}) =>
        item.kind === 'pending' ? (
          <PendingRow message={item.item} onRetry={onRetry} />
        ) : (
          <MessageRow item={item.item} moderationOpts={moderationOpts} />
        )
      }
    />
  )
}

function PendingRow({
  message,
  onRetry,
}: {
  message: PendingMessage
  onRetry: (message: PendingMessage) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const failed = message.status === 'failed'
  return (
    <Pressable
      disabled={!failed}
      onPress={() => onRetry(message)}
      accessibilityRole={failed ? 'button' : undefined}
      accessibilityLabel={failed ? l`Retry sending message` : undefined}
      accessibilityHint=""
      style={[a.px_md, a.py_xs, !failed && {opacity: 0.5}]}>
      <Text style={[a.text_xs, failed && {color: t.palette.negative_500}]}>
        {failed ? l`Not delivered – tap to retry` : l`Sending…`}
      </Text>
      <Text emoji>{message.text}</Text>
    </Pressable>
  )
}

function MessageRow({
  item,
  moderationOpts,
}: {
  item: VisibleMessage
  moderationOpts: ModerationOpts
}) {
  const {t: l} = useLingui()
  const reportDialogControl = useGlobalReportDialogControl()
  const {message, profile} = item
  const moderation = moderateProfile(profile, moderationOpts)
  const displayName = sanitizeDisplayName(
    profile.displayName ||
      (profile.handle === 'handle.invalid' ? message.handle : profile.handle),
    moderation.ui('displayName'),
  )

  return (
    <Pressable
      onLongPress={() =>
        reportDialogControl.open({
          subject: {
            ...profile,
            $type: 'app.bsky.actor.defs#profileViewDetailed',
          },
        })
      }
      accessibilityLabel={`${displayName}: ${message.text}`}
      accessibilityHint={l`Long press to report this account`}
      style={[a.px_md, a.py_xs, a.flex_row, a.gap_sm, a.align_start]}>
      <View style={{paddingTop: 1}}>
        <UserAvatar
          type="user"
          size={20}
          avatar={profile.avatar}
          moderation={moderation.ui('avatar')}
        />
      </View>
      <Text emoji style={[a.flex_1, a.leading_snug]}>
        <Text emoji style={[a.font_semi_bold, a.leading_snug]}>
          {displayName}
        </Text>{' '}
        {message.text}
      </Text>
    </Pressable>
  )
}
