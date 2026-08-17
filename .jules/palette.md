## 2025-02-18 - Prevent Accidental Settings Reset
**Learning:** Destructive actions such as resetting all local user settings can be triggered accidentally, particularly by users navigating via keyboard or touch screen, causing loss of customized accessibility/audio profiles. Introducing a temporary, focus-aware double-confirmation state directly on the reset button prevents accidental loss of user settings without introducing disrupting modal overlays.
**Action:** Replace direct action with a 3-second self-reverting double-confirmation button flow.

## 2025-02-19 - Semantic Label Pairing and Focus Outline Uniformity
**Learning:** Dynamic settings values can sometimes be skipped or mis-announced by screen readers if `<label>` wrappers contain too many changing textual elements without a clean programmatic `id`/`htmlFor` pairing. Furthermore, custom `select:focus-visible` states are often left unstyled compared to inputs and buttons, creating a disjointed keyboard navigation cue. Providing matching `id`/`htmlFor` associations across all inputs, checkboxes, and selects, plus standardizing `select:focus-visible` states, yields a seamless, accessible user configuration experience.
**Action:** Always link form controls with explicit unique IDs and ensure select dropdowns are explicitly covered in custom focus stylesheets.
