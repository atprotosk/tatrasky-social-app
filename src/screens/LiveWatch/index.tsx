import {useMemo} from 'react'
import {Pressable, View} from 'react-native'
import {useKeyboardState} from 'react-native-keyboard-controller'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {moderateProfile} from '@bsky/sdk/moderation'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useExternalEmbedsPrefs} from '#/state/preferences'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfileQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {NotFoundScreen} from '#/view/screens/NotFound'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {EmbedConsentDialog} from '#/components/dialogs/EmbedConsent'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as ExternalIcon} from '#/components/icons/SquareArrowTopRight'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {IS_NATIVE} from '#/env'
import {ChatComposer} from '#/features/streamplace/components/ChatComposer'
import {ChatList} from '#/features/streamplace/components/ChatList'
import {LivePlayer} from '#/features/streamplace/components/LivePlayer'
import {
  isValidStreamplaceActor,
  streamplaceWebUrl,
} from '#/features/streamplace/url'
import {useChatProfiles} from '#/features/streamplace/useChatProfiles'
import {useSendChat} from '#/features/streamplace/useSendChat'
import {useStreamplaceLive} from '#/features/streamplace/useStreamplaceLive'
import {visibleMessages} from '#/features/streamplace/visible'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'LiveWatch'>

/**
 * Watch a Streamplace livestream with its live chat. Ported from Blacksky's
 * StreamplaceWatch screen (MIT, see src/features/streamplace/README.md).
 */
export function LiveWatchScreen({route}: Props) {
  const {actor} = route.params
  const prefs = useExternalEmbedsPrefs()
  const pref = prefs?.streamplace

  if (!BRAND.live.enabled || !isValidStreamplaceActor(actor)) {
    return <NotFoundScreen />
  }

  return (
    <Layout.Screen
      minimalShell
      testID="liveWatchScreen"
      style={web([{minHeight: 0}, a.flex_1])}>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Live</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {pref === 'show' ? (
        <Watch actor={actor} />
      ) : (
        <ConsentGate actor={actor} hidden={pref === 'hide'} />
      )}
    </Layout.Screen>
  )
}

/**
 * Playback contacts a third-party server, so ask first, like other external
 * media.
 */
function ConsentGate({actor, hidden}: {actor: string; hidden: boolean}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()
  const openLink = useOpenLink()

  return (
    <View
      style={[a.flex_1, a.align_center, a.justify_center, a.gap_lg, a.px_lg]}>
      <EmbedConsentDialog
        control={control}
        source="streamplace"
        onAccept={() => undefined}
      />
      <Text style={[a.text_md, a.text_center, a.leading_snug]}>
        {hidden ? (
          <Trans>
            Streamplace media is turned off. You can turn it on in Settings →
            Content and media → External media.
          </Trans>
        ) : (
          <Trans>
            This livestream is hosted by Streamplace. Watch it right here in{' '}
            {BRAND.name}.
          </Trans>
        )}
      </Text>
      {hidden ? (
        <Button
          label={l`Open on stream.place`}
          onPress={() => openLink(streamplaceWebUrl(actor), false)}
          color="secondary"
          size="large">
          <ButtonText>
            <Trans>Open on stream.place</Trans>
          </ButtonText>
          <ButtonIcon icon={ExternalIcon} />
        </Button>
      ) : (
        <Button
          testID="liveWatchConsentBtn"
          label={l`Watch livestream`}
          onPress={control.open}
          color="primary"
          size="large">
          <ButtonText>
            <Trans>Watch livestream</Trans>
          </ButtonText>
        </Button>
      )}
    </View>
  )
}

