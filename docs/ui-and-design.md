# UI and design

**Status: design principles only; no UI is present in this checkout.**

## Product posture

Diffscape should feel like a calm inspection surface, not a Git command center. Keep the active scope and freshness visible. The app is read-only: do not make common Git mutations look like available actions, and do not use disabled mutation controls as a substitute for removing them.

## Intended interaction principles

- Group repositories with their worktrees and make identity/state scannable.
- Separate clean, changed, detached, inaccessible, and stale/unknown observations using text and semantic labels, not color alone.
- Keep refresh explicit and communicate that other processes can change repository state at any time.
- Provide useful empty, loading, partial-result, permission-denied, and malformed-repository states.
- Preserve keyboard navigation, visible focus, VoiceOver-readable labels, and adequate contrast.
- Respect macOS conventions, reduced motion, system appearance, and window resizing.
- Treat file names, branch names, paths, and diff text as untrusted; render as text, never executable markup.
- Do not expose full diff content by default if it is unnecessary to the aggregation view; give users clear control over any sensitive detail display.

No visual design system, component library, or interaction has been implemented or selected yet.
