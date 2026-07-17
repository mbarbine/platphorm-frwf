# Sentinel's Journal

🛡️ Security-focused learnings and constraints for Ringfall: Chaos Circuit.

## 2025-02-13 - [Input Validation and Crash Prevention in Room Messages]
**Vulnerability:** Game room server handlers were vulnerable to Denial of Service (DoS) and crash vectors due to missing validation on client WebSocket payloads (e.g. `version`, `selectFighter`, `command`, `pause`). A client sending a null, undefined, or primitive payload would cause a TypeError and crash the entire room process/state-machine.
**Learning:** Colyseus message handler callbacks are executed directly within the room context. Any unhandled TypeError within these callbacks can disrupt room stability. Standardizing defensive object type checks on all msg arguments mitigates this risk.
**Prevention:** Always validate that incoming payload variables (`msg`) are non-null objects and have expected types (`typeof msg === 'object' && msg !== null`) before accessing their nested fields.
## 2024-07-17

**Title:** Fixed Overly Permissive Default CORS Configuration

**Vulnerability:**
The `CORS_ORIGIN` default in `server/src/config.ts` was set to a wildcard (`*`). This is a security vulnerability because it allows any origin to send cross-origin requests and read the responses, potentially exposing sensitive game data or allowing malicious sites to interact with the game server on behalf of users.

**Learning:**
Default configuration variables should restrict sensitive endpoints (like WebSockets and API routes in a multiplayer context) to known origins only. Wildcards are dangerous in both production and development when dealing with shared or exposed backend services.

**Prevention:**
The default `CORS_ORIGIN` now restricts to the standard frontend port (`http://localhost:5173`) in development and blocks access by default in production (`''`), requiring explicit configuration of the allowed frontend origin in production environments.
