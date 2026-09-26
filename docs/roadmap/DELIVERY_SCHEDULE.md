# Twelve-month delivery schedule

Dates are target windows. Capacity is not established: this schedule assumes sustained gameplay engineering, character/animation authoring and regular QA/playtest access. One person covering all roles will need fewer content variants or longer dates. No procurement, paid generation, external staffing or new service purchase is implied. Budget each month approximately 60% feature work, 25% verification/polish and 15% regression reserve; revise after the first two weeks of measured throughput.

Do not postpone anatomical quality until a late art pass. Do not make online authority depend on unreliable local movement. Continue small compatible asset imports while the core gameplay gate is open, but do not displace its critical work.

| Month / dates | Deliverable | Dependencies and exit decision |
| --- | --- | --- |
| 1 · Sep 12–Oct 11, 2026 | Shared lab baseline; anatomical pilot; walk/run/stop/get-up repair; unified intents and tap/hold prototype; jab/cross/kick chain | R01–05/R14. Ordinary inputs produce visible, grounded actions; diagnose remaining target/solver/skin errors before more moves |
| 2 · Oct 12–Nov 11 | Upgrade 1 local bout: mixed combos, uppercut/stomp, timed defense, grip/slam/recovery, climb/exit and prop lifecycle | Month 1 contract. Complete Singles and default Battle Royale with honest interruption feedback, no stuck recovery or false contact |
| 3 · Nov 12–Dec 11 | Representative roster bodies extended; arena ring assets; HUD/camera/spectator cleanup; crowd and rig LOD | Upgrade 1 accepted. No geometry obscures ordinary camera; heavy and agile profiles retain correct support/grips |
| 4 · Dec 12–Jan 11, 2027 | Fifteen roster identity passes; paired moves/finishers; remaining interactive props; animation/replay parity | Canonical rig and stable contacts. Each move/prop has an evidence entry; outfit and weight do not break animations |
| 5 · Jan 12–Feb 11 | Underground/backstage/showground construction; all architecture/hero dressing; audio/entrance/crowd pass | Asset batches validated. Traversable doors/stairs, bounded streaming, measured full-bout performance |
| 6 · Feb 12–Mar 11 | Connected local world release; encounter lifecycle, rivalries, durable local saves; selected match variants | One complete explore → fight → result → explore → reload journey; all supplied assets have accepted use or explicit reason for exclusion |
| 7 · Mar 12–Apr 11 | Online authority decision and parity prototype; versioned commands, player sessions and room lifecycle | Local core gate. Compare Colyseus/Node and Worker/DO approaches with real scenarios; choose one gameplay owner before migration |
| 8 · Apr 12–May 11 | Private online alpha: two clients, authoritative hits/grips/props, reconnect, spectators and rematch | Parity prototype. No public online-ready claim; measure latency, corrections and tick cost |
| 9 · May 12–Jun 11 | Multiplayer release candidate; load/soak, abuse boundaries, replay diagnostics and rollback | Network and operator gates. Quick Match only when functioning pool/queue exists; honest empty matchmaking |
| 10 · Jun 12–Jul 11 | Device/accessibility release; gamepad/touch refinement; optional XR prototype and comfort assessment | Actual hardware access. XR may remain explicitly experimental; no unsupported device badge |
| 11 · Jul 12–Aug 11 | Championship/rivalry depth, roster/outfit customization and additional venue/match content | Core, save and online versioning stable. Pick variants using playtest evidence; do not ship every reference-game mode merely because it is listed |
| 12 · Aug 12–Sep 11 | One-year stabilization release; regression closure, content tuning, full support/deployment rehearsal and year-two plan | Cross-workstream evidence review; known gaps stay public-safe and explicit; retire superseded implementations only after migration proof |

## Checkpoints and scope protection

- Weekly: play an ordinary bout, review three worst failures, compare previous footage, update requirement evidence. Never use a lab-only success to close ordinary gameplay.
- Every two weeks: a bounded playable increment with release notes and unresolved regressions. Do not deploy an unstable experiment merely to meet the calendar.
- Monthly: re-estimate remaining work, check original screenshots, asset inventory and device results. Allocate reserve to regressions before adding move variants.
- Quarter 1 gate: convincing local control, recovery and representative humans. Quarter 2: original roster and connected local world. Quarter 3: proven online session lifecycle. Quarter 4: device quality, progression and stability.
- If a gate slips, keep its dependency blocked and reduce downstream content breadth. Do not cut contact, anatomy, auth, save safety or truthful reporting to hold a date.

## Risks and responses

| Risk | Response / escalation condition |
| --- | --- |
| Active ragdoll and imported rest axes fight each other | Compare target, solved segment and rendered bone in the same capture; choose one pose authority per state before retuning motors |
| Correct art cannot be produced by parameter inflation | Author one reviewed offline body/garment rig; retain previous asset until moving comparison passes |
| Too many concurrent content systems | Limit active work to core exchange plus one compatible asset batch; park world/network expansion behind gates |
| Guide control mappings conflict with contextual pickup/pin/traverse | One intent resolver and explicit fallback bindings; test every conflict instead of adding hidden priority rules |
| Software WebGL masks timing defects | Record simulation and render timing separately; obtain real-device footage before performance acceptance |
| Missing animation recordings or hardware | Use clearly identified authored clips; retain mocap/XR as unverified, and plan external needs without inventing completion |
| Two different online simulations | One authority decision record, shared legality and contact semantics, migration/rollback before marketing multiplayer |
| Deployments drift or canonical TLS warning returns | Verify SHA, hostname/certificate, assets and authenticated integration separately on each provider |
