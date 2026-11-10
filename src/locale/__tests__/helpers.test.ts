import {expect, test} from '@jest/globals'

import {sanitizeAppLanguageSetting} from '#/locale/helpers'
import {AppLanguage} from '#/locale/languages'

test('sanitizeAppLanguageSetting', () => {
  expect(sanitizeAppLanguageSetting('en')).toBe(AppLanguage.en)
  expect(sanitizeAppLanguageSetting('sk')).toBe(AppLanguage.sk)
  // Disabled app languages fall back to English
  expect(sanitizeAppLanguageSetting('el')).toBe(AppLanguage.en)
  expect(sanitizeAppLanguageSetting('pt-BR')).toBe(AppLanguage.en)
  expect(sanitizeAppLanguageSetting('de,sk')).toBe(AppLanguage.sk)
  expect(sanitizeAppLanguageSetting('foo')).toBe(AppLanguage.en)
  expect(sanitizeAppLanguageSetting('en,foo')).toBe(AppLanguage.en)
  expect(sanitizeAppLanguageSetting('foo,en')).toBe(AppLanguage.en)
  expect(sanitizeAppLanguageSetting('vi')).toBe(AppLanguage.en)
})
