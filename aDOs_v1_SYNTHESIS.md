# aDOs v1 – Cross-Track Synthesis (Tracks 01–08)

**Tracks covered**

1. App Packaging & Distribution (01)  
2. Canvas Engine & Design Tokens (02)  
3. Visual Flows (03)  
4. Browser + CDP (04)  
5. Agents & MCP Tool Bus (05)  
6. Knowledge Layer (06)  
7. Command Palette & Shortcuts (07)  
8. Security, Permissions & Performance (08)  

---

## 1. Purpose of this document

This document is the **single cross-track view** of aDOs v1.  

- It **integrates** the eight deep-research tracks into one coherent architecture.  
- It **locks in** global goals, constraints and “must-keep” decisions.  
- It defines a **thin v1 slice** that can be turned into a concrete `BUILD_PLAN.md` and `DECISIONS.md` next.

Use this as the lens when you or your agents are planning any work on aDOs. If something conflicts with this doc, this doc wins until explicitly updated.

---

## 2. Global goals & constraints

### 2.1 Product goals (what aDOs is)

aDOs v1 is:

- A **local cognitive IDE / mini-OS**: an Electron + Theia desktop app that feels like Marvin + Cursor + Notion + Obsidian + Raycast + Figma + n8n in one environment.  
- **Offline-first and privacy-first**: everything runs locally by default; no cloud requirement in v1.  
- An **agent-augmented workspace**: agents can read/write files, browse, edit notes, interact with flows and canvases – but always under explicit permissions and human oversight.  
- A **unified control surface**: the Command Palette is the primary “front door” into commands, files, flows, browser actions and agent tools.  

### 2.2 Hardware & platform constraints

- Target device: **8 GB RAM Windows 11 laptop with integrated GPU**.  
- Platform: **Electron + Theia** desktop app, **Windows-first** in v1. macOS and web are future targets, not in scope for the first release.  
- Performance budgets (v1):  
  - Idle: ~250–300 MB, ~0–2 % CPU.  
  - Typical dev: 0.5–0.8 GB.  
  - Heavy (tabs + 1–2 agents): cap ~1–1.5 GB, UI remains responsive.  

### 2.3 Security & trust stance

- Treat aDOs as a **local mini-OS**:  
  - Sandbox all renderers, **no Node in any web content**, locked-down IPC/navigation.  
- **Capability-based permissions** for tools, flows, agents and browser actions, with explicit user consent and full audit trail.  
- **Secrets in an encrypted vault**, keys via OS keychain (DPAPI/keytar), optional master passphrase.  
- **No auto-update, no extension marketplace, no telemetry** in v1. Packaging research gives us auto-update & telemetry options but they are disabled for the first release.  

---

## 3. High-level architecture

### 3.1 Platform baseline

- Base on **Theia Blueprint / Theia IDE** to reuse their Electron packaging, branding, installer and update scaffolding.  
- Package via **electron-builder** (NSIS on Windows) with code-signed installers.  
- Use Theia’s extension model for modular features: canvas, visual flows, browser, command palette, agents, knowledge layer are primarily Theia extensions + Electron main-process wiring.

### 3.2 Core subsystems

At a high level:

- **Command Palette** – Raycast-class “front door” to commands, recent files and small metadata.  
- **Canvas Engine** – Figma-style infinite canvas for diagrams, ideation and visual structures, backed by Yjs/CRDT and design tokens.  
- **Visual Flows** – n8n-style node editor to build and run automations (local, tool-based, agent-aware).  
- **Browser + CDP** – Embedded, tabbed browser and automation layer using Electron + Playwright/CDP, with history/bookmarks/downloads in SQLite.  
- **Agents & MCP Tool Bus** – MCP-based orchestrator with a curated tool set (fs, git, shell, http, browser, notes, graph, canvas).  
- **Knowledge Layer** – Local Markdown vault + SQLite FTS5 (+ optional vectors) as the unified knowledge and search layer.  
- **Security/Permissions** – Capability manifests, user consent flows, encrypted secrets vault, performance limits.  
- **Packaging & Distribution** – Electron desktop builds, code signing, manual update pipeline, future-ready auto-update path (disabled for now).  

### 3.3 Architecture sketch (conceptual)

