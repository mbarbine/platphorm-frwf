## 2025-05-18 - Copy Feedback and Live Region Persistence for Lobby Links
**Learning:** Button text state transitions (e.g., from "COPY LINK" to "LINK COPIED!") require pre-registered persistent `aria-live` containers and strict WCAG 2.5.3 (Label in Name) matching so screen readers announce state updates reliably without accessibility audit violations.
**Action:** When adding visual confirmation feedback to action buttons, wrap feedback state in accessible controls using persistent `role="status"` `aria-live="polite"` nodes and ensure `aria-label` starts with the visible button text.
