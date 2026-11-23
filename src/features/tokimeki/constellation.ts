import {CONSTELLATION_SERVICE} from '#/lib/constants'

/** A record that links to a target, as Constellation's backlink index lists it. */
export type ConstellationLink = {
  did: string
  collection: string
  rkey: string
}

/*
 * A poll with more voters than this is not fully counted from Constellation;
 * it is only the fallback for when TOKIMEKI's own AppView can't answer.
 */
const MAX_PAGES = 20

/**
 * Every record in `collection` whose `path` points at `target`, following
 * Constellation's pagination. `fromDids` narrows the search to those repos.
 */
export async function constellationLinks({
  target,
  collection,
  path,
  fromDids,
}: {
  target: string
  collection: string
  path: string
  fromDids?: string[]
}): Promise<ConstellationLink[]> {
  const url = new URL('/links', CONSTELLATION_SERVICE)
  url.searchParams.set('target', target)
  url.searchParams.set('collection', collection)
  url.searchParams.set('path', path)
  if (fromDids?.length) url.searchParams.set('from_dids', fromDids.join(','))

  const links: ConstellationLink[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(url, {headers: {accept: 'application/json'}})
    if (!response.ok) {
      throw new Error(`Constellation links failed: ${response.status}`)
    }
    const body = (await response.json()) as {
      linking_records?: ConstellationLink[]
      cursor?: string | null
    }
    links.push(...(body.linking_records ?? []))
    if (!body.cursor || !body.linking_records?.length) break
    url.searchParams.set('cursor', body.cursor)
  }
  return links
}
