import {act, renderHook} from '@testing-library/react-native'

import {createConfirmedSession} from '../createConfirmedSession'
import {useConfirmedSession} from '../useConfirmedSession'

let mockAccount = {did: 'did:plc:alice', pdsUrl: 'https://pds.example.com'}
jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: mockAccount}),
}))
jest.mock('../createConfirmedSession', () => ({
  createConfirmedSession: jest.fn(),
}))

const create = jest.mocked(createConfirmedSession)

function fakeSession() {
  return {did: 'did:plc:alice', client: {} as never, end: jest.fn()}
}

function deferredSession() {
  const session = fakeSession()
  let resolve!: () => void
  create.mockReturnValueOnce(
    new Promise(done => {
      resolve = () => done(session)
    }),
  )
  return {session, resolve}
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAccount = {did: 'did:plc:alice', pdsUrl: 'https://pds.example.com'}
})

describe('useConfirmedSession', () => {
  it('ends the session on unmount', async () => {
    const session = fakeSession()
    create.mockResolvedValue(session)
    const {result, unmount} = renderHook(() => useConfirmedSession())
    await act(() => result.current.confirm({password: 'x'}))
    expect(result.current.client).toBe(session.client)

    unmount()
    expect(session.end).toHaveBeenCalledTimes(1)
  })

  it('ends a sign-in that finishes after unmount', async () => {
    const {session, resolve} = deferredSession()
    const {result, unmount} = renderHook(() => useConfirmedSession())
    const pending = result.current.confirm({password: 'x'})
    unmount()
    resolve()
    await pending
    expect(session.end).toHaveBeenCalledTimes(1)
  })

  it('ends the session when the account changes', async () => {
    const session = fakeSession()
    create.mockResolvedValue(session)
    const {result, rerender} = renderHook(() => useConfirmedSession())
    await act(() => result.current.confirm({password: 'x'}))

    mockAccount = {did: 'did:plc:bob', pdsUrl: 'https://pds.example.com'}
    rerender({})
    expect(session.end).toHaveBeenCalledTimes(1)
    expect(result.current.client).toBeUndefined()
  })
})
