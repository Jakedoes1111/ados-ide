# Deep Research Summary — Visual Flows (Node-Based Automations)

## 1. Scope & Goal

- This track covers the **visual flow builder and local orchestrator** inside the aDOs IDE (Theia/Electron).
- It defines how users:
  - Design **node-based workflows** (similar to n8n / Node‑RED) in a React-based editor.
  - Execute flows **locally and offline** using a lightweight orchestrator.
  - Automate **FS/Git, HTTP, browser, shell, agents, and internal IDE operations**.
  - Observe and debug runs via **logs, artifacts, and diff views**, with **security guardrails**.
- Primary goals for aDOs v1:
  - Use **React Flow** for the node editor UI inside a Theia extension.
  - Use a **local Node.js orchestrator** with **Bree + worker_threads** as the runtime (no external services).
  - Use **SQLite** as the single local DB for flows, runs, logs, artifacts, and scheduled jobs.
  - Integrate **Playwright** for browser automation, with strict concurrency limits for 8 GB RAM targets.
  - Ship a **hello-world flow** that automates HTTP → transform → write file → log, plus a minimal browser demo.
- Explicit / implied non-goals for v1:
  - No multi-tenant/cloud orchestrator (Temporal, external queues) in MVP.
  - No embedded n8n/Node‑RED UI or engine; we **own** both editor and runtime.
  - No public plugin marketplace yet; only **curated, built‑in node types**.
  - No advanced long-running saga orchestration beyond basics (retries, simple cron, manual triggers).

---

## 2. Key Recommendations (Architecture & Design)

- **Recommendation:** Use **React Flow** as the primary visual flow editor.
  - **Why:** Native React integration, strong performance, mature APIs for custom nodes/edges, minimap, grouping, context menus, and good docs/community.
  - **Impact:** The flow editor is implemented as a **Theia React widget** embedding React Flow. All flow editing features (add nodes, connect edges, inline config, templates) are built with React Flow’s nodeTypes / hooks model.

- **Recommendation:** Implement a **local Node.js orchestrator** using **Bree** + **worker_threads** for execution.
  - **Why:** Bree provides job scheduling, concurrency limits, retries, and cancellation without external services. worker_threads give isolation and parallelism while keeping everything in-process.
  - **Impact:** Each flow run is a **Bree job** executed in a worker thread. The orchestrator handles sequencing, branching, error handling, checkpoints, and logging, with no Redis/Temporal server.

- **Recommendation:** Adopt a **local-first SQLite DB** (with a light ORM or direct driver) for flows, runs, logs, and artifacts.
  - **Why:** SQLite is lightweight, reliable, and matches offline desktop constraints. WAL mode supports concurrency; no external DB is needed.
  - **Impact:** All flow definitions, node schemas, run metadata, and artifact references live in SQLite (plus files on disk for large artifacts). This DB also backs scheduled triggers (cron jobs) and execution history.

- **Recommendation:** Use a **single Playwright browser instance** with limited concurrent contexts for all browser automation nodes.
  - **Why:** Playwright is robust and cross‑browser, but heavy. Reusing one headless Chromium instance with a small number of contexts keeps memory within 8 GB constraints.
  - **Impact:** Browser nodes talk to a shared Playwright controller; concurrency for browser tasks is capped (e.g., 1–3 contexts). The orchestrator enforces back‑pressure for browser-heavy flows.

- **Recommendation:** Define clear **data contracts** using TypeScript + Zod (or similar) for flows, nodes, runs, and artifacts.
  - **Why:** Strong typing and runtime validation reduce runtime surprises, support UI forms, and allow safe evolution.
  - **Impact:** Every node type has declared parameter/IO schemas; flow JSON is validated on load; run records and artifacts are stored with well‑defined shapes.

- **Recommendation:** Implement a **capability‑based security model** with explicit user approvals and audit logs.
  - **Why:** Flows can touch FS, network, shell, and secrets; least privilege and human‑in‑the‑loop approvals are critical for trust.
  - **Impact:** Nodes request capabilities like FS read/write, HTTP domains, exec, browser, and secrets. First‑time or high‑risk actions trigger prompts; all approvals and denials are logged.

