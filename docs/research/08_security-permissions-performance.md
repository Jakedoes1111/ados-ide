# aDOs Deep Research Summary – Security, Permissions & Performance (Track 08)

## 1. TL;DR (non‑technical)

- Treat the aDOs IDE as a **local “mini‑OS”** that must be secure by default: sandbox all renderers, block Node/Electron APIs from any web content, and lock down IPC and navigation.
- Implement a **capability‑based permission model** (files, network, clipboard, tools, agents) with explicit user consent, least privilege, and a full audit trail.
- Store all secrets in an **encrypted local vault**: AES‑256‑GCM at rest, keys managed via the OS keychain (DPAPI/keytar) with optional user master passphrase.
- Design for an **8 GB Windows 11 laptop**: enforce concrete memory/CPU budgets, limit concurrent agents/browsers, lazy‑load heavy modules, and aggressively suspend/tear down idle tabs.
- Ship with **no auto‑update, no third‑party extensions, no dynamic code loading, and no telemetry** in MVP to minimise attack surface.

---

## 2. Scope & goal

**Scope:**  
Security, permissions, data protection and performance for the aDOs IDE running as an Electron + Theia desktop app on Windows 11 (8 GB RAM, integrated GPU).

**Primary goals for aDOs v1:**

- Make the IDE **secure‑by‑default** against:
  - Malicious web pages in embedded browser tabs.
  - User‑supplied notes/files with HTML or scripts.
  - Buggy/malicious local automations and tools.
  - Prompt injection and over‑privileged AI agents.
  - Supply‑chain issues in Node/Electron/Theia deps.
- Provide a **clear, granular permissions model** users can understand and control.
- Protect **secrets and tokens** at rest and in use, without killing UX.
- Keep the app **fast and responsive** within explicit resource budgets on modest hardware.

Non‑goals for MVP:

- No auto‑update mechanism (manual updates only).
- No third‑party marketplace extensions (only first‑party modules).
- No cloud sync or telemetry back to servers.
- No camera/mic/geo/web‑auth style OS integrations.

---

## 3. Key recommendations (architecture & design)

### 3.1 Electron & Theia hardening

- **Renderer sandboxing:**
  - `contextIsolation: true` for all renderers.
  - `sandbox: true` for all BrowserWindows.
  - `nodeIntegration: false` everywhere (no Node in any renderer), including webviews.
  - `enableRemoteModule: false`; fully remove deprecated `remote` API.

- **Secure IPC:**
  - Use minimal preload scripts exposing whitelisted APIs via `contextBridge.exposeInMainWorld`.
  - Never expose `ipcRenderer` or Node primitives directly.
  - In `ipcMain` handlers, validate `event.senderFrame.url` to ensure requests only come from trusted UI origins (e.g. `ados://`), reject everything else.

- **Navigation & webview control:**
  - Use `will-navigate` / `setWindowOpenHandler` to block unexpected navigations and pop‑ups.
  - Deny all untrusted `window.open` calls from embedded pages.
  - Only use `<webview>`/BrowserView for external sites, never use them for core UI.

- **CSP & protocol safety:**
  - Enforce a strict **Content Security Policy (CSP)** on all app HTML (e.g. `default-src 'self'; script-src 'self';`).
  - Prefer a custom `ados://` protocol for app resources instead of `file://`, or tightly validate any `file://` usage.
  - For local content previews, inject CSP that blocks remote scripts and `javascript:` URLs.

- **Electron fuses & flags:**
  - Flip Electron fuses to disable `runAsNode`, `remoteModule`, and other unused features.
  - Ensure no `--remote-debugging-port` or `--inspect` in production.

- **Code signing & integrity:**
  - Code‑sign Windows binaries; no unsigned builds in the wild.
  - Avoid auto‑update in MVP; manual, signed installers only.

### 3.2 Capability‑based permission model

- Each tool, script or agent operates under a **capability manifest** declaring what it can do:
  - File system (with path scopes, e.g. workspace‑only).
  - Network (granular: `network:api.example.com`, not “internet”).
  - Clipboard (read/write separated).
  - Vault access (which secrets / scopes).
  - Browser control (navigation, form fill, click).
  - Any OS‑level action (subprocess, shell) – disabled in MVP.

- **User consent & elevation:**
  - Default = least privilege; many capabilities are **zero** by default.
  - Any action outside base scope triggers a **runtime prompt** describing:
    - The tool/agent name.
    - The action requested.
    - The target scope/path/host.
  - User options: “Allow once”, “Allow for this session”, “Always allow for this tool”, or “Deny”.

- **Audit logging:**
  - Log all privileged actions (who/what/when/where/result), but never log secret values.
  - Keep logs append‑only or hash‑chained for tamper evidence.
  - Provide an in‑app audit viewer and export capability.

### 3.3 Secrets, data & vault

