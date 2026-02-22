# aDOs v1 – BUILD_PLAN

This document turns the aDOs v1 synthesis and decisions into a phased build plan.  
Each phase aims to be shippable on its own and composed of tasks that can be tackled in 30–60 minute units by you or by coding agents.

---

## Phase Overview

- **Phase 0 – Foundations & Repo Setup**  
  Fork Theia Blueprint, wire up Electron, harden the shell, establish build & packaging pipeline, and lay down base configuration.

- **Phase 1 – Core Shell, Command Palette & Knowledge Layer**  
  Get the main IDE experience running: files, terminals, command palette, keybindings, and the Markdown + SQLite-based knowledge layer.

- **Phase 2 – Browser & Canvas**  
  Embed the browser (tabs, profiles, persistence) and ship a first-version canvas with token support and exports.

- **Phase 3 – Visual Flows & MCP Tool Bus**  
  Implement visual flows and the minimal MCP tool set so flows and agents can operate on files, HTTP, browser, notes and canvas.

- **Phase 4 – Agents, Security Hardening & Performance**  
  Wire in the agent orchestrator, enforce the capability model end-to-end, and tune performance against cross-platform baseline budgets.

- **Phase 5 – Polish, Dogfooding & Alpha Release**  
  UX polish, guardrails, documentation, and internal use to validate the stack before any wider distribution.

---

## Phase 0 – Foundations & Repo Setup

### Objectives

- Have a forked and building desktop app based on Theia Blueprint.  
- Establish hardened Electron config as a baseline.  
- Set up a reproducible build/packaging pipeline for Linux, Windows, and macOS artifacts.
- Introduce basic repo structure for extensions and config.

### Milestones

- `M0.1` – Theia Blueprint fork builds and runs as a standalone app.  
- `M0.2` – Electron main/renderer is configured with security best practices.  
- `M0.3` – electron-builder pipeline produces platform-native artifacts for Linux, Windows, and macOS (signing/notarization where required).
- `M0.4` – Project structure ready for palette, flows, browser, agents, knowledge layer.

### Key Tasks (examples)

- Create repo and fork Theia Blueprint / Theia IDE.  
- Strip out clearly unneeded default extensions from the fork.  
- Configure Electron `BrowserWindow` options: `contextIsolation`, `sandbox`, `nodeIntegration`, etc.  
- Add a minimal preload/contextBridge which exposes only safe APIs initially.  
- Add electron-builder config (appId, productName, NSIS/DMG/ZIP targets) and wire to CI (GitHub Actions or similar).
- Generate and configure signing/notarization credentials for Windows and macOS builds; define Linux artifact strategy (AppImage/deb/rpm as needed).
- Introduce a `/extensions` folder layout for new custom Theia extensions (palette, browser, canvas, flows, agents, knowledge).  
- Add initial `DECISIONS.md` and `aDOs_v1_SYNTHESIS.md` to the repo as top-level docs.

---

## Phase 1 – Core Shell, Command Palette & Knowledge Layer

### Objectives

- Provide a usable IDE shell with files, terminals, and a working command palette.  
- Centralise commands and keybindings via Theia registries and a custom palette UI.  
- Set up the knowledge layer (Markdown vault + SQLite + search UI).

### Milestones

- `M1.1` – Theia-based IDE runs with a custom welcome and base theme.  
- `M1.2` – Command palette is implemented with Fuse.js search over commands and recent files.  
- `M1.3` – Global summon hotkey works and opens the palette.  
- `M1.4` – Markdown vault + FTS5 search + basic graph/backlinks UI is functional.

### Key Tasks

**IDE shell**

- Configure default workspace behaviour and open-file panels.  
- Set up base theme (colours, fonts) aligned with design tokens (even if tokens are still minimal).  
- Remove any leftover unused Theia extensions to keep the shell lean.

**Command palette**