- **Recommendation:** Optimise explicitly for **8 GB RAM + Electron + Playwright**.
  - **Why:** Target hardware (user’s laptop) is modest; flows must not starve IDE UX.
  - **Impact:** Hard concurrency caps (flows, workers, browsers), lazy loading (only start Playwright/flow editor when needed), streaming IO for large data, and explicit testing on 8 GB machines.

- **Recommendation:** Cleanly **separate editor vs runtime** responsibilities.
  - **Why:** React Flow should remain a pure UI concern; runtime semantics live in the orchestrator, not in the graph library.
  - **Impact:** The React Flow layer only edits JSON graphs. Execution semantics (ordering, retries, triggers, parallelism) are implemented in the Node runtime, making future engine swaps easier.

---

## 3. Non‑Negotiable Constraints

- **Constraint:** **React Flow** is the chosen visual editor for v1.
  - All flow editing UX is built on React Flow; alternative libraries (Rete, MXGraph, X6) are references, not primary engines.
  - Changing UI engine later would be non‑trivial and is considered a **major re‑architecture**.

- **Constraint:** Orchestration is **local and offline-first**, using **Node.js + Bree + worker_threads**.
  - No Temporal, no external queues or cloud orchestrators in MVP.
  - All execution happens inside the Theia backend process (plus worker threads/sub‑processes), under strict concurrency limits.

- **Constraint:** **SQLite** is the canonical persistence layer.
  - Flows, runs, logs, and artifacts metadata are stored in SQLite; there is no requirement for an external DB server.
  - Future server modes must still preserve local‑first semantics.

- **Constraint:** **Playwright** is the browser automation layer, with **one shared browser instance**.
  - Browser automation must fit within 8 GB by reusing contexts and limiting concurrent pages.
  - Puppeteer or other tools are not part of the v1 baseline (can be investigated as future fallbacks).

- **Constraint:** Strong **security guardrails** are mandatory.
  - Flows **cannot** silently access arbitrary FS paths, spawn arbitrary processes, or leak secrets.
  - Capability checks and (at least basic) user prompts for risky operations must ship in the MVP.

- **Constraint:** All major dependencies must be **permissively licensed** (MIT/Apache/BSD).
  - n8n’s Fair‑code license, Temporal server stack, or AGPL components cannot be embedded.
  - React Flow, Bree, Playwright, SQLite, and the chosen ORM/driver must pass a licence audit.

- **Constraint:** MVP must deliver a **working, end‑to‑end hello‑world flow** with logs & artifacts.
  - Trigger → HTTP → transform → write file → log must be fully functional inside the IDE, not just a theoretical design.

---

## 4. Components, Libraries & OSS Repos

| Component / Role                    | Recommended Tech                              | Why it’s recommended                                                                                       | Risks / Caveats                                                                                       |
|------------------------------------|-----------------------------------------------|------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Visual flow editor                 | **React Flow**                                | Native React, polished UX, custom nodes/edges, minimap, strong community, MIT licence.                    | Tight coupling to React; major change if UI engine ever swapped.                                     |
| IDE host / front‑end               | **Eclipse Theia (Electron)**                  | Existing base for aDOs; provides commands, layout, panels, keybindings, FS APIs.                          | Integration complexity; must follow Theia’s extension model.                                         |
| Job scheduler / orchestrator core  | **Bree**                                      | Worker‑thread scheduler with cron, concurrency limits, retries, cancellation; no external broker.         | No built‑in durable queue; we must integrate Bree with SQLite to persist job definitions/state.      |
| Worker isolation / parallelism     | **Node.js worker_threads** + child_process    | Parallel execution and isolation for nodes, optional subprocesses for shell/Python tasks.                 | Excess threads/processes can bloat memory; must pool/limit.                                          |
| Database                           | **SQLite** (WAL mode)                         | Lightweight, embeddable, durable; ideal for local desktop apps.                                           | ORM choice can affect footprint (Prisma heavier; may prefer Drizzle/better‑sqlite3).                 |
| ORM / DB layer                     | **Light ORM or direct driver**                | Type‑safe queries and schema management with minimal overhead.                                            | Need to balance DX vs runtime cost; Prisma may be too heavy for 8 GB target.                         |
| Browser automation                 | **Playwright (Chromium headless)**            | Robust automation, multiple contexts per browser, good isolation; Apache-2.0 licence.                     | Significant baseline RAM; must enforce strict context and concurrency caps.                          |
| Schema & validation                | **TypeScript + Zod (or TypeBox)**             | Strong typing plus runtime validation for nodes/flows/runs.                                               | Extra boilerplate; need discipline to keep schemas in sync with UI and runtime.                      |
| Logging                            | **Structured JSON logging** (e.g. pino)       | Fast, low‑overhead logs in JSON; easy to query and feed to UI.                                            | Need log retention/rotation to avoid disk bloat.                                                     |
| Secrets storage                    | **Keytar / OS keychain**                      | OS‑backed credential vault (Windows Credential Manager, macOS Keychain, etc.).                            | Platform quirks; must handle missing keychain gracefully (e.g., in some Linux envs).                 |
| Node sandboxing                    | **Node vm / VM2 (sandbox)**                   | Isolate user‑provided JS code with restricted globals/APIs.                                               | JS sandboxes are hard to perfect; may need additional containment (separate processes).              |

