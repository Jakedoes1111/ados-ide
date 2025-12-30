# aDOs Deep Research — Track 04: Browser + CDP

> Synthesis summary of the "04_Browser-CDP" deep research document. Use this as the canonical one-page view when planning or implementing the browser automation subsystem in aDOs.

## 1. Track purpose & scope

- Provide an **embedded browser and automation engine** inside the aDOs IDE (Theia + Electron), instead of relying on an external Chrome.
- Support **multi-tab, multi-profile browsing** (isolated cookies/storage) controlled by the IDE and by agents.
- Expose **Chrome DevTools Protocol (CDP)** / **Playwright** control so agents and flows can drive websites (navigation, DOM actions, scraping, screenshots).
- Persist **history, bookmarks and downloads** locally using SQLite for offline-first, privacy-respecting operation.

## 2. High-level architecture (decisions)

- Run a single Electron `BrowserWindow` that hosts the aDOs UI (Theia frontend) and manages one or more browser **tabs** as `BrowserView` or `<webview>` instances.
- Each tab is backed by its own `webContents` and associated **Electron session**:
  - Profiles are created via `session.fromPartition('profile:<id>')` so cookies/cache are isolated per workspace or identity.
  - Tab switching is handled by the main process by changing `BrowserView` bounds / z-order; Theia renders the tab strip and issues tab actions.
- **Automation layer**:
  - Primary path: connect Playwright’s Electron helper to the active `webContents` so agents can navigate, click, type, evaluate JS and capture screenshots.
  - Secondary path: attach CDP directly via `webContents.debugger.attach()` for low-level control when Playwright is not used.
- **State & persistence**:
  - History and bookmarks are stored in **SQLite** (via `better-sqlite3`), with tables for visits, bookmarks and profiles.
  - Downloads are managed by listening to `session.on('will-download')`, persisting metadata in SQLite and providing pause/resume/open actions.
- All browsing happens **in-app**; opening pages in the system browser is optional and not the default.

## 3. OSS dependencies & licensing (shortlist)

| Component                         | Role                                        | License    | Notes |
|-----------------------------------|---------------------------------------------|-----------|-------|
| `brrd/electron-tabs`              | Tab UI for Electron BrowserViews/webviews   | MIT       | Can be adapted for aDOs tab strip. |
| `ghostery/adblocker`              | Embedded ad/tracker blocker                 | MPL‑2.0   | Production-grade block lists and fast filtering. |
| `sindresorhus/electron-dl`       | Basic download handling                     | MIT       | Simple, battle-tested download helper. |
| `theogravity/electron-dl-manager`| Advanced download manager UI + queue        | MIT       | For richer download UX (pause/resume, progress, etc.). |
| `cyrus-and/chrome-remote-interface` | Low-level CDP client for Node/Electron  | MIT       | Fallback when we want raw CDP control. |
| `puppeteer/puppeteer`            | Headful/headless browser automation         | Apache‑2.0| Alternative to Playwright; useful for some scenarios. |
| `microsoft/playwright`           | Multi-browser (Chromium/Firefox/WebKit) automation | Apache‑2.0 | Main recommended automation framework; can bundle Chromium for offline use. |
| `WiseLibs/better-sqlite3`        | Fast SQLite bindings for Node               | MIT       | Used for history, bookmarks and download metadata. |

(Exact versions and final selection will be locked per-track when we wire this into the global dependency matrix.)

## 4. Behaviour / UX expectations

- Tabs support **add / close / switch** actions, per-tab favicon/title and optional devtools indicator.
- Profiles can be switched or scoped by workspace; users should be able to see which profile a tab belongs to.
- DevTools:
  - Users can open DevTools for the active tab only; opening it on a second tab closes the first to avoid multiple heavy devtools windows.
  - DevTools are primarily for debugging automation flows and page issues, not for general user tinkering.
- Downloads:
  - Downloads appear in a unified **download manager** with file name, origin URL, status, size and progress.
  - Users can pause/resume and open the downloaded file or reveal it in the OS.
- History & bookmarks:
  - History and bookmarks are queryable via **palette commands** and/or dedicated views.
  - Simple commands like “Add bookmark”, “Remove bookmark”, “Open recent page” integrate with command palette and flows.
- All of this is designed to be **agent-friendly**: agents can open tabs, navigate, click, type, scrape content and save structured results into the aDOs workspace.

## 5. Implementation roadmap (from research)

**MVP**

1. **Project setup** – Scaffold Theia/Electron app with browser capability enabled and an empty tab UI; app builds and runs.
2. **Tab basics** – Implement add/close/switch tab logic using `BrowserView`/`<webview>` and a tab bar in Theia; switching tabs swaps visible content.
3. **Session & profile isolation** – Use `session.fromPartition()` to isolate cookies/storage per profile; verify by logging into different accounts.
4. **DevTools handling** – Wire up open/close DevTools for the active tab only; ensure toggling works and is resource-aware.
5. **CDP/Playwright wiring** – Expose an API for agents to control the active tab (navigate, evaluate JS, screenshot) via Playwright and/or raw CDP.
6. **Download manager** – Handle `will-download`, persist download records in SQLite, and add basic download list UI.
7. **History & bookmarks** – Define SQLite schema and implement commands/UI to add/remove bookmarks and browse history.

**v1 hardening**

- DevTools summary panel in aDOs (surface key network/console info without opening full DevTools).
- Print / PDF support via `printToPDF()` and/or embedded PDF viewer.
- Secrets handling using Electron `safeStorage` / OS keychain for any browser or automation credentials.
- Performance tuning: background tab throttling, tab limits, profiling and optimisation based on traces.
- Unit + integration tests around tabs, sessions, downloads and automation flows.
- UX polish and documentation.

## 6. Risks & mitigations (from research)

- **Extension / content risk** – Any future extension mechanism must not compromise sandboxing. Mitigation: tightly control extensions, use `session.setPermissionRequestHandler`, and avoid arbitrary unvetted extensions in MVP.
- **Memory bloat** – Each tab is a full Chromium renderer; many tabs + agents can exhaust 8 GB machines. Mitigation: cap active tabs, aggressively throttle/suspend background tabs and monitor memory.
- **Automation security** – Malicious or misconfigured agents could exfiltrate data from pages. Mitigation: run agents in a sandboxed process, scope their credentials, and store secrets only in OS keychain/safe storage.
- **DRM / Widevine complexity** – Widevine support adds size and licensing complexity. Mitigation: ship it only as an optional “DRM build” if/when truly needed, not in the default offline IDE.

## 7. Decisions & open questions

**Locked-in**

- Browser is **embedded inside Electron/ Theia** (no external Chrome windows by default).
- We will support both **tabbed browsing** and **automation control** over the same surface (no separate “automation-only” headless browser).
- Local **SQLite** (via `better-sqlite3`) is the source of truth for history, bookmarks and downloads.

**To decide**

- Final choice of **primary automation stack** (Playwright-first with CDP fallback vs. CDP-only for a smaller dependency footprint).
- Exact UX for **profiles** (switcher per workspace vs. per-tab profile selector).
- How much of the **DevTools surface** we expose in aDOs vs. leaving in the standard Chromium DevTools UI.

---

Use this summary as the canonical “04_Browser-CDP” page when building the global aDOs synthesis doc, the architecture map and the build plan.
