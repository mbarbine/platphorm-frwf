# Sentinel's Journal

🛡️ Security-focused learnings and constraints for Ringfall: Chaos Circuit.

## 2025-02-13 - [Input Validation and Crash Prevention in Room Messages]
**Vulnerability:** Game room server handlers were vulnerable to Denial of Service (DoS) and crash vectors due to missing validation on client WebSocket payloads (e.g. `version`, `selectFighter`, `command`, `pause`). A client sending a null, undefined, or primitive payload would cause a TypeError and crash the entire room process/state-machine.
**Learning:** Colyseus message handler callbacks are executed directly within the room context. Any unhandled TypeError within these callbacks can disrupt room stability. Standardizing defensive object type checks on all msg arguments mitigates this risk.
**Prevention:** Always validate that incoming payload variables (`msg`) are non-null objects and have expected types (`typeof msg === 'object' && msg !== null`) before accessing their nested fields.

## 2025-02-14 - [Technology Stack Information Disclosure via x-powered-by Header]
**Vulnerability:** The Express HTTP/WebSocket server in `server/src/index.ts` was leaking its backend framework identity via the default `X-Powered-By: Express` HTTP header. Information disclosure can assist attackers in fingerprinting the technology stack and targeting framework-specific vulnerabilities.
**Learning:** Default framework headers expose backend infrastructure details to clients. When hardening the Express configuration, explicitly removing default identifying headers reduces the server's attack surface and fingerprintability without affecting functional gameplay traffic or Colyseus stability.
**Prevention:** Always include `app.disable('x-powered-by');` in the Express application bootstrap sequence during the Defensive Security Hardening phase to prevent unintentional technology stack disclosure.
## 2026-07-17 - [Overly Permissive Default CORS Configuration]
**Vulnerability**: The application had a wildcard (`*`) as the default for `CORS_ORIGIN` if the environment variable was not provided. This could accidentally allow malicious sites to make cross-origin requests to the server, potentially exposing sensitive data or executing unauthorized actions if deployed in environments where environment variables are not strictly set.
**Learning**: Ensure that sensitive security configurations have safe, restricted defaults for local development. Never default to wildcard patterns for network configurations like CORS.
**Prevention**: Always restrict default CORS settings to local development origins (like `http://localhost:5173`) or specific domains required by the application, never a wildcard.
## 2024-07-17

**Title:** Fixed Overly Permissive Default CORS Configuration

**Vulnerability:**
The `CORS_ORIGIN` default in `server/src/config.ts` was set to a wildcard (`*`). This is a security vulnerability because it allows any origin to send cross-origin requests and read the responses, potentially exposing sensitive game data or allowing malicious sites to interact with the game server on behalf of users.

**Learning:**
Default configuration variables should restrict sensitive endpoints (like WebSockets and API routes in a multiplayer context) to known origins only. Wildcards are dangerous in both production and development when dealing with shared or exposed backend services.

**Prevention:**
The default `CORS_ORIGIN` now restricts to the standard frontend port (`http://localhost:5173`) in development and blocks access by default in production (`''`), requiring explicit configuration of the allowed frontend origin in production environments.

## 2025-02-14 - [Insecure Randomness Source in Match Seeding]
**Vulnerability:** Game match seeding was vulnerable to predictability due to using `Math.random()`, which is a pseudorandom number generator (PRNG) that doesn't produce cryptographically secure values.
**Learning:** For deterministic logic such as generating an unpredictable match seed, developers must use cryptographically secure random number generators instead of simple `Math.random()`.
**Prevention:** Use `randomInt` from the built-in Node.js `crypto` module (or `crypto.getRandomValues` in browsers) to ensure unpredictability.
