# UI and design

**Status: a three-pane interface is implemented; accessibility and visual QA remain early.** The app includes a worktree sidebar, filtered changed-file list, and lazy diff pane, plus a repository summary, scan-activity panel, working/staged/total modes, unified/split layouts, status/path filters, keyboard search/navigation, refresh, native folder selection, Finder reveal and opt-in notifications.

Same-path overlap across worktrees is marked as a shared path and explicitly not called a merge conflict. Detached HEAD and missing comparison bases have labels. File names and diff contents render as text.

Current UI includes focus styles and semantic labels. It has not been reviewed with VoiceOver, reduced-motion settings, high contrast, very long translations, narrow window sizes, or systematic keyboard-only scenarios. The committed UI has activity-based sorting but no retained activity timeline; a timeline and configurable external-editor handoff were visible only in uncommitted source changes during the audit and are not yet verified. The activity signal is filesystem observation, not commit history. Status filtering is implemented; configurability of filter options is not a separate feature.
