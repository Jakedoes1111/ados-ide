# aDOs v1 – DECISIONS

This document captures the key product and technical decisions for aDOs v1.  
If any other doc conflicts with this one, this file wins until explicitly updated.

---

## 1. Product & Scope

**D-001 – Product identity**  
aDOs v1 is a local, AI-augmented IDE / mini-OS built as a desktop app (Electron + Theia), not a cloud SaaS or generic note app.

**D-002 – Offline-first**  
All core functionality (editing, search, canvas, flows, agents, browser automation) must work locally without requiring any cloud service. Network is optional, not required.

**D-003 – Target user & device (v1)**  
Primary target is a single local user on Linux, Windows, or macOS desktop/laptop hardware. Performance budgets and UX are tuned for mainstream developer machines (integrated graphics, typically 8–16 GB RAM), with Linux as the current dogfooding baseline.

**D-004 – Thin v1 slice**  
v1 ships a coherent but minimal slice: Theia-based IDE shell, command palette, knowledge layer, embedded browser, simple visual flows, basic canvas, a single agent orchestrator with a curated tool set, and a hardened security envelope.

**D-005 – Future platforms**  
Linux, Windows, and macOS desktop builds are in scope for v1. Web builds remain explicitly out of scope for v1; design should keep web possible without making it a blocking constraint now.

---

## 2. Platform & Packaging

**D-010 – Theia-based foundation**  
The desktop app is based on a fork of Theia Blueprint / Theia IDE, with unnecessary extensions removed, and custom extensions added for palette, flows, browser, canvas, agents and knowledge layer.

**D-011 – Electron packaging stack**  
Electron is used as the runtime shell. electron-builder is the primary packaging tool for producing platform-native artifacts for Linux, Windows (NSIS), and macOS (DMG/ZIP), with signing/notarization configured per platform requirements.

**D-012 – Manual updates only in v1**  
Auto-update mechanisms (electron-updater, channels, staged rollouts) are available in the stack but disabled for v1. Updates are performed by downloading and installing new versions manually.

**D-013 – Licensing policy**  
Dependencies must be permissive OSS (MIT/BSD/Apache) where possible. Copyleft (AGPL/SSPL) is avoided; if unavoidable in the future, it must be explicitly reviewed and sandboxed.

**D-014 – Dependency Bill of Materials (BOM)**  
A dependency and license BOM is maintained and versioned with the codebase as part of the build pipeline.

---

## 3. Core Architecture

**D-020 – Modular Theia extensions**  
Palette, canvas, visual flows, browser integration, agents, and knowledge layer are implemented primarily as Theia extensions, backed by Electron main-process services where needed.

**D-021 – SQLite + Markdown spine**  
System state is built around:
- SQLite databases for structured data (history, bookmarks, downloads, flows metadata, audit logs, indexes, vectors).
- Markdown files for human-authored content (notes, docs, ADRs).

**D-022 – Capability-based model everywhere**  
Access to files, shell, network, browser, flows, notes, graph, canvas and secrets is mediated by a capability-based model shared by tools, flows, agents and high-impact palette commands.

**D-023 – Palette-first UX**  
If functionality can be invoked, there must be a palette command and (where sensible) a keybinding for it. The palette is the primary “front door” into the system.

---

## 4. Canvas Engine & Design Tokens

**D-030 – React + Yjs canvas**  
The canvas is implemented as a React-based infinite canvas using a CRDT library (Yjs) for concurrency/conflict handling, even if v1 ships only single-user.

**D-031 – Canvas serialisation**  
Canvas state is stored as JSON (nodes, edges, groups, tokens) under the workspace, and is versioned via Git.

**D-032 – Design tokens as first-class**  
A shared design token schema (colours, typography, spacing, etc.) is used across the UI, canvas styling and AI-generated snippets. Tokens are editable via a dedicated UI and/or canvas integration.

**D-033 – Canvas MCP tools**  
At minimum, `canvas.export` (and optionally `canvas.list`/`canvas.get`) are exposed as MCP tools so agents and flows can read canvas state.

---

## 5. Visual Flows

**D-040 – React Flow-style editor**  
The visual flow editor is implemented using a React Flow-style node editor within Theia.

**D-041 – Flow definition format**  
Flows are saved as JSON or YAML files in the workspace and versioned via Git.

**D-042 – MCP-only flow steps (v1)**  
Flow nodes are limited to:
- MCP tools (fs, git, shell, http, browser, notes, graph, canvas, etc.).
- Agent “step” nodes that delegate to the agent orchestrator.
Arbitrary script execution is out of scope for v1.

**D-043 – Local execution only (v1)**  
Flow execution is local and sandboxed. No schedulers, webhooks or remote execution in v1.

---

## 6. Browser & CDP

**D-050 – Embedded browser in Electron**  
The embedded browser is implemented via Electron (e.g. BrowserView / webview) inside the Theia shell, with a tabbed UI.

