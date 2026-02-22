# Documentation Guide

This folder contains project documentation with different levels of authority.

## Source of Truth Order

When docs conflict, use this order:

1. `DECISIONS.md` (current architecture and scope decisions)
2. `BUILD_PLAN.md` (current phased execution plan)
3. `BUILD_LOG.md` (implementation history and status notes)
4. `README.md` + `docs/build-environment.md` (operator and contributor guidance)
5. `docs/research/*.md` and `docs/research-deep/*.docx` (research snapshots and rationale)

## Scope Baseline (v1)

Current v1 platform scope is Linux, Windows, and macOS desktop.
Web remains out of scope for v1.

## Research Docs Status

Files under `docs/research/` and `docs/research-deep/` are retained as historical research inputs.
Some of those snapshots contain earlier Windows-first assumptions that are now superseded by `DECISIONS.md`.
