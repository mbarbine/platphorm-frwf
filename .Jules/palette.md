# Palette's Journal

## 2025-05-18 - WCAG 2.5.3 Title Case ARIA Labels
**Learning:** Using ALL CAPS in `aria-label` strings (e.g. `FIRST PERSON`) causes some screen readers to spell out text letter-by-letter. Using Title or Sentence Case (e.g. `First person`) matches visible uppercase UI text case-insensitively (satisfying WCAG 2.5.3 Label in Name) while ensuring natural speech synthesis.
**Action:** Always format `aria-label` text in Title or Sentence Case even when visual button text is capitalized.
