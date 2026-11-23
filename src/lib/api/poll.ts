import {countGraphemes} from 'unicode-segmenter/grapheme'

/** TOKIMEKI's composer lets a poll have two to four choices. */
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 4
/** TOKIMEKI's option limits, as its lexicon states them. */
export const POLL_OPTION_MAX_GRAPHEMES = 100
export const POLL_OPTION_MAX_BYTES = 1000

export const POLL_DURATIONS = ['1h', '6h', '12h', '1d', '3d', '7d'] as const
export type PollDuration = (typeof POLL_DURATIONS)[number]
export const DEFAULT_POLL_DURATION: PollDuration = '1d'

const POLL_DURATION_MS: Record<PollDuration, number> = {
  '1h': 60 * 60e3,
  '6h': 6 * 60 * 60e3,
  '12h': 12 * 60 * 60e3,
  '1d': 24 * 60 * 60e3,
  '3d': 3 * 24 * 60 * 60e3,
  '7d': 7 * 24 * 60 * 60e3,
}

/** A custom closing time has to be at least this far ahead when posting. */
export const POLL_MIN_CUSTOM_LEAD_MS = 5 * 60e3

/**
 * The choices and closing time of a poll being composed. The post text is the
 * question; it is not stored on the poll record.
 */
export type PollDraft = {
  options: string[]
  duration: PollDuration
  /**
   * A custom closing time, local `YYYY-MM-DDTHH:mm`; when set it is used
   * instead of `duration`.
   */
  endsAt?: string
  /** Record key assigned while publishing; never stored on a draft. */
  rkey?: string
}

export type PollOptionIssue = 'empty' | 'too_long' | 'invalid'

/** A local `YYYY-MM-DDTHH:mm` value, as a Date. */
function fromLocalDateTime(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return undefined
  const [, y, mo, d, h, mi] = m.map(Number)
  const date = new Date(y, mo - 1, d, h, mi, 0, 0)
  return isNaN(date.getTime()) ? undefined : date
}

/** The poll's closing time, as `tech.tokimeki.poll.poll` stores it. */
export function pollEndsAt(
  draft: Pick<PollDraft, 'duration' | 'endsAt'>,
  now: Date,
): string {
  const custom = draft.endsAt ? fromLocalDateTime(draft.endsAt) : undefined
  if (custom) return custom.toISOString()
  return new Date(
    now.getTime() + POLL_DURATION_MS[draft.duration],
  ).toISOString()
}

/** What's wrong with a custom closing time, or null when it's fine. */
export function getPollEndIssue(
  draft: Pick<PollDraft, 'endsAt'>,
  now: Date,
): 'invalid' | 'too_soon' | null {
  if (!draft.endsAt) return null
  const end = fromLocalDateTime(draft.endsAt)
  if (!end) return 'invalid'
  if (end.getTime() - now.getTime() < POLL_MIN_CUSTOM_LEAD_MS) {
    return 'too_soon'
  }
  return null
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * UTF-8 size of a string, and whether it can be stored at all: lone
 * surrogates and NUL characters can't be written to a record.
 */
export function inspectText(text: string): {
  bytes: number
  wellFormed: boolean
  hasNul: boolean
} {
  let bytes = 0
  let wellFormed = true
  let hasNul = false
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i)
    if (unit === 0) hasNul = true
    if (unit < 0x80) {
      bytes += 1
    } else if (unit < 0x800) {
      bytes += 2
    } else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else {
        wellFormed = false
        bytes += 3
      }
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      wellFormed = false
      bytes += 3
    } else {
      bytes += 3
    }
  }
  return {bytes, wellFormed, hasNul}
}

export function normalizePollOption(text: string): string {
  return text.trim().normalize('NFC')
}

export function getOptionIssue(text: string): PollOptionIssue | null {
  const option = normalizePollOption(text)
  if (option.length === 0) return 'empty'
  const {bytes, wellFormed, hasNul} = inspectText(option)
  if (!wellFormed || hasNul) return 'invalid'
  if (
    countGraphemes(option) > POLL_OPTION_MAX_GRAPHEMES ||
    bytes > POLL_OPTION_MAX_BYTES
  ) {
    return 'too_long'
  }
  return null
}

export function getOptionIssues(options: string[]): (PollOptionIssue | null)[] {
  return options.map(getOptionIssue)
}

/**
 * The choices that count: the first {@link POLL_MIN_OPTIONS} always, later
 * ones only once filled in. The editor keeps a blank slot after the last
 * filled choice (see {@link withSpareOption}), which must neither block
 * posting nor be published.
 */
export function pollOptionsInUse(options: string[]): string[] {
  return options.filter(
    (option, i) => i < POLL_MIN_OPTIONS || option.trim().length > 0,
  )
}

/**
 * The editor's choices with exactly one blank slot to type the next choice
 * into, once every choice is filled and there is room for another. Extra
 * trailing blanks collapse back, so clearing the last choice keeps its field.
 */
export function withSpareOption(options: string[]): string[] {
  const next = [...options]
  const isBlank = (option: string) => option.trim().length === 0
  while (
    next.length > POLL_MIN_OPTIONS &&
    isBlank(next[next.length - 1]) &&
    isBlank(next[next.length - 2])
  ) {
    next.pop()
  }
  if (next.length < POLL_MAX_OPTIONS && !next.some(isBlank)) next.push('')
  return next
}

/** Whether any poll choice has been written; an untouched poll has none. */
export function pollHasContent(poll: Pick<PollDraft, 'options'>): boolean {
  return poll.options.some(option => option.trim().length > 0)
}

export function isPollDraftPublishable(
  draft: PollDraft,
  now = new Date(),
): boolean {
  const options = pollOptionsInUse(draft.options)
  return (
    options.length >= POLL_MIN_OPTIONS &&
    options.length <= POLL_MAX_OPTIONS &&
    getOptionIssues(options).every(issue => issue === null) &&
    getPollEndIssue(draft, now) === null
  )
}

export function pollOptionsForPublish(draft: PollDraft): string[] {
  return pollOptionsInUse(draft.options).map(normalizePollOption)
}

export function isPollDuration(value: unknown): value is PollDuration {
  return (
    typeof value === 'string' &&
    (POLL_DURATIONS as readonly string[]).includes(value)
  )
}

/**
 * Reads a poll saved on a draft. Drafts written by Witchsky before its switch
 * to TOKIMEKI carried `statements`; the first few are kept so an in-progress
 * poll is not silently lost.
 */
export function decodePollDraft(value: unknown): PollDraft | undefined {
  if (!isObject(value)) return undefined
  const {options, duration, statements} = value
  const list = Array.isArray(options)
    ? options
    : Array.isArray(statements)
      ? statements.slice(0, POLL_MAX_OPTIONS)
      : undefined
  if (
    !list ||
    list.length < 1 ||
    list.length > POLL_MAX_OPTIONS ||
    !list.every(option => typeof option === 'string')
  ) {
    return undefined
  }
  return {
    options: list,
    duration: isPollDuration(duration) ? duration : DEFAULT_POLL_DURATION,
    ...(typeof value.endsAt === 'string' && fromLocalDateTime(value.endsAt)
      ? {endsAt: value.endsAt}
      : {}),
  }
}