---

## 5. Trade‑offs & Alternatives

- **React Flow vs Rete.js vs diagram libraries**
  - **React Flow:** UI‑only node editor, optimised for React, flexible custom nodes, simpler mental model.
  - **Rete.js:** Visual programming framework with its own execution engine; more opinionated and complex to integrate.
  - **Diagram‑JS / MXGraph / AntV X6:** Powerful, but less idiomatic in React and typically heavier to customise.
  - **Decision:** React Flow chosen for **simplicity, React fit, and maintainability**; execution engine stays in our own runtime.

- **Custom orchestrator vs Temporal / Node‑RED / n8n**
  - **Temporal / Cadence:** Industrial‑grade workflow engines with durable state and advanced features; require heavy server stack, not 8 GB‑friendly.
  - **Node‑RED / n8n:** Battle‑tested node editors and runtimes; but embedding them creates double‑system complexity and n8n’s licence is restrictive.
  - **Custom Node runtime (Bree + workers):** Full control, minimal moving parts, tailored to offline desktop.
  - **Decision:** Build a focused local orchestrator using Bree/threads rather than embedding an external platform.

- **worker_threads vs child_process pool**
  - **Threads:** Faster to spawn, share memory, good for Node‑native work; but each has its own V8 with non‑trivial memory.
  - **Processes:** Stronger isolation and easier sandboxing; heavier and more IPC overhead.
  - **Decision:** Default to worker_threads for flows; spawn child processes only for risky/heavy external commands (shell, Python).

- **Playwright vs Puppeteer**
  - **Playwright:** Better multi‑context handling, cross‑browser support, strong tooling; slightly heavier baseline.
  - **Puppeteer:** Lighter per instance, but weaker under many contexts and less robust at scale.
  - **Decision:** Use Playwright, compensate with **single instance + limited contexts**.

- **Prisma vs lighter DB stack**
  - **Prisma:** Great DX, migrations, and type safety; costs memory (binary query engine).
  - **Drizzle / better‑sqlite3 / raw queries:** Smaller footprint; more manual work.
  - **Decision (implied):** Lean towards a **lighter SQLite stack** if Prisma’s footprint proves problematic on 8 GB; verify via prototype.

---

## 6. Open Questions / Gaps

- **How “complex” should v1 flows be?**
  - Do we support **parallel branches and joins** in MVP, or limit to mostly linear flows with minimal branching?
  - Complexity of joins and parallel semantics impacts orchestrator design and debugging UX.

- **Exact flow file strategy (files vs DB‑only).**
  - Are flows stored primarily as **workspace files** (Git‑friendly JSON) or as DB records with optional export/import?
  - Decision affects versioning, diffing, and collaboration via Git.

- **Depth of integration with other modules (Canvas, Tasks, Agents).**
  - MVP hints at nodes for Tasks/Notes and internal Agents, but how deep should this go in the first cut?
  - Need a concrete list of **first‑class integration nodes** for v1 vs later.

- **Granularity of security prompts.**
  - Do we prompt per flow, per node, per domain/path, or use more global “trust this flow” toggles?
  - UX must balance safety with fatigue; needs explicit product decisions.

