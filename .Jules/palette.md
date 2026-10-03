## 2025-05-21 - Sentence Casing in ARIA Labels to Prevent Spelling Out
**Learning:** Adding ALL CAPS text inside `aria-label` attributes causes some screen readers (VoiceOver, NVDA, JAWS) to spell out words letter-by-letter (e.g., "N-E-X-T"). Using Sentence or Title Case (e.g., `Next wrestler: spectate next active wrestler`) preserves speech engine pronunciation while complying with WCAG 2.5.3 (Label in Name) case-insensitive label matching.
**Action:** When constructing `aria-label` attributes for controls with uppercase visual text, use Sentence or Title Casing instead of ALL CAPS to avoid TTS letter-by-letter spelling.

## 2025-05-20 - Range Slider Percentage Formatting with aria-valuetext
**Learning:** HTML `<input type="range">` elements with decimal `min`/`max` values (e.g. `0` to `1`) report unformatted numeric values (`0.72`) to screen readers by default; adding `aria-valuetext` formatted as a percentage (`72%`) ensures screen readers announce formatted values matching the visual UI readout.
**Action:** When creating range inputs with custom visual units (like percentages), include `aria-valuetext` matching the visual readout string.

## 2025-05-19 - WCAG 2.5.3 Label in Name for HUD Buttons
**Learning:** In-game HUD buttons with visible text (e.g., "CAMERA · BROADCAST", "SWITCH TARGET") must begin their `aria-label` with the exact visible label text to comply with WCAG 2.5.3 (Label in Name), enabling speech control software (Voice Control / Dragon) to match spoken voice commands to interactive controls.
**Action:** When adding or updating `aria-label` attributes on visible text buttons, ensure the accessible name starts with the visible text (e.g. `aria-label="CAMERA · BROADCAST: change playing camera"`).

## 2025-05-18 - Copy Feedback and Live Region Persistence for Lobby Links
**Learning:** Button text state transitions (e.g., from "COPY LINK" to "LINK COPIED!") require pre-registered persistent `aria-live` containers and strict WCAG 2.5.3 (Label in Name) matching so screen readers announce state updates reliably without accessibility audit violations.
**Action:** When adding visual confirmation feedback to action buttons, wrap feedback state in accessible controls using persistent `role="status"` `aria-live="polite"` nodes and ensure `aria-label` starts with the visible button text.
