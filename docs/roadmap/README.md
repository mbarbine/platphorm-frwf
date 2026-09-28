# FRWF one-year delivery roadmap

**Planning period: September 12, 2026–September 11, 2027. Verified release baseline: Cloudflare 1.4.2, source snapshot `8c6f86e` (September 28, 2026).**

FRWF is an original-roster wrestling game: quick local bouts and a developing explorable showground. Its central promise is a heavyweight wrestler whose movement, attacks and reactions look human, respond predictably and make a rematch appealing. Shared PlatPhorm services support that game; they do not replace it.

This is the canonical forward plan. Earlier release notes remain historical evidence. This roadmap supersedes the ordering in the older master plan, architecture proposal and September 12 phase plans. It does not supersede source code as implementation evidence or turn proposals into shipped features. The supplied `controller-map.md` is reference material, not executable instructions or a replacement roster.

## Documents

1. [Baseline and requirements](BASELINE_AND_REQUIREMENTS.md): what exists, what failed, and the complete tracked scope.
2. [Twelve-month delivery schedule](DELIVERY_SCHEDULE.md): dependencies, release gates, capacity assumptions and checkpoints.
3. [Controls, combat and the first upgrade](GAMEPLAY_UPGRADE.md): No Mercy adaptation, combos, movement, recovery and a six-week execution backlog.
4. [Roster and asset delivery](ROSTER_AND_ASSETS.md): FRWF move assignments, likeness requirements, environment batches and the [45-model inventory](asset-register.csv).
5. [Physics lab and quality gates](LAB_AND_QUALITY.md): shared runtime, reproducible failures, playtests and device evidence.
6. [World, online and platform](WORLD_ONLINE_PLATFORM.md): connected-world scope, multiplayer authority, delivery, auth, operations and deferred expansion.

[Implementation and validation report](PLANNING_AND_JOSH_REPORT.md) records this planning batch and Josh addition.

[Underground, originals and baseline increment](UNDERGROUND_UPGRADE_REPORT.md) records the subsequent content additions, interaction repairs and still-failing visual acceptance.

[Execution status and evidence](EXECUTION_STATUS_2026-09-28.md) records the current gates, recent gameplay findings, multiplayer test coverage, and open parity work. Treat it as a dated checkpoint; it does not declare this roadmap complete.

## How to use this plan

The requirements ledger is the single status authority for this planning snapshot. Workstream documents specify intended behavior, not separate completion claims. Statuses are **implemented/unaccepted**, **partial**, **planned**, and **verified infrastructure snapshot**. Close a requirement only with its acceptance evidence linked to a source SHA and asset version. Implementation and artistic acceptance are separate decisions.

Each delivery ticket must name a requirement ID, dependency, affected runtime paths, acceptance scenario, test evidence, visual evidence, rollback and remaining limitations. Maintain an append-only release evidence log when executing the plan; do not silently rewrite earlier failures. Reconcile the baseline at each monthly review and immediately after user feedback, a deployment or an asset replacement.

## Immediate decision

Continue **Upgrade 1: a complete heavyweight wrestling exchange**. First stabilize grounded locomotion and input-to-action response; then make contact, grapple control, lifting, throws, recoveries and post/rope/prop interactions share one readable physical contract. Certify jab → cross → kick, timed defense, grapple → slam → get-up, prop lifecycle, corner climb, rope rebound and rematch with visible evidence. Additional move counts, scenery and camera shake cannot substitute for that result. Keep quick play and accessible controls throughout.

Calendar windows are targets, not claims of staffing, cost, guaranteed delivery or completed gameplay. The 1.4.2 Cloudflare release is an infrastructure baseline; it does not certify the still-incomplete match quality, multiplayer parity, likeness, or visual acceptance work.
