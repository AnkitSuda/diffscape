# UI and design

**Status: three-pane interface implemented; accessibility and visual QA remain early.** The app includes a compact worktree sidebar, hierarchical changed-file tree, and lazy diff pane; repository switcher, base selector, scan activity, working/staged/total modes, unified/split/context controls, refresh, native folder selection/drop, Finder reveal and opt-in notifications.

Same-path overlap can be grouped by path while retaining a separate leaf per worktree, or grouped by worktree. It is never called a merge conflict. Search includes old rename names. Status and staged/unstaged/untracked/committed facets and path/status/worktree/observed-activity sorts are available. A session activity popover shows observed filesystem/worktree events, not historical Git activity. Preferences include a configurable macOS editor handoff.

Current UI includes focus styles and semantic labels. Playwright tests exercise repository open/switch, file selection, live mock snapshot/timeline updates, controls, and 800×560 viewport pane visibility. AO Browser light/dark fixtures were visually checked before the latest utility additions; the new preference/timeline controls are verified by browser DOM and compact viewport tests. VoiceOver, reduced motion, high contrast, lengthy translation and full native keyboard-only QA remain outstanding.
