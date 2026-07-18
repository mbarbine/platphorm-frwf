# Sentinel's Journal

🛡️ Security-focused learnings and constraints for Ringfall: Chaos Circuit.

## 2025-02-13 - [Input Validation and Crash Prevention in Room Messages]
**Vulnerability:** Game room server handlers were vulnerable to Denial of Service (DoS) and crash vectors due to missing validation on client WebSocket payloads (e.g. `version`, `selectFighter`, `command`, `pause`). A client sending a null, undefined, or primitive payload would cause a TypeError and crash the entire room process/state-machine.
**Learning:** Colyseus message handler callbacks are executed directly within the room context. Any unhandled TypeError within these callbacks can disrupt room stability. Standardizing defensive object type checks on all msg arguments mitigates this risk.
**Prevention:** Always validate that incoming payload variables (`msg`) are non-null objects and have expected types (`typeof msg === 'object' && msg !== null`) before accessing their nested fields.

## 2025-02-27 - [Missing Server Header Disablement]
**Vulnerability:** The Express server initialization was missing the disablement of the `X-Powered-By` header, which broadcasts the underlying server technology stack (Express) to clients. This could be used by malicious actors to gather intelligence for targeted exploits.
**Learning:** Security hardening must be implemented at the very start of server instantiation to reduce the attack surface. Disclosing internal technology stacks unnecessarily provides potential attackers with a vector to find matching CVEs or framework-specific exploits.
**Prevention:** Always include `app.disable('x-powered-by')` immediately after creating an Express application instance to ensure the framework's default header is stripped from all responses.
