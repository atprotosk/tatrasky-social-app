import {type Client} from '@atproto/lex'
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {act, renderHook} from '@testing-library/react-native'

import {useBirthdateMutation} from '#/state/birthdate'
import {setBirthdateForDid} from '#/ageAssurance/data'
import {setMuAgeStatus} from '#/ageAssurance/muAgeService'
import {account} from '#/storage'

const mockPdsClient = {call: jest.fn()}
const mockPatch = jest.fn()
jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: {did: 'did:plc:alice'}}),
  usePdsClient: () => mockPdsClient,
}))
jest.mock('#/state/queries/preferences', () => ({
  preferencesQueryKey: ['preferences'],
}))
jest.mock('#/state/queries/messages/restrictChatSettings', () => ({
  restrictChatSettings: jest.fn(),
}))
jest.mock('#/ageAssurance', () => ({
  usePatchAgeAssuranceOtherRequiredData: () => mockPatch,
}))
jest.mock('#/ageAssurance/data', () => ({setBirthdateForDid: jest.fn()}))
jest.mock('#/ageAssurance/muAgeService', () => ({
  flagsFromBirthDate: () => ({over13: true, over16: true, over18: true}),
  birthdateFromFlags: () => 'synthetic',
  setMuAgeStatus: jest.fn(),
}))
jest.mock('#/env', () => ({IS_DEV: false}))
jest.mock('#/storage', () => ({account: {get: jest.fn(), set: jest.fn()}}))

const birthDate = new Date('1990-05-17T00:00:00.000Z')

function renderMutation() {
  const queryClient = new QueryClient({
    defaultOptions: {mutations: {gcTime: Infinity}},
  })
  const {result} = renderHook(() => useBirthdateMutation(), {
    wrapper: ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
  return result
}

beforeAll(() => {
  /* notify inside act() rather than on a later timer */
  notifyManager.setScheduler(callback => callback())
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useBirthdateMutation', () => {
  it('writes the PDS through the confirmed client', async () => {
    const confirmedClient = {call: jest.fn()}
    const result = renderMutation()
    await act(() =>
      result.current.mutateAsync({
        birthDate,
        confirmedClient: confirmedClient as unknown as Client,
      }),
    )
    expect(confirmedClient.call).toHaveBeenCalledTimes(1)
    expect(mockPdsClient.call).not.toHaveBeenCalled()
    expect(setMuAgeStatus).toHaveBeenCalledWith(mockPdsClient, {
      over13: true,
      over16: true,
      over18: true,
    })
  })

  it('caches only the synthetic date', async () => {
    const result = renderMutation()
    await act(() => result.current.mutateAsync({birthDate}))
    expect(mockPatch).toHaveBeenCalledWith({birthdate: 'synthetic'})
    expect(setBirthdateForDid).toHaveBeenCalledWith({
      did: 'did:plc:alice',
      birthdate: 'synthetic',
    })
  })

  it('can be retried after the age service write fails', async () => {
    jest.mocked(setMuAgeStatus).mockRejectedValueOnce(new Error('offline'))
    const result = renderMutation()

    await act(async () => {
      await expect(result.current.mutateAsync({birthDate})).rejects.toThrow(
        'offline',
      )
    })
    expect(mockPatch).not.toHaveBeenCalled()
    expect(account.set).not.toHaveBeenCalled()

    await act(() => result.current.mutateAsync({birthDate}))
    expect(mockPdsClient.call).toHaveBeenCalledTimes(2)
    expect(account.set).toHaveBeenCalledTimes(1)
  })
})