- **Vault design:**
  - Plain Markdown notes + metadata in local workspace / app data folders.
  - All **secrets** (API keys, tokens, passwords) stored as AES‑256‑GCM encrypted blobs, separate from general notes.

- **Key management:**
  - Generate a random 256‑bit **Data Encryption Key (DEK)** for the vault.
  - Wrap the DEK via OS keychain using keytar (DPAPI on Windows, Keychain on macOS, etc.).
  - Optionally derive a **user master passphrase** key (PBKDF2/Argon2) to additionally encrypt the DEK or vault file.
  - Decrypt keys only when needed; minimise lifetime in memory and zeroise buffers where practical.

- **Usage patterns:**
  - Prefer operations where the **main process uses secrets on behalf of agents/tools**, rather than handing secrets to them.
  - Mask secrets in any UI; show at most last few characters for recognition.
  - Enforce TLS for any network calls using secrets; no plaintext protocols.

- **Backups & exports:**
  - Provide encrypted backup/export of secrets (password‑protected archive).
  - Make irreversibility clear: loss of master passphrase => loss of access to encrypted secrets.

### 3.4 Performance budgets & strategies

- **Baseline targets (8 GB Windows 11):**
  - Idle app (no projects open): ~250–300 MB RAM; ~0–2% CPU.
  - Typical dev session (few editors + one canvas + one browser tab): ~0.5–0.8 GB total.
  - Heavy scenario (multiple tabs + 1–2 agents): **cap at ~1–1.5 GB** and keep UI responsive.

- **Concurrency limits:**
  - At most **1–2 Playwright/agent browser contexts** in parallel (others queued).
  - Limit number of heavy background webviews; freeze/suspend idle ones.
  - Restrict number of simultaneous DevTools instances (preferably 0 in end‑user builds).

- **Lazy loading & teardown:**
  - Code‑split heavy modules (Theia packages, canvas/ReactFlow, etc.) and load on first use.
  - Actively destroy webviews, browser contexts and workers when no longer needed.
  - Periodically clear caches and unused resources on memory pressure.

- **Rendering & interaction:**
  - Use list/canvas virtualization for large lists and complex flows.
  - Offload CPU‑heavy work to worker threads or separate processes.
  - Debounce expensive operations (indexing, search) on user input.

- **Profiling & benchmarking:**
  - Define repeatable benchmarks: cold/warm start, palette latency, agent run latency, memory/CPU scenarios.
  - Use Chromium tracing, Electron performance APIs and long‑run leak tests.
  - Treat budget breaches as regressions to fix before release.

---

## 4. Non‑negotiable constraints (for aDOs v1)

- **No Node in any renderer or webview**; all privileged operations go through hardened IPC to the main process.
- **Renderer sandboxing and context isolation** must be always on; no debug flags that disable them in production.
- **No runtime code download or execution** from network (no plugin downloaders, no eval of fetched code).
- **No third‑party marketplace extensions** in MVP; only first‑party, audited modules shipped with the app.
- **All secrets at rest encrypted** using OS‑protected keys; no plaintext tokens on disk.
- **No telemetry or analytics** leaving the machine by default; offline‑first.
- **Resource budgets enforced**: concurrency and memory limits must be implemented, not just aspirational.
- **All privileged actions logged** in a local audit log (with option for user to review/export).

These form the “laws of physics” for the aDOs v1 security/performance envelope.

---

## 5. Components, libraries & OSS in scope

> Note: this list captures primary components referenced or implied; actual repo choices live in the architecture/packaging tracks.

| Component / Role                 | Recommended Tech / Library               | Why / Notes                                               |
|----------------------------------|------------------------------------------|-----------------------------------------------------------|
| Desktop shell                    | **Electron**                             | Mature, controllable Chromium bundling + security fuses   |
| IDE framework                    | **Eclipse Theia**                        | Extensible, VS Code‑like architecture, web/desktop ready |
| UI stack                         | **React** (+ Theia widgets)             | Main front‑end + custom panels/canvas                    |
| Browser automation agent         | **Playwright** (Chromium)               | Stable CDP control, headless; version‑pinned             |
| Local DB / indexing              | **SQLite** (+ FTS/possibly SQLCipher)   | Lightweight, works well for local search/metadata         |
| OS key storage                   | **keytar** + DPAPI/Keychain             | Uses OS credential vault for DEK wrapping                 |
| Fuzzy search (palette, small data)| **Fuse.js**                             | Lightweight, permissive, ideal for small in‑memory sets   |
| Crypto primitives                | Node crypto (AES‑256‑GCM), KDF libs     | For vault encryption + passphrase derivation              |
| Logging & tracing                | Electron/Chromium tracing + local log files | For audit and performance profiling                    |

All third‑party deps must be pinned, audited and periodically updated; anything with critical CVEs is upgraded or removed before release.

---

