# ADR 0002: Tauri and web frontend architecture

- **Status:** Proposed
- **Date:** 2026-11-01

## Context

The product is a macOS desktop app that needs local filesystem/Git inspection and a maintainable interface.

## Proposal

Use Tauri 2 with a Rust backend and a React + TypeScript UI built with Vite. Manage JavaScript dependencies with pnpm. Keep the native bridge narrow and typed; Rust owns local Git integration and React owns presentation.

## Consequences

The bridge and platform permissions require review, and frontend code must not gain generic command execution. This stack is a direction, not a verified build configuration: manifests, versions, and module boundaries are not present in this checkout.

## Revisit when

An implementation establishes version pins, actual build constraints, or a material platform requirement that makes this proposal impractical.
