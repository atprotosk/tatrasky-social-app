# Streamplace (Live tab)

Watch [Streamplace](https://stream.place) livestreams and join their chat
without leaving the app. Entry points:

- The **Live** tab (`/live`, `src/screens/Live`) lists who is live now.
- The watch screen (`/live/:actor`, `src/screens/LiveWatch`) has the player and
  the live chat.
- stream.place link cards in posts, the Live Now status dialog and the web
  profile hover card open the watch screen in-app.

Configured by the `live` block in `src/config/brand.json` (`enabled`,
`serviceUrl`). It can be overridden at build time with `EXPO_PUBLIC_LIVE_ENABLED`
and `EXPO_PUBLIC_LIVE_SERVICE_URL`.

## How it talks to Streamplace

All reads are unauthenticated against the configured node:

| What | Endpoint |
| --- | --- |
| Who is live | `GET /xrpc/place.stream.live.getLiveUsers` |
| Thumbnail | `GET /api/playback/{did}/stream.jpg` |
| Live HLS | `GET /xrpc/place.stream.playback.getLivePlaylist?streamer={did}` |
| Chat, viewer count, live state | `wss://…/api/websocket/{did}` |

Sending a chat message writes a `place.stream.chat.message` record
(`{text, createdAt, streamer}`) to the viewer's own PDS; the node picks it up
from the network and echoes it back over the websocket. Until then it shows as
pending (`pending.ts`).

## Moderation

Streamplace only applies the streamer's own blocks and chat gates. Chat authors
are therefore looked up on the AppView and filtered with the viewer's own
moderation settings (`visible.ts`), and the Live list hides streamers the viewer
has muted or blocked. Long-press a chat message to report its author.

Playback contacts a third-party server, so the watch screen asks for consent
through the standard external media dialog (`streamplace` source).

## Credits

The websocket reducer, chat hooks, players and watch screen are adapted from
[Blacksky](https://github.com/blacksky-algorithms/blacksky.community)
(`src/features/streamplace`, `src/screens/StreamplaceWatch`):

> Copyright 2025 Blacksky Algorithms Inc.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
