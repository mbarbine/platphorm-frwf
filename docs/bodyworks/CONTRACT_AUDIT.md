# Bodyworks contract audit and fun plan

This is the implementation ledger for the attached Bodyworks capability contract. The review order is player-facing: control first, contact truth second, wrestling expression third, presentation fourth, and lifecycle/release last. A capability is only marked implemented when it has a shipping path plus an objective gate; final certification still depends on the consolidated commands in `TEST_REPORT.md`.

| Capability family | Implemented system | Objective gate | Fun payoff |
| --- | --- | --- | --- |
| Preserve Ringfall | Five fighters, beers, Standard/Chaos, both AI levels, pin/KO, results and rematch remain intact | full-match and platform suites | The overhaul still feels like Ringfall |
| Input and control | Camera-relative keyboard, touch, gamepad and XR adapters share one command validator; live labels expose contextual outcomes | desktop, mobile and device browser scenarios | Inputs feel intentional instead of mysterious |
| Locomotion | Fixed-step whole-rig acceleration, run commitment, close-range braking, stable facing, planted-stop cleanup and authored walk/run visuals | idle, walk/run/brake/jump scenarios | Wrestlers feel responsive without skating or vibrating |
| Striking and guard | Legal attack windows, swept high-speed reach, body-region contact, spatial forearm guard, deduplication and whiffs | unit contact suite plus jab/kick/guard browser cases | Clean hits feel earned and misses stay misses |
| Grapple and throws | Two-hand spring grip, feasibility/load phases, failure, directional retargeting, physical release and landing | grapple/body-slam browser scenario and grip unit suite | Lock-ups create readable choices and credible weight |
| Recovery | Persistent collision body with back/front/side recovery orientation and distinct authored get-up motion | orientation unit and deterministic lab scenarios | Knockdowns have consequence without dead time |
| Ring and arena | Elastic ropes, loaded stiff-arm, explicit apron path, three-stage corners, aerial tracking, rail shot, steps, trash/chair/signs, movable barricades and breakable desk | deterministic rope, apron, dive, rail-shot and table scenarios | Players can invent wrestling stories around the arena |
| Camera and spectacle | Stable broadcast framing, event shots, occlusion avoidance, reduced-motion behavior, physical-event replay and highlights | camera/unit suite plus complete-match browser flow | Spectacle reinforces measured action instead of hiding it |
| AI | Same legality and command path as the player, with stamina, spacing, grapples, props, ropes and bounded completion | deterministic 50-match all-roster/rules/difficulty soak | Opponents pressure the player without cheating |
| Physics Lab | Play/pause/step, 0.25/0.5/1x, reset/repeat, seed, pairing, stamina and physical added-mass override; collider/COM/support/reach/grip/impact debug plus live force/timing/count diagnostics | lab browser scenarios | Every important behavior can be isolated, slowed and repeated |
| Performance and cleanup | Adaptive tiers, independently cached runtime chunks, bounded metrics/replay/props/fragments, complete runtime reset and six-rematch heap/object soak | build report, unit soak and browser soak | Matches start quickly and rematches do not decay |
| Static platform contract | Real discovery/health/docs/trust files and honest unsupported backend/auth/MCP/trace states | platform-contract suite | Machine readability never replaces or misrepresents the game |

## Deterministic lab checklist

The lab now exposes explicit standing, walk, run, brake, rapid turn, rope run, rebound stiff-arm, apron return, jump, landing, kick-up, back/front/side get-up, jab, jab whiff, jab into guard, hook, front/directional/missed kick, grapple acquisition, body slam, failed lift, physical grip break, Arc/German-equivalent suplex, powerbomb, rail shot, clothesline, spear, staged climb, top-rope dive, table collapse, knockout and complete runtime-reset cases.

## Final human/device qualification

Automation can certify behavior, cleanup and emulated input surfaces. It cannot honestly certify subjective controller feel or physical headset comfort. After local and preview gates are green, run short Standard and Chaos matches on desktop keyboard, representative iOS Safari and Android Chrome, one standard gamepad, and one OpenXR headset. Record device/browser, input latency or mapping issue, camera comfort, sustained frame rate, and whether the player could complete a match and rematch without help. These are device-required evidence, not hidden code TODOs.

## Ongoing super-fun cadence

1. Play one short match and record the least readable or least satisfying moment.
2. Classify it as control, readability, contact, environment, opponent, presentation, performance or lifecycle.
3. Reproduce it in Physics Lab with one seed/pair and slow motion.
4. Change the smallest owning system and add a deterministic assertion.
5. Run the focused scenario, then the complete release gate once the batch is finished.
6. Reject any improvement that adds spectacle while weakening input clarity, physical causality or cleanup.

