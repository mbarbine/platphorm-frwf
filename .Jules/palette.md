## 2025-05-19 - WCAG 2.5.3 Label in Name for HUD Buttons
**Learning:** In-game HUD buttons with visible text (e.g., "CAMERA · BROADCAST", "SWITCH TARGET") must begin their `aria-label` with the exact visible label text to comply with WCAG 2.5.3 (Label in Name), enabling speech control software (Voice Control / Dragon) to match spoken voice commands to interactive controls.
**Action:** When adding or updating `aria-label` attributes on visible text buttons, ensure the accessible name starts with the visible text (e.g. `aria-label="CAMERA · BROADCAST: change playing camera"`).

## 2025-05-18 - Copy Feedback and Live Region Persistence for Lobby Links
**Learning:** Button text state transitions (e.g., from "COPY LINK" to "LINK COPIED!") require pre-registered persistent `aria-live` containers and strict WCAG 2.5.3 (Label in Name) matching so screen readers announce state updates reliably without accessibility audit violations.
**Action:** When adding visual confirmation feedback to action buttons, wrap feedback state in accessible controls using persistent `role="status"` `aria-live="polite"` nodes and ensure `aria-label` starts with the visible button text.
