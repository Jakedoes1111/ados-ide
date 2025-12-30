# aDOs Deep Research Summary – Command Palette & Shortcuts (Track 07)

## 1. TL;DR (non-technical)

- Build a “Raycast-class” command palette directly into the aDOs IDE using Eclipse Theia’s command and keybinding services, wrapped in a custom, fast palette UI.
- Use a lightweight fuzzy-search library (Fuse.js) over “small data” (commands, recent files, key palette entities) to keep results under ~50 ms even on an 8 GB Windows laptop.
- Register a single global hotkey via Electron to summon the palette from anywhere; handle all in-app shortcuts via Theia’s KeybindingRegistry with conflict detection and profiles.
- Keep the MVP focused: instant search + execute, favourites, history, and keybinding editor; defer macro recording, AI workflows, and cloud integrations to later phases.
- Enforce safety via a command-permissions manifest, confirmations for risky actions, and an audit log for all executed commands.

## 2. Product goals & non-goals

### Goals

- **Unified control surface:** Provide one place to launch commands, open files, and trigger IDE actions (similar to Raycast/PowerToys/VS Code palette) without touching the mouse.
- **Fast & forgiving:** Sub‑100 ms perceived latency on typical projects, fuzzy matching tolerant of typos and partial names.
- **Context-aware:** Surface the right actions depending on focus (e.g. browser refresh in webview vs code action in editor).
- **Discoverable keyboard UX:** Make all shortcuts visible, searchable, and editable via a keybinding editor with conflict highlighting.
- **Offline-first, local-only:** All data and commands resolve locally; no dependency on external services in MVP.

### Non-goals (MVP)

- **No macro recording / multi-step scripted workflows** (design hooks for this later).
- **No AI-agent flows** wired into the palette yet (but UI should support multi-step interactions later).
- **No third-party cloud integrations** (Notion, external n8n, etc.).
- **No full-text content search** in the palette; large-scale search remains in a dedicated FTS view (SQLite FTS/FTS5).

## 3. Recommended architecture & stack

- **Core framework:** Eclipse Theia’s `CommandRegistry` and `KeybindingRegistry` as the backbone for all in-IDE commands and shortcuts.
- **Palette frontend:** Custom React-based palette UI rendered inside the Electron/Theia shell.
- **Search layer:** In-memory index per provider using **Fuse.js** for fuzzy matching across:
  - Commands (names, categories, descriptions)
  - Recently opened files
  - Optional “small data” providers (workspaces, flows, notes metadata)
- **Global activation:**
  - **Electron `globalShortcut`** for a system-wide hotkey (e.g. `Ctrl+K` variant) to open the palette window.
  - In-app shortcuts managed by Theia’s keybinding service with “when” contexts to reuse key combos safely.
- **Command permissions & audit:**
  - Command manifest schema with required capabilities (e.g. `fs:write`, `net:domain:*`, `browser:control`).
  - Palette enforces confirmations for high-risk commands and logs all executions to an append-only audit log.
- **Data boundaries:**
  - Palette search stays over small, pre-filtered datasets.
  - Heavy full-text or semantic search routed to a separate Search UI backed by SQLite FTS/vectors.

## 4. Key design decisions

| Area                      | Decision                                                                                   | Rationale                                                                                      | Implications                                                                                     |
|---------------------------|--------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Command system            | Use Theia’s `CommandRegistry` as the single source of truth                               | Reuses battle-tested infra; consistent with rest of IDE                                       | All palette commands must register via Theia; no ad-hoc command execution paths                  |
| Shortcuts                 | Use Theia’s `KeybindingRegistry` + Electron `globalShortcut`                              | Built-in conflict handling and context-aware bindings; global summon key from OS              | Clear layering: OS-level summon vs in-app keymaps                                                |
| Fuzzy search              | Fuse.js over in-memory collections                                                        | Light, permissive license; great for “small data” fuzzy search; zero server overhead          | Must cap dataset size; offload massive searches to FTS                                           |
| Palette scope             | Mix commands + recent files (+ later: notes, flows)                                       | Mirrored on Raycast/PowerToys UX; best ROI for daily usage                                    | Avoids palette becoming a general search UI; keeps performance predictable                       |
| Permissions & safety      | Manifest-declared capabilities + confirmation prompts + audit log                         | Prevents “surprise” destructive actions; supports future agents/macros                        | Slight friction for powerful commands; needs clear, human-readable prompts                       |
| Keymap management         | Dedicated keybinding editor with conflict detection, export/import, and presets           | Users can converge on preferred layouts (VS Code/Vim/etc.)                                    | Needs schema for keymap JSON; migration story when commands change                               |
| Platform focus            | Windows 11 desktop-first, offline                                                         | Aligns with aDOs device constraints and use cases                                             | Mac/web support can follow later without changing core design                                    |