**D-051 – Profile isolation**  
Browser profiles are isolated using Electron sessions (`session.fromPartition`-style), allowing per-workspace or per-profile containers.

**D-052 – Automation layer**  
Playwright is the primary automation library, with CDP integration available as a fallback for low-level use cases. The architecture allows swapping the underlying automation engine.

**D-053 – Browser persistence in SQLite**  
History, bookmarks and downloads are stored in SQLite (e.g. via better-sqlite3). This DB is part of the workspace-level data.

**D-054 – Browser MCP tools**  
Browser automation is exposed via MCP tools (`browser.open`, `browser.click`, `browser.fill`, `browser.wait_for`, `browser.scrape`, etc.) for use by flows and agents.

---

## 7. Agents & MCP Tool Bus

**D-060 – MCP-based tools**  
All tools exposed to agents use the Model Context Protocol (MCP). No ad-hoc RPC for tools in v1.

**D-061 – Minimal core tool set**  
A curated core tool set (fs, git, shell, http, browser, notes, graph, canvas, etc.) is provided out-of-the-box and is enough to cover core workflows (coding, research, summarisation, note-writing, light automation).

**D-062 – Scoped capabilities per tool**  
Each tool invocation is checked against a scoped capability set (e.g. `fs:read:/project/src`, `fs:write:/project/tests`, `net:domain:example.com`). Tools cannot operate outside their granted scopes.

**D-063 – Human-in-the-loop edits**  
Any tool that writes files must support a dry-run + diff path, presented to the user for approval before applying changes.

**D-064 – Audit of tool calls**  
All MCP tool calls (including arguments, timestamps, scopes, and outcomes) are recorded in an audit log stored in SQLite.

---

## 8. Knowledge Layer

**D-070 – Markdown vault**  
Notes, journals, research summaries, ADRs and design docs are stored as Markdown files in a “vault” within the workspace or user data directory.

**D-071 – FTS5 search**  
SQLite FTS5 is used for full-text search over the note corpus and key documents. A dedicated “big search” UI is provided distinct from the small, palette-limited search.

**D-072 – Link graph**  
Backlinks and graph queries over the vault are supported via a simple graph/index stored in SQLite, with an MCP `graph.query` tool exposed to agents.

**D-073 – Retrieval for agents**  
The knowledge layer is the primary source for retrieval-augmented agent behaviour. Agents read from this layer rather than scraping random files ad hoc.

---

## 9. Command Palette & Shortcuts

**D-080 – Command & keybinding registries as source of truth**  
Theia’s `CommandRegistry` and `KeybindingRegistry` are the canonical stores for commands and shortcuts. No parallel systems.

**D-081 – Palette search with Fuse.js**  
The palette uses Fuse.js for fuzzy search over small, well-bounded datasets (commands, recent files, etc.), not as the global knowledge search.

**D-082 – Global summon hotkey**  
A global hotkey is registered via Electron `globalShortcut` to summon the palette from anywhere when the app is focused.

**D-083 – Permission-aware commands**  
Commands declare capabilities. High-risk commands (e.g. shell, destructive operations, system-level actions) require confirmation and are logged via the audit system.

**D-084 – Keybinding editor (v1)**  
v1 ships with a basic keybinding editor supporting search, conflict detection and import/export of keybinding presets.

---

## 10. Security, Permissions & Performance

**D-090 – Electron hardening**  
Renderers are configured with `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`. The `remote` module is not used. Access to privileged APIs is via well-defined preload/contextBridge layers only.

**D-091 – Navigation & content restrictions**  
Navigation is restricted to trusted origins where appropriate. Untrusted `window.open` calls are blocked or routed through safe handlers.

**D-092 – Secrets vault**  
Secrets (tokens, API keys, credentials) are stored in an encrypted vault (AES-256-GCM) with keys managed via the OS keychain (e.g. DPAPI/keytar). An optional master passphrase can wrap/unlock the vault.

**D-093 – Audit log as append-only**  
Audit logs of privileged actions are append-only and (where feasible) hash-chained to make tampering detectable.

**D-094 – Performance budgets enforced**  
Practical caps are enforced on:
- Number of concurrent agents.
- Number of heavy browser tabs/flows.
- Automatic loading of heavy modules (lazy loading by default).
Resource usage beyond budget should degrade gracefully and be visible to the user.

**D-095 – No auto-update, marketplace, or telemetry in v1**  
To reduce attack surface and complexity, v1 does not include auto-update, an extension marketplace, or outbound telemetry/analytics. Any future change to this requires explicit decisions and designs.

---

## 11. Change process

**D-100 – Decision updates via ADRs**  
Any change to these decisions should be captured as an ADR-style entry (amend, supersede, or deprecate). This file is meant to be updated over time, not frozen forever.
