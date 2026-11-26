export type AgeFlags = {over13: boolean; over16: boolean; over18: boolean}

export type AgeStore = {
  get(did: string): Promise<AgeFlags | undefined>
  set(did: string, flags: AgeFlags): Promise<void>
}

export function createD1Store(db: D1Database): AgeStore {
  return {
    async get(did) {
      const row = await db
        .prepare('SELECT over13, over16, over18 FROM age_status WHERE did = ?1')
        .bind(did)
        .first<{over13: number; over16: number; over18: number}>()
      if (!row) return undefined
      return {
        over13: row.over13 === 1,
        over16: row.over16 === 1,
        over18: row.over18 === 1,
      }
    },
    async set(did, {over13, over16, over18}) {
      await db
        .prepare(
          `INSERT INTO age_status (did, over13, over16, over18, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT (did) DO UPDATE SET
             over13 = excluded.over13,
             over16 = excluded.over16,
             over18 = excluded.over18,
             updated_at = excluded.updated_at`,
        )
        .bind(
          did,
          Number(over13),
          Number(over16),
          Number(over18),
          new Date().toISOString(),
        )
        .run()
    },
  }
}