```mermaid
graph TD
  subgraph Desktop App
    E[Electron main process]
    T[Theia frontend]
  end

  E --> T

  subgraph Core Services
    CP[Command Palette]
    Canvas[Canvas Engine]
    Flows[Visual Flows]
    Browser[Embedded Browser + CDP]
    Agents[MCP Orchestrator]
    Know[Knowledge Layer (SQLite + vectors)]
    Vault[Secrets Vault]
    Audit[Audit Log (SQLite)]
  end

  T --> CP
  T --> Canvas
  T --> Flows
  T --> Browser
  T --> Know

  CP --> Flows
  CP --> Agents

  Flows --> Agents
  Flows --> Browser
  Flows --> Know

  Agents --> Browser
  Agents --> Know
  Agents --> Vault
  Agents --> Audit

  Vault --> Agents
  Vault --> Browser

  Agents -->|"MCP tools"| FS[FS/Git/Shell/HTTP/Notes/Graph/Canvas]
```

Key patterns:

- **Interaction path:** User → Command Palette / context menu → Flow or Agent → MCP tools → Files/Browser/Notes/Canvas.  
- **Data path:** Everything important lands in **SQLite + Markdown** (notes, history/bookmarks, audit, flows metadata).  

---

## 4. Track-level integration

### 4.1 Track 01 – App Packaging & Distribution

**Role**

- Deliver aDOs as a **signed Electron desktop app** (Windows first), with a clean path to macOS and web later.  

**Locked decisions for v1**

- Base on **Theia Blueprint / Theia IDE** fork, stripped of unnecessary extensions.  
- Use **electron-builder** for Windows packaging (.exe via NSIS) with a CI pipeline that builds signed installers.  
- Ship **manual updates only** in v1 (no auto-update), even though Blueprint/electron-updater scaffolding is available. Security track overrides here.  
- Maintain a **dependency + license BOM** to keep legal and supply-chain risks visible.  

**Deferred / open**

- Auto-update channels (alpha/beta/stable) and staged rollouts.  
- Web deployment and Docker images for remote/hosted use.

---

### 4.2 Track 02 – Canvas Engine & Design Tokens

**Role**

- Provide a **Figma-style, infinite canvas** inside the IDE for diagrams, architectures, mind-maps and visual workspaces.  
- Make **design tokens** a first-class concept in the system (colours, typography, spacing) and let canvases reflect and edit them.

**Locked decisions for v1**

- **Tech stack:**  
  - React-based canvas UI.  
  - CRDT / collaboration via **Yjs**, even if v1 ships single-user – we still want conflict-free offline merges and future-proofing.  
  - Canvas data serialised as JSON (nodes, edges, groups, tokens).  
- Tokens as a shared layer: same token definitions used across canvas, UI themes and snippet generation.  
- Export/import APIs (`canvas.export` etc.) exposed as MCP tools for agents and flows.  

**Deferred / open**

- Real-time multi-user collaboration.  
- Advanced layout/auto-routing, heavy image embedding, etc.

---

### 4.3 Track 03 – Visual Flows

**Role**

- A **node-based automation canvas** (similar to n8n) for wiring: FS/Git/HTTP/Browser/Agents/Notes/Canvas into reusable flows.  

**Locked decisions for v1**

- **React Flow-style editor** embedded in Theia for visual flows.  
- Flows stored as JSON/YAML in the workspace, versioned with Git.  
- Flows call **MCP tools** and can trigger **agents as nodes** (“agent step” nodes), not arbitrary script execution.  
- Execution is **local and sandboxed**, respecting the same capability model as other tools.  

**Deferred / open**

- Cloud/webhook triggers, scheduled jobs, shared templates library.  
- Deep integration with external n8n instances (bridge is optional and off by default).

---

### 4.4 Track 04 – Browser + CDP

**Role**

- Provide an **embedded, tabbed browser** inside aDOs for research, web apps and automation, controlled by flows and agents.  

**Locked decisions for v1**

- Single Electron `BrowserWindow` hosting Theia; multiple **tabs** via `BrowserView` / `<webview>`.  
- **Profile isolation** via `session.fromPartition('profile:<id>')`.  
- **Automation layer**:  
  - Playwright-first for navigation, clicks, typing, scraping.  
  - CDP attach as fallback for low-level control.  
- **State in SQLite** using `better-sqlite3` for history, bookmarks and downloads.  
- Browser actions surfaced as:  
  - Command palette commands (open URL, recent pages, toggle DevTools, add bookmark, etc.).  
  - MCP tools for agents/flows (`browser.open/click/fill/wait_for/scrape`).  

**Deferred / open**

