import {type Client} from '@atproto/lex'

import {flagsFromBirthDate, getMuAgeStatusSeeded} from './muAgeService'

jest.mock('#/ageAssurance/logger', () => ({
  logger: {warn: jest.fn(), error: jest.fn()},
}))

const fetchMock = jest.fn()
const call = jest.fn()
const client = {call} as unknown as Client

let stored: object
let preferences: object[]

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as typeof fetch
  stored = {declared: false}
  preferences = []
  fetchMock.mockImplementation((_url: string, init: RequestInit) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(init.method === 'POST' ? {} : stored),
    }),
  )
  call.mockImplementation((method: {$lxm?: string; nsid?: string}) =>
    Promise.resolve(
      String(method.$lxm ?? method.nsid).endsWith('getPreferences')
        ? {preferences}
        : {token: 'service-token'},
    ),
  )
})

function posts() {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit).method === 'POST')
    .map(([, init]) => JSON.parse((init as {body: string}).body) as object)
}

const declaredPref = {
  $type: 'app.bsky.actor.defs#declaredAgePref',
  isOverAge13: true,
  isOverAge16: true,
  isOverAge18: false,
}

describe('getMuAgeStatusSeeded', () => {
  it('leaves an existing declaration alone', async () => {
    stored = {declared: true, over13: true, over16: true, over18: true}
    preferences = [declaredPref]
    expect(await getMuAgeStatusSeeded(client)).toEqual(stored)
    expect(posts()).toEqual([])
  })

  it('copies the PDS declaration over when there is none', async () => {
    preferences = [declaredPref]
    const flags = {over13: true, over16: true, over18: false}
    expect(await getMuAgeStatusSeeded(client)).toEqual({
      declared: true,
      ...flags,
    })
    expect(posts()).toEqual([flags])
  })

  it('stays undeclared when the PDS has no birthdate either', async () => {
    expect(await getMuAgeStatusSeeded(client)).toEqual({declared: false})
    expect(posts()).toEqual([])
  })
})

describe('flagsFromBirthDate', () => {
  const yearsAgo = (years: number) => {
    const date = new Date()
    date.setFullYear(date.getFullYear() - years)
    date.setDate(date.getDate() - 1)
    return date
  }

  it.each([
    [12, false, false, false],
    [13, true, false, false],
    [16, true, true, false],
    [18, true, true, true],
  ])('age %i', (age, over13, over16, over18) => {
    expect(flagsFromBirthDate(yearsAgo(age))).toEqual({over13, over16, over18})
  })
})
