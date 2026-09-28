-- Rebuild match_results so historical databases accept the complete roster.
-- SQLite cannot change a CHECK constraint in place; copy every existing row.
CREATE TABLE match_results_next (
  match_id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL CHECK(map_id = 'volt-dome'),
  ruleset TEXT NOT NULL CHECK(ruleset IN ('standard', 'chaos')),
  release TEXT NOT NULL,
  winner_fighter TEXT CHECK(winner_fighter IN ('atlas','vex','nova','brick','chad','dale','thomas','sonny','wrecking_ball','steve','john','justin','mondo','gil','josh','chelsea','britt','beer_bandit_bill','beer_bandit_ted')),
  method TEXT NOT NULL CHECK(method IN ('KNOCKOUT','TIMEOUT','FORFEIT')),
  duration REAL NOT NULL CHECK(duration >= 0 AND duration <= 601),
  hype REAL NOT NULL CHECK(hype >= 0 AND hype <= 100),
  completed_at TEXT NOT NULL
);

INSERT INTO match_results_next (match_id,map_id,ruleset,release,winner_fighter,method,duration,hype,completed_at)
SELECT match_id,map_id,ruleset,release,winner_fighter,method,duration,hype,completed_at FROM match_results;

DROP TABLE match_results;
ALTER TABLE match_results_next RENAME TO match_results;
CREATE INDEX IF NOT EXISTS results_completed ON match_results(completed_at DESC);