- Final choice of primary automation stack (Playwright vs pure CDP) – design so it can swap out.  
- Extent of DevTools integration (full vs summary panels).  
- DRM/Widevine-enabled builds (if ever needed).

---

### 4.5 Track 05 – Agents & MCP Tool Bus

**Role**

- aDOs’ **AI nervous system**: orchestrates LLM agents, exposes tools via MCP, and enforces permissions and safety.  

**Locked decisions for v1**

- Use **MCP** as the protocol for tools.  
- Define a **minimal but powerful core tool set** (~12 tools) across:  
  - File & Git (`fs.read`, `fs.write`, `git.commit`, `git.create_pr*`).  
  - Shell & HTTP (`shell.run`, `http.request`).  
  - Browser (`browser.open/click/fill/wait_for/scrape`).  
  - Notes & Graph (`notes.read/write`, `graph.query`).  
  - Canvas (`canvas.export`).  
- Every tool has **scopes** (e.g. `fs:read:/project/src`, `net:domain:api.example.com`) and calls are checked against scopes + user approvals.  
- **Human-in-the-loop by default**:  
  - Dry-run + diff for any file-write.  
  - Explicit prompts for sensitive scopes (shell, unknown domains, etc.).  
- Full **audit logging** of tool calls and decisions, stored in SQLite.  

**Deferred / open**

- Multi-agent orchestration patterns.  
- Remote agents (server-side) vs purely local.  
- Sharing tool configurations across workspaces.

---

### 4.6 Track 06 – Knowledge Layer

**Role**

- The **single source of truth** for notes, docs, traces, bookmarks, and embeddings. It underpins search, memory and “knowledge-aware” agents.  

**Locked decisions for v1**

- **Markdown + SQLite** at the core:  
  - Notes stored as Markdown files with front-matter/metadata.  
  - SQLite (FTS5) for full-text search; optional `sqlite-vss` for vectors.  
- Knowledge layer powers:  
  - Global search UIs.  
  - Agent “retrieval” for context.  
  - Link graph / backlinks (`graph.query`).  
- Separate “big search” UI vs small-data command palette search (commands & recents only).  

**Deferred / open**

- Cross-device sync and cloud backup.  
- Advanced semantic clustering, topic maps, long-term agent memory.

---

### 4.7 Track 07 – Command Palette & Shortcuts

**Role**

- The **unified keyboard-first control surface** for aDOs: launch commands, open files, trigger flows, manage shortcuts.  

**Locked decisions for v1**

- Use Theia’s `CommandRegistry` and `KeybindingRegistry` as the **single source of truth** for commands + shortcuts.  
- Palette as a React-based UI, with **Fuse.js** fuzzy search over **small, bounded datasets**:  
  - Commands.  
  - Recent files.  
  - Small providers later (flows, notes metadata, etc.).  
- **Global summon hotkey** registered via Electron `globalShortcut`, plus context-aware in-app keybindings.  
- **Permissions + audit integrated**:  
  - Command manifest schema with capabilities.  
  - Confirmations for high-risk commands.  
  - Audit log entries for executed commands.  
- Ship with **keybinding editor** (search, conflict detection, import/export, presets).  

**Deferred / open**

- Macro recording / multi-step workflows via the palette.  
- AI-driven palette flows (e.g. “Do X” → agent decides steps).  

---

### 4.8 Track 08 – Security, Permissions & Performance

**Role**

- Define the **security envelope and performance budgets** for everything else.  

**Locked decisions for v1**

- **Electron & Theia hardening:**  
  - `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` everywhere.  
  - No `remote` module; tightly controlled `contextBridge` APIs.  
  - Strict navigation control; block untrusted `window.open`.  
- **Capability-based permission model** for tools, flows, browser, agents.  
- **Secrets vault** with AES-256-GCM, keys via OS keychain (keytar/DPAPI), optional master passphrase.  
- **Audit logging** for all privileged actions, append-only / hash-chained.  
- **Performance budgets** as in §2.2, enforced via:  
  - Lazy-loading heavy modules (browser, flows, agents).  
  - Limiting concurrent agents and tabs.  
  - Monitoring and capping memory usage.  
- **No auto-update, no marketplace, no telemetry** in v1.  

**Deferred / open**

- Auto-update + signed channel design.  
- Safe marketplace / extension story.  
- Optional telemetry for **local** performance diagnostics (no outbound analytics).

---

