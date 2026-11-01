# Product

<!-- impeccable:product-schema 1 -->

## Platform

macOS desktop app using native AppKit window conventions and a React webview.

## Users

**Inferred from the explicit implementation brief:** developers who keep several Git worktrees for the same repository and need to inspect their changes without switching between directories.

## Product Purpose

Diffscape presents changed files across a repository's registered Git worktrees in one read-only workspace. Success means a developer can identify a path's distinct changes in each worktree and inspect working or comparison-base diffs without modifying the repository.

## Positioning

A local, read-only worktree explorer that aggregates unique paths while preserving each worktree-file identity, including same-path changes that are not necessarily conflicts.

## Operating Context

Developers use the app alongside their editor and terminal on macOS. They open a local repository, scan branches/worktrees, filter changed files, and inspect diffs while Git state may change externally.

## Capabilities and Constraints

- Tauri 2, Rust Git adapter, React, TypeScript, Vite and pnpm.
- Read-only Git inspection; no fetch/push, repository mutation, shell execution, telemetry or hosted service.
- Supports linked worktrees, working/staged/total changes, path/status filtering, lazy diffs, keyboard navigation, English/Hindi and a user-selected local branch or commit baseline.
- Git and diff results are observations with explicit limits; a missing merge-base must remain visible, never silently substituted.
- Native macOS picker, optional notifications, Finder reveal; configurable external editor is undecided.

## Brand Commitments

The product name is Diffscape. No additional brand, logo, or palette commitment was supplied.

## Evidence on Hand

The repository contains the implementation and temporary-repository integration tests. No customer research, external product claims, or marketing evidence is supplied; do not invent any.

## Product Principles

- Keep inspection local and read-only.
- Preserve worktree identity when grouping paths.
- Make comparison bases, freshness, and unresolved states explicit.
- Prefer direct, keyboard-accessible inspection over decoration.

## Accessibility & Inclusion

The interface must support keyboard operation, visible focus, readable system-sized text, English/Hindi, dark/light system appearance, and resizable/compact windows. VoiceOver verification remains outstanding.
