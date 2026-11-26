import {setPersonalDetails} from '@bsky/sdk'

import {setBirthdateForDid} from '#/ageAssurance/data'
import {setMuAgeStatus} from '#/ageAssurance/muAgeService'
import {createSessionBundleAndCreateAccount} from '../create-account'

const mockPdsClient = {call: jest.fn(() => Promise.resolve())}
jest.mock('@atproto/lex-password-session', () => ({
  PasswordSession: {
    createAccount: jest.fn(() => Promise.resolve({session: {}})),
  },
}))
jest.mock('../session-core', () => ({
  buildBundle: () => ({pdsClient: mockPdsClient}),
  finishPreparation: (_b: unknown, _aa: unknown, snapshot: () => unknown) =>
    Promise.resolve(snapshot()),
  makeSessionHooks: () => ({arm: jest.fn()}),
  registerBundleKillSwitch: jest.fn(),
}))
jest.mock('../session-data', () => ({
  sessionDataToSessionAccount: () => ({did: 'did:plc:alice'}),
}))
jest.mock('../moderation', () => ({configureModerationForAccount: jest.fn()}))
jest.mock('#/logger', () => ({logger: {info: jest.fn(), error: jest.fn()}}))
jest.mock('#/state/birthdate', () => ({
  snoozeBirthdateUpdateAllowedForDid: jest.fn(),
}))
jest.mock('#/state/queries/messages/restrictChatSettings', () => ({
  restrictChatSettings: jest.fn(),
}))
jest.mock('#/state/shell/reminders', () => ({
  snoozeEmailConfirmationPrompt: jest.fn(),
}))
jest.mock('#/ageAssurance/data', () => ({
  prefetchAgeAssuranceServerData: jest.fn(() => Promise.resolve()),
  setBirthdateForDid: jest.fn(),
  setCreatedAtForDid: jest.fn(),
}))
jest.mock('#/ageAssurance/state', () => ({
  unsafeGetAndComputeAgeAssurance: () => ({}),
}))
jest.mock('#/ageAssurance/muAgeService', () => ({
  flagsFromBirthDate: () => ({over13: true, over16: true, over18: true}),
  birthdateFromFlags: () => 'synthetic',
  setMuAgeStatus: jest.fn(() => Promise.resolve()),
}))

describe('signup', () => {
  it('declares the age flags and caches no real birthdate', async () => {
    const birthDate = new Date('1990-05-17T00:00:00.000Z')
    await createSessionBundleAndCreateAccount(
      {
        service: 'https://pds.example.com',
        email: 'alice@example.com',
        password: 'password',
        handle: 'alice.example.com',
        birthDate,
      },
      jest.fn(),
    )

    expect(setMuAgeStatus).toHaveBeenCalledWith(mockPdsClient, {
      over13: true,
      over16: true,
      over18: true,
    })
    expect(setBirthdateForDid).toHaveBeenCalledWith({
      did: 'did:plc:alice',
      birthdate: 'synthetic',
    })
    expect(mockPdsClient.call).toHaveBeenCalledWith(setPersonalDetails, {
      birthDate,
    })
  })
})
