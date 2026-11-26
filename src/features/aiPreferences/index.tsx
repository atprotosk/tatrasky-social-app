/*
 * Adapted from the AI preferences screen in Blacksky (blacksky.community).
 * See LICENSE.blacksky in this directory.
 */
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {useAIPreferencesMutation, useAIPreferencesQuery} from './api'
import {
  AI_PREFERENCE_CATEGORIES,
  type AIPreferenceCategory,
  type AIPreferenceValue,
} from './record'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'AIPreferencesSettings'
>

export function AIPreferencesSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const appName = BRAND.name

  const {values, isError, refetch} = useAIPreferencesQuery()
  const {mutate} = useAIPreferencesMutation({
    onError: () =>
      Toast.show(l`Couldn’t save your AI preference. Please try again.`, {
        type: 'error',
      }),
  })

  const categoryCopy: Record<
    AIPreferenceCategory,
    {name: string; description: string}
  > = {
    training: {
      name: l({message: 'Training', context: 'AI preference'}),
      description: l`Use your data to build or train new AI models. Once your work is in a model, it stays there, even if you later delete your account.`,
    },
    inference: {
      name: l({message: 'Inference', context: 'AI preference'}),
      description: l`Look up your data while AI is answering someone’s question. The AI doesn’t keep it, but it might quote or reference it in real time.`,
    },
    syntheticContent: {
      name: l({message: 'Synthetic content', context: 'AI preference'}),
      description: l`Generate new content or interactions modeled on your data. This includes AI imitations of your writing, AI-generated versions of your photos or audio, or bots designed to sound like you.`,
    },
    embedding: {
      name: l({message: 'Embedding', context: 'AI preference'}),
      description: l`Use your data in AI search and recommendation systems. This is how AI finds similar accounts, groups people by interests, and decides what to show in personalized feeds like “Discover” or “For You”.`,
    },
  }

  const introStyle = [a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]

  return (
    <Layout.Screen testID="aiPreferencesScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>AI preferences</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.px_lg, a.pt_md, a.pb_lg, a.gap_sm]}>
          <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_xs]}>
            <Text style={[a.text_lg, a.font_bold]}>
              <Trans>Decide how AI may use your data</Trans>
            </Text>
            <View
              style={[
                a.px_sm,
                a.py_2xs,
                a.rounded_full,
                t.atoms.bg_contrast_50,
              ]}>
              <Text
                style={[
                  a.text_xs,
                  a.font_semi_bold,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>Experimental</Trans>
              </Text>
            </View>
          </View>
          <Text style={introStyle}>
            <Trans>
              Use these settings to say how AI systems across the AT Protocol
              network may use your data. This is an open network, so your public
              data stays public, but you can say how AI should handle it.
            </Trans>
          </Text>
          <Text style={introStyle}>
            <Trans>
              {appName} will respect the preferences you set here. They are
              saved as a public record in your account, so other AT Protocol
              services can read them and choose to respect them too. Bad actors
              may ignore these signals or work around them, which is outside the
              control of {appName}, your hosting provider, and other services on
              the network.
            </Trans>
          </Text>
          <Text style={introStyle}>
            <Trans>These preferences apply to your entire account.</Trans>
          </Text>
          <Text style={introStyle}>
            <Trans>
              Safety tools like spam and bot detection aren’t affected. They
              stay on for everyone.
            </Trans>
          </Text>
        </View>

        {values ? (
          AI_PREFERENCE_CATEGORIES.map(category => (
            <CategoryRow
              key={category}
              testID={`aiPreference-${category}`}
              name={categoryCopy[category].name}
              description={categoryCopy[category].description}
              value={values[category]}
              onChange={value => mutate({[category]: value})}
            />
          ))
        ) : isError ? (
          <View style={[a.px_lg, a.pb_lg]}>
            <Admonition.Outer type="error">
              <Admonition.Row>
                <Admonition.Icon />
                <Admonition.Content>
                  <Admonition.Text>
                    <Trans>Couldn’t load your AI preferences.</Trans>
                  </Admonition.Text>
                </Admonition.Content>
                <Admonition.Button
                  label={l`Retry`}
                  color="secondary"
                  onPress={() => void refetch()}>
                  <ButtonText>
                    <Trans>Retry</Trans>
                  </ButtonText>
                </Admonition.Button>
              </Admonition.Row>
            </Admonition.Outer>
          </View>
        ) : (
          <View style={[a.p_lg, a.align_center]}>
            <Loader size="xl" />
          </View>
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}

function CategoryRow({
  testID,
  name,
  description,
  value,
  onChange,
}: {
  testID: string
  name: string
  description: string
  value: AIPreferenceValue
  onChange: (value: AIPreferenceValue) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()

  const options: {value: AIPreferenceValue; label: string}[] = [
    {value: 'allow', label: l({message: 'Allow', context: 'AI preference'})},
    {
      value: 'unset',
      label: l({message: 'No preference', context: 'AI preference'}),
    },
    {value: 'deny', label: l({message: 'Deny', context: 'AI preference'})},
  ]

  return (
    <View
      testID={testID}
      style={[
        a.px_lg,
        a.py_lg,
        a.gap_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_md, a.font_semi_bold]}>{name}</Text>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {description}
        </Text>
      </View>
      <SegmentedControl.Root
        type="radio"
        label={l({
          message: `AI preference for: ${name}`,
          comment:
            'Accessibility label for a group of options. The name is a kind of AI usage, such as "Training".',
        })}
        value={value}
        onChange={next => {
          /*
           * The control also reports the current value when it first lays out,
           * which must not publish a record the user never asked for.
           */
          if (next !== value) onChange(next)
        }}>
        {options.map(option => (
          <SegmentedControl.Item
            key={option.value}
            value={option.value}
            label={option.label}
            // react-native-web ignores the control's accessibilityState
            aria-checked={value === option.value}>
            <SegmentedControl.ItemText>
              {option.label}
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </View>
  )
}