## 5. Cross-cutting principles that now apply everywhere

1. **SQLite + Markdown as the spine**  
   - Browser history/bookmarks, audit logs, flows metadata, notes index and knowledge graphs all live in SQLite DBs.  
   - Human-authored content (notes, ADRs, docs) live as Markdown files.  

2. **Capability-gated everything**  
   - Tools, flows, agents and high-impact palette commands all declare capabilities and scopes.  
   - No scope ⇒ no permission ⇒ call blocked.  

3. **Palette-first UX**  
   - If a feature can be invoked, there should be a palette command and a keybinding for it.  

4. **Local-first, offline-first, minimal attack surface**  
   - No auto-update, no marketplace, no telemetry, no web-required flows in v1.  

5. **Agents are powerful but never unsupervised**  
   - Human-in-the-loop, diffs for edits, scoped secrets, cancel at any time, full audit.  

---

## 6. Thin v1 slice – what v1 actually ships

This section picks the **minimum coherent feature set** from each track that, together, forms a compelling v1.

### 6.1 v1 user-visible capabilities

At a high level, v1 should enable:

- Work in a **Theia-based IDE** with files, terminals, and basic project workflows.  
- Use a **Raycast-style palette** to launch commands, open recent files and manage keybindings.  
- Open a **browser tab inside the IDE**, with login-persisting profiles, bookmarks, history and downloads.  
- Build **simple automations** via Visual Flows (e.g. “scrape page → summarise → save note”).  
- Ask an **agent** to do coding / research tasks with clear diffs and approvals.  
- Capture knowledge as **Markdown notes**, searchable via full-text search and link graph, and re-used by agents.  
- Use a **canvas** for diagrams and planning, with token-aware styling and export.  
- Trust that the app is **locked-down** and behaves within resource budgets on an 8 GB laptop.  

### 6.2 v1: per-track commitments

**Track 01 – Packaging**

- Windows-only installer (signed) via electron-builder + Theia Blueprint fork.  
- Manual update workflow documented (user downloads new installer).  

**Track 02 – Canvas**

- Single-user canvas with: pan/zoom, basic shapes/nodes, connectors, groups, simple token-based styling.  
- Export to JSON and PNG/SVG; MCP `canvas.export` tool implemented.  

**Track 03 – Visual Flows**

- Flow editor with:  
  - Trigger nodes (manual / palette command).  
  - A handful of action nodes: `http.request`, `fs.read/write`, `browser.*`, `notes.write`, `agent.step`.  
- Run flows locally; view logs/result; no schedulers or webhooks yet.  

**Track 04 – Browser**

- Tab UI with add/close/switch; per-profile sessions.  
- Basic DevTools toggle per tab.  
- History + bookmark + download manager backed by SQLite.  

**Track 05 – Agents & Tools**

- Single orchestrator with the minimal tool set from the research doc.  
- Consent flows + diffs for writes; audit log viewer.  
- A small set of curated “starter tasks” (explain file, refactor selection, scrape + summarise, generate note).  

**Track 06 – Knowledge Layer**

- Markdown vault, FTS5 search UI, simple backlinks/graph view.  
- MCP tools `notes.read/write` and `graph.query`.  

**Track 07 – Command Palette**

- Palette UI with command + recent file providers.  
- Fuse.js search; favourites/history; conflict-aware keybinding editor.  

**Track 08 – Security & Perf**

- Hardening settings enforced in Electron.  
- Capability model wired into tools, agents, flows and palette.  
- Basic resource monitoring; hard caps on concurrent agents/tabs.

---

## 7. From here to BUILD_PLAN.md and DECISIONS.md

With this synthesis in place, the **next concrete step** is:

1. **Extract global decisions → `DECISIONS.md`**
   - System-level ADRs (e.g. “We will use Theia Blueprint as the base”).  
   - Per-track decisions that are now considered “locked for v1”.  

2. **Turn §6 (thin v1 slice) into a phase-based `BUILD_PLAN.md`**
   - Phase 0: Fork Theia Blueprint, harden Electron, get a minimal app building/running.  
   - Phase 1: Command Palette + Knowledge Layer + packaging pipeline.  
   - Phase 2: Browser + Canvas.  
   - Phase 3: Visual Flows + core MCP tools.  
   - Phase 4: Agents orchestration + security hardening + performance tuning.  

3. **Explode each phase into 30–60-minute tasks** that you and your coding agents can pick up without reopening all of the research.
