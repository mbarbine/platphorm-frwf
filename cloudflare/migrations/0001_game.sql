CREATE TABLE IF NOT EXISTS match_results (
  match_id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL CHECK(map_id = 'volt-dome'),
  ruleset TEXT NOT NULL CHECK(ruleset IN ('standard', 'chaos')),
  release TEXT NOT NULL,
  winner_fighter TEXT CHECK(winner_fighter IN ('atlas','vex','nova','brick','chad')),
  method TEXT NOT NULL CHECK(method IN ('KNOCKOUT','TIMEOUT','FORFEIT')),
  duration REAL NOT NULL CHECK(duration >= 0 AND duration <= 601),
  hype REAL NOT NULL CHECK(hype >= 0 AND hype <= 100),
  completed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS results_completed ON match_results(completed_at DESC);
CREATE TABLE IF NOT EXISTS map_versions (
  digest TEXT PRIMARY KEY CHECK(length(digest) = 64),
  map_id TEXT NOT NULL,
  version TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  published_at TEXT NOT NULL,
  UNIQUE(map_id, version)
);
CREATE TABLE IF NOT EXISTS operator_rate_limits (
  bucket TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
);
