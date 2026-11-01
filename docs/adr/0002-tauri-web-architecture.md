# ADR 0002: Tauri and web frontend architecture

- **Status:** Accepted and implemented (early functional implementation)
- **Date:** 2026-11-01

## Context

The product is a macOS desktop app that needs local filesystem/Git inspection and a maintainable interface.

## Decision

Use Tauri 2 with a Rust backend and a React + TypeScript UI built with Vite. Manage JavaScript dependencies with pnpm. Keep the native bridge narrow and typed; Rust owns local Git integration and React owns presentation.

## Consequences

The implementation uses a narrow purpose-specific bridge; the current build and platform support remain early and require continued review. This decision does not imply release readiness, comprehensive permission review, or support for operating systems beyond the verified macOS build.

## Revisit when

An implementation establishes version pins, actual build constraints, or a material platform requirement that makes this proposal impractical.
