# ADR 0001: Local, read-only product boundary

- **Status:** Accepted product constraint
- **Date:** 2026-11-01

## Context

Diffscape is intended to aggregate Git worktrees for inspection. Repository mutation would create a high-risk mismatch between a status overview and consequential Git actions. Sending repository data to remote services would also undermine local ownership and privacy.

## Decision

The product inspects local Git/worktree state only. It does not mutate repositories and does not depend on remote services, accounts, sync, telemetry, or analytics. Refresh is observation only. The app must expose no generic shell or bridge capability that allows arbitrary Git writes.

## Consequences

The boundary is testable and release-blocking. Tests must prove repository state is unchanged and no network or hook execution occurs. Features requiring remote collaboration or repository mutation are out of scope unless this decision is explicitly revisited with user approval.

## Implementation status

Not verified in this checkout; no application code exists here.
