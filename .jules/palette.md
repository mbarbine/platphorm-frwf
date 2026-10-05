## 2025-05-22 - WCAG 2.5.3 Contiguous Label Matching for Mobile Controls
**Learning:** Touch UI action and hold buttons with uppercase labels (e.g. `STRIKE`, `POWER`, `GRAPPLE`, `ACTION`, `RUN`, `GUARD`) require `aria-label` values that start with the exact visible text string (e.g., `aria-label="STRIKE: ${quickLabel}"`, `aria-label="RUN: hold to sprint"`) to satisfy WCAG 2.5.3 (Label in Name) for Voice Control while avoiding role redundancies (e.g., omitting "button" from aria-label text).
**Action:** Always prefix `aria-label` strings on touch controls with the exact visible text followed by a colon and brief contextual detail, without including role words like "button".

## 2025-05-21 - WCAG 2.5.3 Contiguous Label Matching for Media Toggle Controls
**Learning:** Adding descriptive words inside an `aria-label` phrase between words of a visible button label (e.g., `Pause background footage` when the visual button text is `PAUSE FOOTAGE`) breaks WCAG 2.5.3 (Label in Name) because speech recognition engines expect the visual text sequence to appear contiguously; placing the visual label text string first (e.g., `aria-label="PAUSE FOOTAGE: pause background ringside video"`) ensures Voice Control matches spoken activation commands.
**Action:** When adding descriptive `aria-label` values to action or toggle buttons, prefix the `aria-label` with the exact visual label text before appending additional contextual details.

## 2025-05-20 - Range Slider Percentage Formatting with aria-valuetext
**Learning:** HTML `<input type="range">` elements with decimal `min`/`max` values (e.g. `0` to `1`) report unformatted numeric values (`0.72`) to screen readers by default; adding `aria-valuetext` formatted as a percentage (`72%`) ensures screen readers announce formatted values matching the visual UI readout.
**Action:** When creating range inputs with custom visual units (like percentages), include `aria-valuetext` matching the visual readout string.

## 2025-05-19 - WCAG 2.5.3 Label in Name for HUD Buttons
**Learning:** In-game HUD buttons with visible text (e.g., "CAMERA · BROADCAST", "SWITCH TARGET") must begin their `aria-label` with the exact visible label text to comply with WCAG 2.5.3 (Label in Name), enabling speech control software (Voice Control / Dragon) to match spoken voice commands to interactive controls.
**Action:** When adding or updating `aria-label` attributes on visible text buttons, ensure the accessible name starts with the visible text (e.g. `aria-label="CAMERA · BROADCAST: change playing camera"`).

## 2025-05-18 - Copy Feedback and Live Region Persistence for Lobby Links
**Learning:** Button text state transitions (e.g., from "COPY LINK" to "LINK COPIED!") require pre-registered persistent `aria-live` containers and strict WCAG 2.5.3 (Label in Name) matching so screen readers announce state updates reliably without accessibility audit violations.
**Action:** When adding visual confirmation feedback to action buttons, wrap feedback state in accessible controls using persistent `role="status"` `aria-live="polite"` nodes and ensure `aria-label` starts with the visible button text.
