# Sentinel's Journal

🛡️ Security-focused learnings and constraints for Ringfall: Chaos Circuit.

## 2025-02-13 - [Input Validation and Crash Prevention in Room Messages]
**Vulnerability:** Game room server handlers were vulnerable to Denial of Service (DoS) and crash vectors due to missing validation on client WebSocket payloads (e.g. `version`, `selectFighter`, `command`, `pause`). A client sending a null, undefined, or primitive payload would cause a TypeError and crash the entire room process/state-machine.
**Learning:** Colyseus message handler callbacks are executed directly within the room context. Any unhandled TypeError within these callbacks can disrupt room stability. Standardizing defensive object type checks on all msg arguments mitigates this risk.
**Prevention:** Always validate that incoming payload variables (`msg`) are non-null objects and have expected types (`typeof msg === 'object' && msg !== null`) before accessing their nested fields.

## 2025-02-14 - [Insecure Randomness Source in Match Seeding]
**Vulnerability:** Game match seeding was vulnerable to predictability due to using `Math.random()`, which is a pseudorandom number generator (PRNG) that doesn't produce cryptographically secure values.
**Learning:** For deterministic logic such as generating an unpredictable match seed, developers must use cryptographically secure random number generators instead of simple `Math.random()`.
**Prevention:** Use `randomInt` from the built-in Node.js `crypto` module (or `crypto.getRandomValues` in browsers) to ensure unpredictability.
