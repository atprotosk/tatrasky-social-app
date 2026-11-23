import {View} from 'react-native'
import {Image} from 'expo-image'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Eye_Stroke2_Corner0_Rounded as EyeIcon} from '#/components/icons/Eye'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {liveThumbnailUrl} from '#/features/streamplace/url'
import {type LiveUser} from '#/features/streamplace/useLiveUsersQuery'

/**
 * A stream in the Live tab: thumbnail with a LIVE badge and viewer count,
 * then the title and streamer.
 */
export function LiveStreamCard({
  liveUser,
  moderationOpts,
}: {
  liveUser: LiveUser
  moderationOpts?: ModerationOpts
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {stream, profile} = liveUser
  const moderation =
    profile && moderationOpts
      ? moderateProfile(profile, moderationOpts)
      : undefined
  const handle = profile?.handle ?? stream.author.handle
  const name = sanitizeDisplayName(
    profile?.displayName ||
      (handle ? sanitizeHandle(handle) : stream.author.did),
    moderation?.ui('displayName'),
  )
  const title = stream.record.title || l`${name} is live`
  const viewers = stream.viewerCount?.count
  // Thumbnails are hidden for streamers the viewer's labelers flag.
  const hideThumb = !!moderation?.ui('avatar').blur

  return (
    <Link
      testID={`liveStreamCard-${handle ?? stream.author.did}`}
      to={`/live/${stream.author.did}`}
      label={
        viewers
          ? l`Watch ${title} by ${name}, ${plural(viewers, {
              one: '# viewer',
              other: '# viewers',
            })}`
          : l`Watch ${title} by ${name}`
      }
      accessibilityHint=""
      style={[a.flex_col, a.w_full, a.align_start, a.gap_sm]}>
      <View
        style={[
          a.w_full,
          a.relative,
          a.overflow_hidden,
          a.rounded_md,
          t.atoms.bg_contrast_25,
          {aspectRatio: 16 / 9},
        ]}>
        {!hideThumb && (
          <Image
            source={liveThumbnailUrl(stream.author.did)}
            contentFit="cover"
            style={[a.absolute, a.inset_0]}
            accessible={false}
            recyclingKey={stream.uri}
          />
        )}
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            a.flex_row,
            a.align_center,
            a.gap_xs,
            {top: 6, left: 6},
          ]}>
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_xs,
              a.px_xs,
              a.py_2xs,
              {
                paddingRight: 6,
                borderRadius: 5,
                backgroundColor: t.palette.negative_500,
              },
            ]}>
            <View
              style={[
                a.rounded_full,
                {width: 5, height: 5, backgroundColor: 'white'},
              ]}
            />
            <Text
              style={[
                a.text_xs,
                a.font_semi_bold,
                {color: 'white', textTransform: 'uppercase'},
              ]}>
              <Trans>Live</Trans>
            </Text>
          </View>
          {viewers ? (
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.gap_2xs,
                a.px_xs,
                a.py_2xs,
                {borderRadius: 5, backgroundColor: 'rgba(0, 0, 0, 0.75)'},
              ]}>
              <EyeIcon size="xs" fill="white" />
              <Text style={[a.text_xs, a.font_semi_bold, {color: 'white'}]}>
                {viewers}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[a.flex_row, a.align_start, a.gap_xs, a.w_full]}>
        <UserAvatar
          type="user"
          size={24}
          avatar={profile?.avatar}
          moderation={moderation?.ui('avatar')}
        />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text
            emoji
            numberOfLines={2}
            style={[a.text_sm, a.font_semi_bold, a.leading_snug]}>
            {title}
          </Text>
          <Text
            emoji
            numberOfLines={1}
            style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {name}
          </Text>
        </View>
      </View>
    </Link>
  )
}
