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