function Watch({actor}: {actor: string}) {
  const t = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const {data: profile} = useProfileQuery({did: actor})
  const did = actor.startsWith('did:') ? actor : profile?.did
  const live = useStreamplaceLive(did)
  const profiles = useChatProfiles(
    live.messages.map(message => message.authorDid),
  )
  const moderationOpts = useModerationOpts()
  const visible = moderationOpts
    ? visibleMessages(live.messages, profiles, moderationOpts)
    : []
  // Memoized because useSendChat derives an effect dependency from it.
  const visibleChat = useMemo(() => visible.map(v => v.message), [visible])
  const {pending, send} = useSendChat(did, visibleChat)
  const {bottom} = useSafeAreaInsets()
  const keyboardVisible = useKeyboardState(s => s.isVisible)
  const keyboardHeight = useKeyboardState(s => s.height)
  const typing = IS_NATIVE && keyboardVisible

  return (
    <Layout.Center
      style={[
        a.flex_1,
        IS_NATIVE && {paddingBottom: typing ? keyboardHeight : bottom},
      ]}>
      {did ? (
        <LivePlayer did={did} notLive={live.notLive} />
      ) : (
        <View
          style={[a.w_full, {aspectRatio: 16 / 9, backgroundColor: 'black'}]}
        />
      )}
      {!typing && (
        <>
          <StreamerInfo
            actor={actor}
            profile={profile}
            live={live}
            onPress={() => {
              navigation.push('Profile', {name: profile?.did ?? actor})
            }}
          />
          <Text
            style={[
              a.px_md,
              a.py_sm,
              a.font_semi_bold,
              a.border_t,
              t.atoms.border_contrast_low,
            ]}>
            <Trans>Live chat</Trans>
          </Text>
        </>
      )}
      <View style={[a.flex_1, {minHeight: 0}]}>
        {moderationOpts ? (
          <>
            <ChatList
              messages={visible}
              pending={pending}
              moderationOpts={moderationOpts}
              onRetry={message => void send(message.text, message)}
            />
            <ChatComposer onSend={text => void send(text)} disabled={!did} />
          </>
        ) : null}
      </View>
    </Layout.Center>
  )
}

function StreamerInfo({
  actor,
  profile,
  live,
  onPress,
}: {
  actor: string
  profile: ReturnType<typeof useProfileQuery>['data']
  live: ReturnType<typeof useStreamplaceLive>
  onPress: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const openLink = useOpenLink()
  const moderationOpts = useModerationOpts()
  const moderation =
    profile && moderationOpts
      ? moderateProfile(profile, moderationOpts)
      : undefined
  const name = profile
    ? sanitizeDisplayName(
        profile.displayName || sanitizeHandle(profile.handle),
        moderation?.ui('displayName'),
      )
    : actor

  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm, a.px_md, a.py_sm]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={l`Opens profile`}
        style={[a.flex_1, a.flex_row, a.align_center, a.gap_sm]}>
        <UserAvatar
          type="user"
          size={36}
          avatar={profile?.avatar}
          moderation={moderation?.ui('avatar')}
        />
        <View style={[a.flex_1]}>
          <View style={[a.flex_row, a.align_center, a.gap_xs]}>
            <Text
              emoji
              numberOfLines={1}
              style={[a.flex_shrink, a.text_md, a.font_semi_bold]}>
              {name}
            </Text>
            {live.isLive && (
              <View
                style={[
                  a.px_xs,
                  {borderRadius: 4, backgroundColor: t.palette.negative_500},
                ]}>
                <Text
                  style={[
                    a.text_2xs,
                    a.font_semi_bold,
                    {color: 'white', textTransform: 'uppercase'},
                  ]}>
                  <Trans>Live</Trans>
                </Text>
              </View>
            )}
          </View>
          {live.title ? (
            <Text
              emoji
              numberOfLines={2}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {live.title}
            </Text>
          ) : null}
          {live.viewerCount !== undefined && (
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {plural(live.viewerCount, {
                one: '# watching',
                other: '# watching',
              })}
            </Text>
          )}
        </View>
      </Pressable>
      <Button
        label={l`Open on stream.place`}
        onPress={() => openLink(streamplaceWebUrl(actor), false)}
        size="small"
        color="secondary"
        shape="round">
        <ButtonIcon icon={ExternalIcon} />
      </Button>
    </View>
  )
}
