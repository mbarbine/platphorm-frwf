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
