import {type CustomEmbedHandler} from '#/features/customEmbeds/types'
import {type app} from '#/lexicons'
import {EventEmbed} from './components/EventEmbed'
import {eventFromRefs, parseEventUrl} from './url'

/**
 * The event a link card shows: named in its `associatedRefs`, or recognised
 * by a calendar site's event address (Tatrasky, Witchsky, Blacksky,
 * atmo.rsvp, Smoke Signal).
 */
function eventRefFromView(view: app.bsky.embed.external.ViewExternal) {
  return eventFromRefs(view.associatedRefs) ?? parseEventUrl(view.uri)
}

export const eventsHandler: CustomEmbedHandler = {
  id: 'events',
  match: view => Boolean(eventRefFromView(view)),
  Component: function EventLinkEmbed({view, onOpen, style}) {
    const eventRef = eventRefFromView(view)
    if (!eventRef) return null
    return (
      <EventEmbed
        eventRef={eventRef}
        link={view}
        onOpen={onOpen}
        style={style}
      />
    )
  },
}
