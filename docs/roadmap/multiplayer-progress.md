# Multiplayer delivery evidence

Matches require at least two connected players, with a maximum of six. The host is ready by default, other connected players choose Ready, and the host starts explicitly once all connected participants are ready. Empty reserved seats must never prevent a start.

## Current implementation

The deterministic game-core accepts two to six distinct sessions, spawns them facing inward, separates all body pairs, selects the nearest living opponent, freezes facing during committed attacks, and resolves the bout only after the final elimination. Commands are sequenced independently per session; eliminated wrestlers cannot move or resume idle after recovery.

These are simulation capabilities, not a claim of shipped six-player multiplayer. The Cloudflare start gate and browser match rendering still support two active wrestlers. They must stay honest until the occupied roster is carried through both layers.

## Remaining release work

- Extend the occupied two-player roster to all supported seats, reconnect, disconnect, and rematch handling. Unused reservations are now excluded from forfeits.
- Render and reconcile every occupied seat, mapping the local session to its controlled wrestler on each client.
- Replace pair-only effects, winner mapping, physics registration counts, and target handling.
- Test starts with two, three, four, five, and six players; assert empty seats never block a start.
- Verify simultaneous keyboard, touch, and gamepad input in separate clients, consistent facing, and host migration.
- Measure command acknowledgement and presentation delay; implement bounded local prediction and authoritative correction.
- Complete live gameplay and Cloudflare deployment verification before claiming release.

## Replay and mobile quality follow-up

Replay now uses the live skinned character assets and attached gear, including all recorded battle royale wrestlers. Playback samples simulation timestamps with interpolated positions and normalized shortest-path rotations. The camera frames the recorded impact participants with portrait aspect taken into account, keeping unrelated battle royale wrestlers out of the camera calculation. Live impact effects are hidden during playback. Live HUD and touch controls unmount during replay; touch input clears on unmount and lost pointer capture. Automatic replays are disabled for online bouts because other humans continue playing on the authoritative server.

Local replay/input tests, build, and lint are required. Actual iPhone playback and live control feel still require device validation. These changes do not claim all reported control and gameplay issues are resolved.

## Multiplayer controls and connection follow-up

Idle clients send a heartbeat every ten seconds, measure its round trip time, and stop the timer when leaving or replacing a connection. The Worker excludes unused invitations from active-match timeouts. Match creation selects actual connected participants, including seats two and three after the original host leaves. The browser maps its local wrestler by authenticated session identity rather than assuming the host is always seat one.

Regression evidence: nine client tests cover invitations, commands, heartbeat lifetime, connection replacement, and a delayed welcome identity; fifteen Worker integration tests include a match lasting beyond the thirty-second idle deadline with four empty seats and a start after host migration. The browser test now requires explicit host Start and checks movement plus attack acknowledgements from both clients. The two-browser movement, independent command acknowledgement, contact damage, and forfeit journey passed locally; these changes do not establish zero latency or six-player live combat.

The browser uncovered a handshake race: socket-open completed before Welcome supplied the seat identity, leaving Ready and Start controls hidden. Welcome now publishes identity to the store immediately, independent of connection promise ordering.

## Release gate status

The room integration suite isolates client addresses between test cases so fixture creation does not accidentally consume another test's host-rate budget. A dedicated test verifies the eighth room succeeds and the ninth request returns 429. Every room fixture checks 201 before reading its invitations. All fifteen Worker integration tests passed after this correction.

The full root suite currently has four failing tests: two neutral/directional strike-selection expectations, Nova idle arm vibration, and roundhouse physical contact. Those findings remain release blockers alongside the uncompleted six-player client integration and real-device control/replay validation. No production release is claimed from the narrower browser and Worker passes.