- **Pause/resume semantics.**
  - Does “pause” mean **suspend mid‑node**, or simply stop scheduling new nodes and let current finish?
  - True mid‑node suspension is complex; this might be deferred or defined more loosely.

- **ORM final choice and performance budget.**
  - Need hard numbers on acceptable memory footprint for DB layer (e.g., max X MB at idle) to choose ORM vs direct driver.

---

## 7. Implementation Hooks for the aDOs v1 Build Plan

**Phase 0 – Flows Extension Skeleton**

- Implement a **Theia “Flows” extension**:
  - New sidebar/panel with a React widget hosting React Flow.
  - Commands: “Open Flows View”, “New Flow”, “Run Flow (no‑op stub)”.
- Store flows as simple JSON in SQLite or in a `.flow.json` file to prove the round‑trip.
- Deliverable: user can create/edit a toy flow graph; saving works; no runtime yet.

---

**Phase 1 – Core Flow Model & Editor UX**

- Define **Flow JSON schema** (Flow, Node, Edge, Trigger).
- Implement:
  - Node palette (HTTP, Function, File Write, Trigger).
  - Node configuration UI (sidebar or inline forms).
  - Edge creation, deletion, basic validation (no orphan nodes).
- Hook up Zod validation for flows and node parameters on save.
- Deliverable: flows can be safely edited and validated; JSON is stable enough for runtime.

---

**Phase 2 – Local Orchestrator & Hello‑World Flow**

- Implement the **Node orchestrator**:
  - Integrate **Bree** for scheduling jobs.
  - Define a simple worker script that executes a flow sequentially in a worker_thread.
  - Implement node runners for:
    - Manual Trigger.
    - HTTP Request.
    - Function (sandboxed JS).
    - File Write.
- Add basic run logging to SQLite: run records + node status.
- Wire UI: “Run Flow” button → backend run → live run status in the editor.
- Deliverable: **Hello‑world flow** (Trigger → HTTP → Function → File Write → Log) runs end‑to‑end inside aDOs.

---

**Phase 3 – Logging UI, Artifacts, and Diffing**

- Build a **Run Log panel** in the flow editor:
  - Show node‑by‑node status (success/error/cancelled).
  - Show inputs/outputs summaries; expand for raw JSON.
  - Link to artifacts (file paths, screenshots).
- Implement artifact storage on disk + metadata in DB.
- For text file writes, add **basic diff** (old vs new content) in UI using existing diff viewer.
- Deliverable: users can **inspect what happened**, open artifacts, and see file diffs for a run.

---

**Phase 4 – Browser Node & Concurrency Limits**

- Integrate **Playwright** in the backend:
  - Lazy‑init a single Chromium instance.
  - Manage contexts per browser node, with a hard cap on concurrent contexts.
- Implement a simple **Browser Screenshot** node (URL → PNG artifact).
- Extend orchestrator with:
  - Global concurrency cap for flows.
  - Separate cap for browser tasks.
- Add a test flow with two concurrent browser nodes; verify stability on 8 GB target.
- Deliverable: browser automation usable in flows without crashing/lagging the IDE.

---

**Phase 5 – Security, Capabilities & Approvals**

- Implement a minimal **SecurityManager**:
  - Enforce FS scope (workspace‑only by default).
  - Add first capability prompts (e.g., write outside workspace, use specific credential, call external domain).
- Add an **audit log** (append‑only JSON or DB table) for security‑relevant events.
- Provide a small **Security panel** to review and revoke remembered approvals.
- Deliverable: flows cannot silently perform dangerous actions; approvals are visible and reversible.

---

**Phase 6 – Quality, Performance & Hardening**

- Performance passes:
  - Measure memory/CPU for typical flows (including browser nodes) on an 8 GB machine.
  - Tune concurrency limits, worker lifetimes, and Playwright lifecycle.
- Stability & UX:
  - Ensure cancellations are clean (workers and browser contexts closed).
  - Improve error messages and run log clarity.
- Tighten schemas and node SDK:
  - Formalise a **NodeType interface** (schema + runner + capability declarations).
  - Ensure adding new built‑in nodes is straightforward and safe.
- Deliverable: a **robust, shippable v1 Visual Flows system** that feels integrated, safe, and fast on the target hardware.

