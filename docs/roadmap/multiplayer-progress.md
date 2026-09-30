# Multiplayer delivery evidence

Matches require at least two connected players, with a maximum of six. The host is ready by default, other connected players choose Ready, and the host starts explicitly once all connected participants are ready. Empty reserved seats must never prevent a start.

## Current implementation

The deterministic game-core accepts two to six distinct sessions, spawns them facing inward, separates all body pairs, selects the nearest living opponent, freezes facing during committed attacks, and resolves the bout only after the final elimination. Commands are sequenced independently per session; eliminated wrestlers cannot move or resume idle after recovery.

These are simulation capabilities, not a claim of shipped six-player multiplayer. The Cloudflare start gate and browser match rendering still support two active wrestlers. They must stay honest until the occupied roster is carried through both layers.

## Remaining release work

- Pass the connected participant roster into room creation, reconnect, disconnect, and rematch handling; exclude unused reservations from forfeits.
- Render and reconcile every occupied seat, mapping the local session to its controlled wrestler on each client.
- Replace pair-only effects, winner mapping, physics registration counts, and target handling.
- Test starts with two, three, four, five, and six players; assert empty seats never block a start.
- Verify simultaneous keyboard, touch, and gamepad input in separate clients, consistent facing, and host migration.
- Measure command acknowledgement and presentation delay; implement bounded local prediction and authoritative correction.
- Complete live gameplay and Cloudflare deployment verification before claiming release.