## 5. Risks & mitigations

1. **Performance lag on large workspaces**
   - *Risk:* Thousands of commands/files could slow fuzzy search and indexing.
   - *Mitigation:* Limit index size (e.g. cap recent files), use provider-level filters, tune Fuse.js, and lazy-load non-core providers. For heavy searches, redirect to FTS search pane.

2. **Memory growth from many providers**
   - *Risk:* Loading every provider at startup increases RAM usage.
   - *Mitigation:* Start with only Command + Files providers; lazy-init others upon first use or when user enables them in settings.

3. **Shortcut conflicts & OS-key collisions**
   - *Risk:* Inconsistent behaviour if keybindings collide with each other or OS-reserved keys.
   - *Mitigation:* Conflict detection in the keybinding editor, safe default mappings, and user-remappable global hotkey. Ship with a conservative default profile and presets.

4. **Security & accidental destructive actions**
   - *Risk:* Palette can trigger file deletes, external HTTP calls, or automation flows.
   - *Mitigation:* Permissioned command manifests, explicit confirmation dialogs for risky commands, dry-run previews, sandboxing of automation where possible, and append-only audit logs.

5. **Third-party library maintenance**
   - *Risk:* Fuse.js or Electron APIs change or stagnate.
   - *Mitigation:* Choose stable, widely used versions; encapsulate search behind a thin adapter so we can swap in alternatives (e.g. fuzzysort) with minimal impact; track upstream updates periodically.

## 6. Implementation sketch (MVP phases)

### Phase 1 – Foundations (Command model & search)

- Wire up a dedicated **Command Palette extension** in Theia (backend + frontend).
- Define a **command manifest schema** (id, title, category, capabilities, context guards).
- Implement basic **providers** for Commands and Recent Files.
- Integrate **Fuse.js**; build an in-memory index and an API: `query(term, context) -> ranked results`.
- Expose a simple palette UI shell: text input + list of results, keyboard navigation, “execute on Enter”.

### Phase 2 – Palette UX & keybinding editor

- Design and implement the **palette React UI** with:
  - Result grouping by provider (Commands, Files, etc.).
  - Badges for favourites, history indicators, and context labels.
  - Optional preview panel (file snippet, command description).
- Add **favourites/pins** and **history** with recency-boosted ranking.
- Implement **Keybinding editor**:
  - Table/list of commands and shortcuts.
  - Search by command name or key combo.
  - Real-time conflict detection and inline resolution.
  - Import/export of keymap JSON and predefined profiles (e.g. VS Code-like).

### Phase 3 – Safety, global hotkey, and hardening

- Implement **permission prompts** and **confirmation flows** for high-impact commands.
- Implement **audit logging** (append-only, timestamped entries with command id, origin, and status).
- Register **Electron `globalShortcut`** for palette summon and handle edge cases (e.g. shortcut unavailable).
- Add telemetry hooks *only for local debugging* (no outbound analytics) to measure latency and fix hot paths.
- Run performance tests on an 8 GB Windows 11 laptop; tune providers and search settings to meet targets.

## 7. Open questions for later synthesis

- Which **default keymap profile** should we ship with aDOs (VS Code-like, custom, or per-mode)?
- How aggressively should we **limit the palette index** (e.g. N most recent files, only open workspaces)?
- Do we want basic **multi-step interactions** in the palette for MVP (e.g. “Run Flow → choose flow → confirm”)?
- How will **agent-triggered commands** be surfaced and audited once AI workflows are introduced?
- Should keybindings be **workspace-local by default**, or global with optional workspace overrides?

