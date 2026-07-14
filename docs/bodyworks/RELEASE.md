# Bodyworks release and rollback

## Promotion gate

Do not promote a deployment because the static build is green. Promotion requires the full Gold Master sequence: lint, strict typecheck, all unit/integration tests, 50-match AI soak, production bundle inspection, deterministic browser suite, six-rematch heap/body soak, immutable preview smoke, and discovery/platform smoke.

Report these states separately:

1. source implemented;
2. local gates green;
3. immutable preview Ready;
4. preview gameplay verified;
5. production deployment Ready;
6. canonical `https://frwf.platphormnews.com` verified.

## Clean rollback path

Ringfall does not ship a permanent second engine or a fake runtime feature flag. Vercel's immutable deployment history is the single rollback path:

1. record the current production deployment before promotion;
2. promote the verified Bodyworks deployment;
3. if a production-only blocker appears, immediately re-promote the recorded previous Ready deployment;
4. verify the canonical alias, `/api/health`, discovery files, and a short match smoke;
5. fix forward on a new immutable preview.

The rollback trigger is any startup collapse, recurring vibration, non-finite body, ordinary-match containment, wall traversal, missing controls, match-resolution failure, console crash, or material device regression.

## Device qualification

Headless Chromium certifies deterministic desktop controls, touch layout, gamepad emulation, and WebXR capability discovery. A human/device pass is still required for representative iOS Safari, Android Chrome, a standard Bluetooth/USB gamepad, and at least one OpenXR headset. Device-required evidence is never reported as headless-certified.

