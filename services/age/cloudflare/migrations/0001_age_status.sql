-- One row per account. Only threshold flags are stored, never a birthdate.
CREATE TABLE age_status (
  did TEXT PRIMARY KEY,
  over13 INTEGER NOT NULL,
  over16 INTEGER NOT NULL,
  over18 INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