- Implement a Theia extension for the palette UI (React-based).  
- Integrate with `CommandRegistry` and `KeybindingRegistry` as the single source of truth.  
- Add a Fuse.js-based provider for commands and recent files.  
- Register a global summon hotkey via Electron `globalShortcut`.  
- Implement a simple command history/favourites feature.  

**Keybinding editor**

- Build a basic keybinding editor UI (search, collision detection).  
- Implement export/import for keybinding presets (JSON or similar).

**Knowledge layer**

- Define folder structure for the Markdown vault (notes, journal, research, ADRs, etc.).  
- Add a service to maintain a SQLite DB with FTS5 indices over the vault.  
- Implement a “big search” UI separate from the palette, with filters and preview.  
- Implement backlinks and a basic graph view based on note links.  
- Provide MCP tools: `notes.read`, `notes.write`, `graph.query`.

---

## Phase 2 – Browser & Canvas

### Objectives

- Embed a tabbed browser with profiles, history, bookmarks and downloads.  
- Deliver a first version of the canvas engine with basic shapes, connections, token styling and export tools.

### Milestones

- `M2.1` – Browser tabs open and navigate, with per-tab DevTools.  
- `M2.2` – Session/profile isolation works (per partition profiles).  
- `M2.3` – History, bookmarks and downloads persist via SQLite.  
- `M2.4` – Canvas canvas supports pan/zoom, shapes, connectors and groups.  
- `M2.5` – Canvas export to JSON and PNG/SVG works; `canvas.export` MCP tool available.

### Key Tasks

**Browser**

- Implement a Theia extension for the browser panel and tab bar.  
- Use Electron `BrowserView` or webview to render pages; connect to Theia layout.  
- Implement profile handling using Electron sessions (`session.fromPartition`).  
- Wire in a basic DevTools toggle per tab (e.g. via palette command).  
- Create a SQLite DB schema for browser history, bookmarks and downloads.  
- Implement UI for history and bookmarks (view, search, add/remove).  
- Implement a minimal downloads manager (list, open, show in folder).

**Canvas**

- Implement a React-based infinite canvas with pan/zoom interactions.  
- Add basic node/shape types (boxes, text nodes, connectors, groups).  
- Integrate a CRDT layer (Yjs) for safe concurrent editing/local merges.  
- Design and implement the design token schema and storage.  
- Apply tokens for basic styling of nodes and edges (colours, fonts).  
- Implement export to JSON and PNG/SVG.  
- Expose `canvas.export` as an MCP tool (plus any minimal supporting endpoints).

---

## Phase 3 – Visual Flows & MCP Tool Bus

### Objectives

- Let users build and run simple automations via a node-based flow editor.  
- Provide a robust, minimal MCP tool set covering file, git, shell, HTTP, browser, notes, graph and canvas.

### Milestones

- `M3.1` – Visual flow editor is working with node creation, connections and saving flows as JSON/YAML.  
- `M3.2` – Flows can execute locally and stream logs/results to a run panel.  
- `M3.3` – Minimal MCP tool set is implemented and tested for correctness and safety.  
- `M3.4` – Basic pre-built flows available (templates like “scrape + summarise + save note”).

### Key Tasks

**Visual flows**

- Implement a Theia extension using React Flow (or similar) for the flows UI.  
- Define flow JSON/YAML schema (nodes, edges, metadata, triggers).  
- Save flows into a workspace folder under version control.  
- Implement a flows run panel showing logs, step results and errors.  
- Add palette commands to open a flow, run a flow, and view recent runs.

**MCP tool bus**

- Implement a local MCP server inside the app or sidecar process.  
- Define tools for:
  - `fs.read`, `fs.write`, limited path scopes.  
  - `git.status`, `git.commit`, `git.create_branch`, `git.create_pr*` (as far as needed).  
  - `shell.run` (bounded, with explicit scopes and user approval).  
  - `http.request` (domain-scoped).  
  - `browser.*` (open, click, fill, wait_for, scrape).  
  - `notes.*` (read/write).  
  - `graph.query`.  
  - `canvas.export`.  
