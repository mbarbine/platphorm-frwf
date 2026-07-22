## 2025-02-18 - Prevent Accidental Settings Reset
**Learning:** Destructive actions such as resetting all local user settings can be triggered accidentally, particularly by users navigating via keyboard or touch screen, causing loss of customized accessibility/audio profiles. Introducing a temporary, focus-aware double-confirmation state directly on the reset button prevents accidental loss of user settings without introducing disrupting modal overlays.
**Action:** Replace direct action with a 3-second self-reverting double-confirmation button flow.

## 2025-02-19 - Semantic Label Pairing and Focus Outline Uniformity
**Learning:** Dynamic settings values can sometimes be skipped or mis-announced by screen readers if `<label>` wrappers contain too many changing textual elements without a clean programmatic `id`/`htmlFor` pairing. Furthermore, custom `select:focus-visible` states are often left unstyled compared to inputs and buttons, creating a disjointed keyboard navigation cue. Providing matching `id`/`htmlFor` associations across all inputs, checkboxes, and selects, plus standardizing `select:focus-visible` states, yields a seamless, accessible user configuration experience.
**Action:** Always link form controls with explicit unique IDs and ensure select dropdowns are explicitly covered in custom focus stylesheets.

## 2025-02-20 - Non-Intrusive Clipboard Copy Visual State Feedback
**Learning:** When users click a button to copy content like multiplayer room lobby codes, the lack of immediate confirmation forces them to repeatedly click or guess if it worked. Introducing a temporary, self-reverting visual transition state (such as changing 'COPY CODE' to 'COPIED!' for 2 seconds) coupled with aria-live="polite" and an explicit aria-label ensures clear, confident feedback for both visual and screen-reader users without introducing screen-blocking notifications.
**Action:** Use a temporary React state-backed self-reverting label change with aria-live="polite" to give elegant, non-intrusive copy confirmation feedback.

## 2025-02-21 - Seamless Keyboard Form Submission and Polite Aria-Live Count Announcements
**Learning:** For a truly inclusive keyboard and screen-reader experience, forms containing key text fields (such as multiplayer room lobbies) must support implicit submission on Enter keypresses to prevent users from having to traverse the tab loop to hit a submission action. Additionally, incremental controls (such as the locker room beer intake counter) benefit significantly from `aria-live="polite"` tags directly on the dynamic label wrapper, ensuring screen-reader users receive clear and immediate updates about value adjustments without disrupting focus.
**Action:** Implement form submission keydown handlers for Enter keys in interactive input fields and use explicit politely live nodes for real-time value tracking.

## 2025-02-22 - Intuitive Fighter Select Keyboard Navigation and Real-Time Selection Announcements
**Learning:** Selecting characters on a grid or list using only Tab keys can be tedious for keyboard-bound users. Integrating Arrow key navigation (ArrowUp/ArrowDown/ArrowLeft/ArrowRight) on interactive lists provides a familiar, native-feeling, and accelerated selection flow. Furthermore, wrapping selected details in an offline, visually hidden aria-live="polite" region ensures screen readers immediately announce fighter attributes like Archetype and Signature moves as focus shifts.
**Action:** Always map standard keyboard directional arrows to roster or select grids and couple selection changes with programmatic aria-live descriptive feedback.
