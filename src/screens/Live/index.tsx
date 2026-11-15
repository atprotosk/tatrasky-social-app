import {useState} from 'react'
import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {cleanError} from '#/lib/strings/errors'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {List} from '#/view/com/util/List'
import {NotFoundScreen} from '#/view/screens/NotFound'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListMaybePlaceholder} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {
  type LiveUser,
  useLiveUsersQuery,
} from '#/features/streamplace/useLiveUsersQuery'
import {LiveStreamCard} from './components/LiveStreamCard'

/**
 * Root of the Live tab: who is streaming on Streamplace right now.
 */
export function LiveScreen() {
  if (!BRAND.live.enabled) {
    return <NotFoundScreen />
  }
  return (
    <Layout.Screen testID="liveScreen">
      <Layout.Center>
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Live</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
      </Layout.Center>
      <LiveList />
    </Layout.Screen>
  )
}

function LiveList() {
  const {t: l} = useLingui()
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const {data, isLoading, isError, error, refetch} = useLiveUsersQuery()
  const [isPTR, setIsPTR] = useState(false)

  const onRefresh = async () => {
    setIsPTR(true)
    try {
      await refetch()
    } finally {
      setIsPTR(false)
    }
  }

  // Hide streamers the viewer has muted or blocked, or that labelers filter.
  const streams = (data ?? []).filter(({profile}) => {
    if (!profile || !moderationOpts) return true
    return !moderateProfile(profile, moderationOpts).ui('contentList').filter
  })

  if (isLoading || isError || streams.length === 0) {
    return (
      <ListMaybePlaceholder
        isLoading={isLoading}
        isError={isError}
        errorMessage={error ? cleanError(error) : undefined}
        onRetry={refetch}
        emptyType="page"
        emptyTitle={l`Nobody is live right now`}
        emptyMessage={l`Check back later to see who is streaming on Streamplace.`}
        hideBackButton
      />
    )
  }

  return (
    <List
      data={streams}
      keyExtractor={(item: LiveUser) => item.stream.uri}
      renderItem={({item}: {item: LiveUser}) => (
        <View style={[a.px_lg, a.py_md]}>
          <LiveStreamCard liveUser={item} moderationOpts={moderationOpts} />
        </View>
      )}
      ListHeaderComponent={
        <View style={[a.px_lg, a.pt_md]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Streams from Streamplace</Trans>
          </Text>
        </View>
      }
      refreshing={isPTR}
      onRefresh={() => void onRefresh()}
      desktopFixedHeight
      sideBorders={false}
    />
  )
}
