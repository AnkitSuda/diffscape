<!--
THESIS: Make cross-worktree change triage feel like a native macOS source-list and editor task, not an analytics dashboard.
OWN-WORLD: AppKit toolbar, source list and editor grammar; system font/color roles, restrained neutrals, one system accent, fine separators, native selection and window controls.
STORY: The developer scopes to all worktrees or one branch, selects a changed path, then reads that worktree's diff while knowing the selected comparison baseline.
FIRST VIEWPORT: Native titlebar/compact toolbar above a three-column workspace: 220 px worktree sidebar, 320 px changed-file list, remaining width for the diff; horizontal splitters and a 24 px status line.
FORM: Operate / canonical macOS desktop source-list-editor layout, explicitly requested by the user; no concept-seed roll because the brief pins this native visual world.
-->

# Design system

## Platform and color

Use macOS semantic appearance, not a fixed light or dark canvas. The light appearance is a familiar window surface with a subtly grouped sidebar and white content panes. Dark appearance mirrors the hierarchy using system-dark surfaces. Use system blue only for selection, focus and native primary actions. Borders are 1 px separators; no dashboard cards, decorative gradients, drop shadows, display typography or ornamental illustrations.

## Typography

Use `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; compact labels are 11–13 px and window/title labels 13–14 px. Use monospace only for commit IDs and code/diff content. Respect system text scaling where the WebView permits.

## Window and layout

Use a decorated Tauri window with macOS overlay titlebar and native traffic-light controls. The titlebar region remains draggable. The toolbar is compact and contains repository identity, comparison-base control, refresh and preferences. Below it, use a native source-list sidebar, changed-file list, and diff editor separated by subtle rules. Side/list panes can be resized by pointer and keyboard. Collapse the sidebar when the window becomes compact; maintain a usable list and diff.

## Controls and states

Prefer familiar macOS toolbar buttons, selects, source-list selection, text fields, separators, and native focus rings. Rows use native-height hit targets, clear primary/secondary labels, and one selected color. Keep staged/unstaged/untracked/committed meaning explicit. Shared paths are not called conflicts. Empty, loading, error, unavailable-base, binary, large-file and truncated states remain inline and legible.