- Implement capability checking for each call based on tool scopes.  
- Integrate audit logging for all MCP calls.

**Starter flows**

- Create a small library of built-in flows:
  - “Scrape current page → summarise via agent → save note”.  
  - “Run tests → summarise failures → open related files”.  
  - “Search notes for topic → show top matches”.

---

## Phase 4 – Agents, Security Hardening & Performance

### Objectives

- Introduce an agent orchestrator that can use the MCP tool set safely.  
- Enforce the capability model end-to-end (agents, flows, palette, tools).  
- Ensure the whole app stays within performance budgets on mainstream Linux/Windows/macOS laptops.

### Milestones

- `M4.1` – Agent orchestrator is wired up and can call MCP tools with diffs and approvals.  
- `M4.2` – Capability-based permissions and prompts are enforced for all high-risk actions.  
- `M4.3` – Audit log viewer UI exists for reviewing past tool calls and agent actions.  
- `M4.4` – Basic resource monitoring implemented; app stays within agreed memory/CPU envelopes under typical usage.

### Key Tasks

**Agent orchestrator**

- Implement a service to manage agent sessions, contexts and tool calls.  
- Implement diff generation for any file-write operations and present them in the UI.  
- Add UI for accepting/rejecting agent-proposed changes.  
- Define a small set of curated agent entrypoints (e.g. “Explain file”, “Refactor selection”, “Generate tests”, “Research this page”, “Summarise notes”).

**Permissions & security**

- Ensure all MCP tools check capabilities before executing.  
- Wire capability descriptors into:
  - MCP tool declarations.  
  - Flow definitions (required scopes annotated).  
  - Palette command manifests.  
- Implement per-scope prompts and confirmation flows (e.g. first time a scope is used, or for particularly sensitive scopes).  
- Double-check Electron configuration (no `remote`, safe preload, limited contextBridge surface).  
- Implement basic source code security checks into CI (dependency scanning, etc., as feasible).

**Audit and observability**

- Implement a SQLite-backed audit log for:
  - MCP tool calls.  
  - Flow executions.  
  - High-impact palette commands.  
- Build an audit viewer UI, with filters and search.  
- Add lightweight resource metrics (memory usage, agent count, tab count) and warnings when budgets are exceeded.

**Performance tuning**

- Identify and lazy-load heavy modules (browser, flows, agents, etc.).  
- Profile startup and reduce cold-start where reasonable.  
- Cap concurrent agents and tabs; surface warnings or soft limits in the UI.  

---

## Phase 5 – Polish, Dogfooding & Alpha Release

### Objectives

- Make the v1 experience coherent, stable and understandable.  
- Use the tool personally (dogfooding) to uncover rough edges.  
- Prepare installers, docs and a minimal onboarding experience for alpha testers.

### Milestones

- `M5.1` – Daily-driver stability across normal dev and research usage.  
- `M5.2` – Onboarding flow and basic tutorials/checklist.  
- `M5.3` – Cross-platform install artifacts (Linux, Windows, macOS) ready for external install.
- `M5.4` – Initial set of known issues and future roadmap documented.

### Key Tasks

- Refine layout, theming and defaults for an ADHD-friendly “vibe coding” experience.  
- Add a minimal first-run/onboarding sequence:
  - Welcome  
  - Key concepts (palette, knowledge, browser, flows, agents)  
  - Short in-app checklist with links to actions.  
- Document:
  - Installation and update process.  
  - Security model and permission prompts.  
  - How to use agents, flows, knowledge, browser and canvas together.  
- Run extended personal dogfooding and maintain an issues list.  
- Decide on small set of alpha testers (if any) and prepare guidelines.

---

## Using this plan

- Treat this plan as the **default roadmap**.  
- Adjust phase order or task priority only when there is a strong reason (e.g. a dependency or a discovered constraint).  
- Break each bullet task into 30–60 minute units before handing them to coding agents or adding to your task manager, keeping links back to this file and to `DECISIONS.md` as context.
