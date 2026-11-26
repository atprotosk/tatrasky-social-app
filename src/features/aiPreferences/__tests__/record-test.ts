import {type DatetimeString} from '@atproto/syntax'

import {community} from '#/lexicons'
import {applyAIPreferencePatch, getAIPreferenceValues} from '../record'

const BEFORE = '2026-01-01T00:00:00.000Z' as DatetimeString
const NOW = '2026-05-05T12:00:00.000Z' as DatetimeString

describe('getAIPreferenceValues', () => {
  it('reports every category as unset without a record', () => {
    expect(getAIPreferenceValues(null)).toEqual({
      training: 'unset',
      inference: 'unset',
      syntheticContent: 'unset',
      embedding: 'unset',
    })
  })

  it('distinguishes allow, deny and unset', () => {
    const record = applyAIPreferencePatch(
      null,
      {training: 'deny', inference: 'allow'},
      NOW,
    )
    expect(getAIPreferenceValues(record)).toEqual({
      training: 'deny',
      inference: 'allow',
      syntheticContent: 'unset',
      embedding: 'unset',
    })
  })
})

describe('applyAIPreferencePatch', () => {
  it('builds a record that satisfies the lexicon', () => {
    const record = applyAIPreferencePatch(null, {training: 'allow'}, NOW)
    expect(record).toEqual({
      $type: 'community.lexicon.preference.ai',
      scope: {$type: 'community.lexicon.preference.ai#globalScope'},
      updatedAt: NOW,
      preferences: {training: {allow: true, updatedAt: NOW}},
    })
    expect(() =>
      community.lexicon.preference.ai.main.parse(record),
    ).not.toThrow()
  })

  it('leaves other categories and their timestamps alone', () => {
    const previous = applyAIPreferencePatch(
      null,
      {training: 'allow', embedding: 'deny'},
      BEFORE,
    )
    const next = applyAIPreferencePatch(previous, {training: 'deny'}, NOW)
    expect(next.preferences.training).toEqual({allow: false, updatedAt: NOW})
    expect(next.preferences.embedding).toEqual({
      allow: false,
      updatedAt: BEFORE,
    })
    expect(previous.preferences.training?.allow).toBe(true)
  })

  it('omits an unset category instead of denying it', () => {
    const previous = applyAIPreferencePatch(null, {training: 'allow'}, BEFORE)
    const next = applyAIPreferencePatch(previous, {training: 'unset'}, NOW)
    expect(next.preferences).toEqual({})
  })

  it('keeps fields written by other clients', () => {
    const previous = {
      ...applyAIPreferencePatch(null, {}, BEFORE),
      somethingNew: 'value',
    }
    const next = applyAIPreferencePatch(previous, {training: 'deny'}, NOW)
    expect(next).toHaveProperty('somethingNew', 'value')
  })
})
