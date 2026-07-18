# Sentinel's Journal

🛡️ Security-focused learnings and constraints for Ringfall: Chaos Circuit.

## 2025-02-13 - [Input Validation and Crash Prevention in Room Messages]
**Vulnerability:** Game room server handlers were vulnerable to Denial of Service (DoS) and crash vectors due to missing validation on client WebSocket payloads (e.g. `version`, `selectFighter`, `command`, `pause`). A client sending a null, undefined, or primitive payload would cause a TypeError and crash the entire room process/state-machine.
**Learning:** Colyseus message handler callbacks are executed directly within the room context. Any unhandled TypeError within these callbacks can disrupt room stability. Standardizing defensive object type checks on all msg arguments mitigates this risk.
**Prevention:** Always validate that incoming payload variables (`msg`) are non-null objects and have expected types (`typeof msg === 'object' && msg !== null`) before accessing their nested fields.

## 2026-07-17 - [Overly Permissive Default CORS Configuration]
**Vulnerability**: The application had a wildcard (`*`) as the default for `CORS_ORIGIN` if the environment variable was not provided. This could accidentally allow malicious sites to make cross-origin requests to the server, potentially exposing sensitive data or executing unauthorized actions if deployed in environments where environment variables are not strictly set.
**Learning**: Ensure that sensitive security configurations have safe, restricted defaults for local development. Never default to wildcard patterns for network configurations like CORS.
**Prevention**: Always restrict default CORS settings to local development origins (like `http://localhost:5173`) or specific domains required by the application, never a wildcard.
