# Sentinel's Journal

🛡️ Security-focused learnings and constraints for Ringfall: Chaos Circuit.

## 2025-02-13 - [Input Validation and Crash Prevention in Room Messages]
**Vulnerability:** Game room server handlers were vulnerable to Denial of Service (DoS) and crash vectors due to missing validation on client WebSocket payloads (e.g. `version`, `selectFighter`, `command`, `pause`). A client sending a null, undefined, or primitive payload would cause a TypeError and crash the entire room process/state-machine.
**Learning:** Colyseus message handler callbacks are executed directly within the room context. Any unhandled TypeError within these callbacks can disrupt room stability. Standardizing defensive object type checks on all msg arguments mitigates this risk.
**Prevention:** Always validate that incoming payload variables (`msg`) are non-null objects and have expected types (`typeof msg === 'object' && msg !== null`) before accessing their nested fields.

## 2025-02-14 - [Defensive Room Creation and Client Connection Validation]
**Vulnerability:** Colyseus server room methods `onCreate` and `onJoin` are called with arbitrary arguments provided by client request payloads. Missing validations of the `options` argument allowed `null`, `undefined`, or malformed objects to propagate, causing `TypeError`s (such as property access on undefined) that crashed the whole server process (Denial of Service).
**Learning:** Colyseus does not validate room options or client join payloads against the TypeScript types at runtime. Safe, defensive type checks (`typeof options === 'object'`) and whitelisting logic must be manually applied to safeguard server stability.
**Prevention:** Always assume `options` can be `null`, `undefined`, or of an unexpected type. Extract and sanitize each property with whitelisted fallbacks before assigning them to any schema or state object.
## 2025-02-27 - [Missing Server Header Disablement]
**Vulnerability:** The Express server initialization was missing the disablement of the `X-Powered-By` header, which broadcasts the underlying server technology stack (Express) to clients. This could be used by malicious actors to gather intelligence for targeted exploits.
**Learning:** Security hardening must be implemented at the very start of server instantiation to reduce the attack surface. Disclosing internal technology stacks unnecessarily provides potential attackers with a vector to find matching CVEs or framework-specific exploits.
**Prevention:** Always include `app.disable('x-powered-by')` immediately after creating an Express application instance to ensure the framework's default header is stripped from all responses.
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

## 2025-02-27 - [Predictable Match Seeding via Math.random]
**Vulnerability:** Game match seeding on the server was using `Math.random()` to generate the seed value. Since `Math.random()` is not cryptographically secure, the resulting seed could be easily predicted by a malicious client, potentially giving them an unfair advantage by knowing random game events in advance.
**Learning:** For server-side authoritative state setups where random seed integrity is critical, any reliance on `Math.random()` can be exploited. Using standard cryptographic sources of randomness preserves seed integrity and match fairness.
**Prevention:** Always use `randomInt` from the native Node.js `crypto` module to safely generate cryptographically secure integer seeds.

## 2026-07-18 - [Missing Role and Session Validation on Room Message Handlers]
**Vulnerability:** Colyseus message handlers for `pause` and `rematch` did not validate whether the sender had an active, registered session or if the sender's role was a spectator. This allowed spectators or unauthorized/unregistered clients to pause/unpause single-player matches or submit votes for rematch states, potentially resulting in unauthorized manipulation of room lifecycle states or state schema bloat.
**Learning:** Message handlers registered inside Colyseus rooms are triggered for *any* client connection that sends the matching message name. Unless explicit session and role verification checks (`session.role !== 'spectator'`) are performed at the beginning of each handler, any connected client can invoke these methods regardless of privilege.
**Prevention:** Always retrieve and validate the client's session and role (`this.sessions.get(client.sessionId)`) before executing state changes or registerable votes in room-level message handlers. Ensure spectators and unauthenticated connections are strictly early-returned/denied access.

## 2026-07-19 - [Unvalidated Downstream Query Parameter Propagation in Route Compliance Redirect]
**Vulnerability:** The Vercel serverless redirect route `api/v1/route-compliance.js` was forwarding the `timeoutMs` query parameter directly to a downstream service without validation. This created security exposure to parameter injection, potential downstream Denial of Service (DoS) due to excessive timeout value ranges, or server/parsing crashes if malformed non-integer payloads were passed.
**Learning:** Any user input from request queries (`request.query`) that is forwarded, proxied, or redirected to internal or external downstream endpoints must be treated as untrusted and validated. Directly stringifying and forwarding query parameters bypasses local type/bound controls.
**Prevention:** Always parse, sanitize, and validate the query parameters (such as verifying `timeoutMs` is a valid bounded integer e.g., between 100ms and 10000ms) with a safe default fallback before forwarding it.

## 2026-07-20 - [Technology Stack and Stack Trace Information Disclosure via Unhandled Express Errors]
**Vulnerability:** Unhandled exceptions in the Express HTTP application routes or middlewares defaulted to Express's default HTML error renderer, exposing internal directory structures, framework identities, and stack traces to clients. This could assist attackers in profiling the framework setup and identifying potential exploitation surfaces.
**Learning:** Default framework error handling configurations are usually verbose to aid development but dangerous in production environments. Explicitly catching and sanitizing all unhandled errors at the end of the middleware stack is required to guarantee secure-by-default behavior.
**Prevention:** Register a centralized secure error-handling middleware (`(err, req, res, next) => { ... }`) at the end of the Express middleware stack to log the actual error internally and return a sanitized, standard JSON response with no trace of internal stack or exception details.

## 2026-07-21 - [Defensive Rate Limiting on Express Endpoints]
**Vulnerability:** The Express HTTP endpoints (like `/health`, `/ready`, `/version`, and `/colyseus` monitor) had no rate limiting, leaving them susceptible to Denial of Service (DoS) through rapid automated scanning, brute-forcing, or connection/resource exhaustion (CWE-307/CWE-400).
**Learning:** Even simple, lightweight operational or informational routes should be protected by rate limits to safeguard system availability. Dependency-free custom middlewares with safe periodic map cleanup can implement this effectively.
**Prevention:** Register a centralized, memory-safe sliding-window rate-limiting middleware early in the middleware stack to restrict requests per IP address, with a clear cleanup routine to prevent memory leaks.
