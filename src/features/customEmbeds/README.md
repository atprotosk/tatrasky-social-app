# Custom embeds

Fork-owned, client-side enhancement of external link embeds (`app.bsky.embed.external`).

Upstream renders external links as a plain card (`ExternalEmbed`) or, for
`standard.site` links, as a `StandardSiteEmbed`. That richer card relies on the
**appview** enriching the embed with `associatedRefs`/`source`. Our custom
embeds instead work **purely client-side**: we match on the link URL and fetch
everything ourselves, so they render even when the post was authored from the
vanilla Bluesky app (which never sets `associatedRefs`).

## How it plugs in

There is a single, additive touchpoint in upstream code: the top of the `link`
case in `src/components/Post/Embed/index.tsx` calls `matchCustomEmbed(view)`.
If a handler matches, its component renders; otherwise upstream's default
external embed rendering runs unchanged. Keeping the integration to one
clearly-marked block minimizes merge conflicts when syncing with upstream.

## Adding a new custom embed

1. Create a directory under `customEmbeds/` (e.g. `myEmbed/`).
2. Implement a `CustomEmbedHandler` (see `types.ts`): a `match(view)` predicate
   (usually a URL host check) and a `Component` rendering the card.
3. Register it in `registry.ts`. First match in the list wins.

## events

Renders calendar events (`community.lexicon.calendar.event`) as one card,
whichever app created them, with in-app RSVP and an event page at
`/profile/:actor/event/:rkey`. The feature lives in `src/features/events/`;
only its handler is registered here. Ported from
[Witchsky](https://tangled.org/jollywhoppers.com/witchsky.app); it replaced
the earlier atmo.rsvp-only card.

- **Detect**: a link card whose `associatedRefs` names an event record, or an
  event link from Tatrasky or Witchsky (`/profile/:actor/event/:rkey`),
  Blacksky, atmo.rsvp (`/p/:actor/e/:rkey`) or Smoke Signal (`url.ts`). An
  event that can't be loaded falls back to the ordinary link card.
- **Read**: Blacksky's AppView (`community.blacksky.calendar.getEvents`,
  `getEventRsvps`, `getMyEvents`). Signed in, reads are proxied through the
  account's PDS so the response carries the viewer's RSVP; logged out, they
  go to `api.blacksky.community` directly (`queries.ts`).
- **Write**: RSVPs (`community.lexicon.calendar.rsvp`), edits, cancelling and
  deleting are records written to the user's own repo. The AppView lags the
  write, so results are written into the query cache rather than refetched.
- **Create**: the composer's event editor (`view/com/composer/event/`). On
  publish, `lib/api/index.ts` writes the event record first, posts a link card
  to the event page pointing back at it through `associatedRefs`, then adds
  the post to the event and RSVPs the author as going
  (`lib/api/event-publish.ts`).
- **Live**: when an event links a Streamplace channel that is live around the
  event's time, a "LIVE" button opens it in the in-app player.

## tangledString

Renders [Tangled](https://tangled.org) "strings" (`sh.tangled.string`) - shared
code snippets/pastes - as a syntax-highlighted code card.

- **Detect**: `https://tangled.org/strings/{actor}/{rkey}` (also `tangled.sh`),
  where `{actor}` is a handle or DID (`detect.ts`).
- **Read**: the snippet text lives inline in the record, so a single
  `com.atproto.repo.getRecord` is all the card needs (`queries.ts`). The owner
  profile is fetched alongside it for the byline, best-effort.
- **Highlight**: `highlight.ts` runs the code through `lowlight` (highlight.js
  grammars, pure JS so it works on web and native) and flattens the result into
  lines of scoped spans; `CodeBlock.tsx` renders those into ALF-themed `Text`.
  The language is inferred from the filename extension, falling back to
  highlight.js auto-detection. Feed cards show a `PREVIEW_LINES` preview and
  link out for the rest.

> `lowlight` and its `devlop` dependency are ESM-only, so both are added to
> `transformIgnorePatterns` in `package.json` for Jest.

## tokimekiPoll

Renders [TOKIMEKI](https://poll.tokimeki.tech) polls (`tech.tokimeki.poll.poll`)
inline with the post, with in-app voting. The feature lives in
`src/features/tokimeki/`; only its handler is registered here. Ported from
[Witchsky](https://tangled.org/jollywhoppers.com/witchsky.app).

- **Detect**: a link card whose `associatedRefs` names a poll record, or a
  `https://poll.tokimeki.tech/p/{did}/{rkey}` URL (`parse.ts`). A poll that
  can't be read falls back to the ordinary link card.
- **Read**: TOKIMEKI's own AppView (`tech.tokimeki.poll.getPoll`) for the
  counts. If it can't answer, the poll record is read from its author's PDS
  and the votes are counted from Constellation backlinks, each vote verified
  against the voter's repo (`api.ts`). The viewer's own vote always comes from
  their repo.
- **Write**: votes are `tech.tokimeki.poll.vote` records in the voter's repo;
  removing a vote deletes them (`mutations.ts`). Indexers lag the write, so a
  recent vote is laid over refetched data for a while (`recent-votes.ts`).
- **Create**: the composer's poll editor (`view/com/composer/poll/`). On
  publish, `lib/api/index.ts` writes the poll record first, then posts a link
  card to the poll's TOKIMEKI page that points back at the record through
  `associatedRefs` (`lib/api/poll-publish.ts`). Other apps see a link card.
