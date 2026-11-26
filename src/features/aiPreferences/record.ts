import {type DatetimeString} from '@atproto/syntax'

import {type community} from '#/lexicons'

export const AI_PREFERENCE_CATEGORIES = [
  'training',
  'inference',
  'syntheticContent',
  'embedding',
] as const

export type AIPreferenceCategory = (typeof AI_PREFERENCE_CATEGORIES)[number]

/**
 * `unset` means the category is omitted from the record, which the lexicon
 * defines as "no declared preference". It is not the same as `deny`.
 */
export type AIPreferenceValue = 'allow' | 'deny' | 'unset'

export type AIPreferenceValues = Record<AIPreferenceCategory, AIPreferenceValue>

export type AIPreferencePatch = Partial<AIPreferenceValues>

export type AIPreferenceRecord = community.lexicon.preference.ai.Main

export function getAIPreferenceValues(
  record: AIPreferenceRecord | null,
): AIPreferenceValues {
  const values: AIPreferenceValues = {
    training: 'unset',
    inference: 'unset',
    syntheticContent: 'unset',
    embedding: 'unset',
  }
  for (const category of AI_PREFERENCE_CATEGORIES) {
    const preference = record?.preferences[category]
    if (preference) {
      values[category] = preference.allow ? 'allow' : 'deny'
    }
  }
  return values
}

/**
 * Builds the account-wide record to write. Categories absent from the patch are
 * carried over untouched, including their own `updatedAt`, as is anything else
 * another client may have stored on the record.
 */
export function applyAIPreferencePatch(
  previous: AIPreferenceRecord | null,
  patch: AIPreferencePatch,
  now: DatetimeString,
): AIPreferenceRecord {
  const preferences = {...previous?.preferences}
  for (const category of AI_PREFERENCE_CATEGORIES) {
    const value = patch[category]
    if (value === undefined) continue
    if (value === 'unset') {
      delete preferences[category]
    } else {
      preferences[category] = {allow: value === 'allow', updatedAt: now}
    }
  }
  return {
    ...previous,
    $type: 'community.lexicon.preference.ai',
    scope: {$type: 'community.lexicon.preference.ai#globalScope'},
    updatedAt: now,
    preferences,
  }
}
