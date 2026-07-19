# Bolt's Journal - Critical Learnings Only

## 2026-07-22 - [Aligning Workspace Cleanliness with Sanitized Main Branch]
**Learning:** In a workflow where the upstream `main` branch has been stripped of the primary codebase for compliance, merging or basing development directly on older commits can lead to git staging/PR reports attempting to restore thousands of deleted files.
**Action:** Always verify changes and run tests locally by checking out the fully-populated merge commits first, then reset/base your clean PR branch on the sanitized upstream HEAD, adding only the targeted optimized file to prevent code pollution.