## 6. Trade‑offs & alternatives

1. **OS keychain vs custom crypto only**
   - *Chosen:* OS keychain (DPAPI/Keychain via keytar) to wrap DEK, with optional user master passphrase.
   - *Reason:* Reduces risk of rolling our own key storage; simpler UX (no mandatory extra password) while still allowing advanced users extra protection.
   - *Alternative:* Pure passphrase‑based vault (no OS keychain); more portable but worse UX and more risk from weak passwords.

2. **No auto‑update vs convenience**
   - *Chosen:* No auto‑update in MVP; manual install of signed builds.
   - *Reason:* Removes a high‑value attack channel (malicious updates); simpler threat model.
   - *Alternative:* Auto‑update with fully signed, verified update pipelines; deferred until later maturity.

3. **Internal controlled browser vs external browser for agents**
   - *Chosen:* Internal, sandboxed Chromium instance controlled by Playwright.
   - *Reason:* Tighter sandboxing, single security posture, consistent versioning.
   - *Alternative:* Automating system browser (Chrome/Edge); would complicate sandboxing and visibility.

4. **Strict extension model vs open marketplace**
   - *Chosen:* Only first‑party Theia extensions; no user‑installed VS Code marketplace extensions.
   - *Reason:* Keeps threat surface manageable while core foundation is built.
   - *Alternative:* Allow arbitrary extensions early; huge security complexity for minimal MVP value.

5. **Hard concurrency limits vs “user decides”**
   - *Chosen:* Enforced caps on agents/webviews/contexts to protect an 8 GB baseline.
   - *Reason:* Prevents accidental self‑DoS by agents or scripts; predictable resource usage.
   - *Alternative:* Unlimited or user‑configured only; risks lock‑ups and poor UX on low‑spec machines.

---

## 7. Open questions / gaps

- **How configurable should limits be?**  
  Do we expose advanced settings for max agents, max tabs, and memory thresholds, or keep them fixed in v1?

- **Workspace‑local vs global permissions:**  
  Should file/network permissions be scoped per workspace, or global to the app, by default?

- **Vault encryption granularity:**  
  Do we encrypt only secrets, or also certain sensitive note types (e.g., “private” notebooks) at the cost of searchability?

- **Agent interaction UX:**  
  How frequently can/should the agent be allowed to trigger prompts before we pause it or require explicit “continue” approval?

- **Partial vs full DB encryption:**  
  Is it worth adopting SQLCipher for specific tables, or is a separate encrypted secrets file sufficient for v1?

- **Update notification:**  
  Even without auto‑update, do we add a simple “new version available” check (introducing a controlled network call) or stay fully offline?

These should be resolved in the global architecture & product design docs before implementation is considered “locked”.

---

## 8. Implementation hooks for the aDOs v1 build plan

These are concrete hooks to drop into `BUILD_PLAN.md` and tasking:

1. **Electron security baseline (Phase 0 – Foundation)**
   - Implement secure BrowserWindow defaults (sandboxing, no Node) and preload patterns.
   - Add CSP injection + protocol handling + navigation/pop‑up controls.
   - Flip Electron security fuses at build time.

2. **Permission & capability framework (Phase 1 – Core platform)**
   - Define capability schema (files, network, clipboard, vault, browser, etc.).
   - Implement manifest parsing for tools/scripts/agents.
   - Wire permission checks into all privileged APIs and IPC endpoints.

3. **Consent UX + audit logging (Phase 1–2)**
   - Build user‑facing permission prompts with allow‑once/session/always semantics.
   - Implement structured security/audit log and in‑app viewer/export.
   - Ensure all privileged commands/actions are instrumented.

4. **Vault & secret management (Phase 2 – Data layer)**
   - Implement AES‑GCM vault, DEK + keytar integration, optional master passphrase flow.
   - Add secret masking in UI and log‑sanitisation.
   - Implement encrypted backup/export and delete/rotation flows.

5. **Performance budget enforcement (Phase 2–3)**
   - Wire up concurrency limits for agents/webviews/DevTools.
   - Implement tab suspension/unload behaviour and cache clearing on pressure.
   - Integrate basic resource monitoring and warning thresholds.

6. **Benchmarking & red‑team harness (Phase 3 – Hardening)**
   - Script startup, palette, agent and memory‑stress benchmarks; add to CI or manual checklist.
   - Implement red‑team scenarios (malicious notes, downloads, prompt injection attempts, DOM bombs) and verify expected behaviour.

7. **Safe‑mode & incident runbook (Phase 3+)**
   - Add a “Safe Mode” startup option that disables automations and scripts.
   - Provide a short, in‑app incident response guide pointing to logs and key actions (stop agents, revoke secrets, update app).

These hooks ensure this track plugs cleanly into the cross‑track synthesis and gives clear, buildable tasks for the aDOs v1 roadmap.
