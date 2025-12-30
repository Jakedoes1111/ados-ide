# aDOs Deep Research — Track 05: Agents & MCP Tool-Bus

> Synthesis summary of the **“05_Agents – MCP tool-bus architecture”** deep research document. Treat this as the canonical one-page view when planning or implementing the agent system in aDOs.

---

## 1. Track purpose & scope

- Define **how AI agents run inside aDOs** (Theia + Electron) and safely perform tasks like file edits, browsing, flows, notes, and automations on an 8 GB desktop.
- Choose and justify a **tool-bus architecture** (how agents call tools) that is *local-first, secure, vendor-agnostic* and future-proof.
- Specify:
  - The **protocol** (MCP) and orchestrator design.
  - The **agent taxonomy** (types of agents aDOs will support).
  - The **permission & safety model**.
  - The **minimal tool set** for the MVP.
  - The **runtime shape, integration points, testing strategy**, and a rough **build plan**.

---

## 2. High-level architecture & key decisions

### 2.1 Core decision: MCP as the tool-bus

- aDOs will adopt **Model Context Protocol (MCP)** as the **core “tool bus”** between the agent orchestrator and tools.
- MCP is an open JSON-RPC 2.0–based standard defining how **hosts (aDOs)** call **servers (tools)**:
  - Tools are described with **JSON Schemas** for inputs/outputs.
  - Tools are **discovered dynamically** via a manifest.
  - It’s **model-agnostic**: any LLM that “speaks MCP” can use the tools.
- Compared to **LangChain, Semantic Kernel, OpenAI functions/plugins, SmolAgents**:
  - MCP is the **most neutral and standardised**, with:
    - No cloud lock-in.
    - Strong emphasis on **user consent** and structured tools.
    - A growing ecosystem of **reusable MCP servers** (FS, browser, etc.).
  - Other frameworks are richer but heavier, less sandboxed, and often biased toward cloud backends or specific vendors.

### 2.2 Orchestrator & tool bus

- Implement a **lightweight Node.js Agent Orchestrator** in the Theia backend that:
  - Talks to LLMs (local or cloud) via an `LLMClient`.
  - Connects to tools via an **MCP router** over JSON-RPC (stdio/WebSocket).
  - Enforces permissions via a **Permission Gate**.
  - Emits **audit logs and telemetry** to local SQLite/OTel-style logs.
- The **Tool Bus** is a cluster of MCP servers:
  - `FS/Git Server`, `Shell Server`, `Browser Automation Server`, `Notes/Graph Server`, `HTTP Client Server`, `Canvas/Design Server`, etc.
  - The orchestrator routes tool calls to the appropriate server and logs every call.

### 2.3 Integration with aDOs UI & flows

- The orchestrator receives invocations from three main UI sources:
  - **Command Palette (Raycast-style)** – “Run Agent: …”, “Explain this code”, “Summarise doc”.
  - **Context menus** – right-click actions on code, files, notes, canvas.
  - **Visual Flows (n8n-style)** – agent nodes embedded into automation pipelines.
- All of these emit standardised `agent_invocation` events into an **Event Bus**.  
  The orchestrator:
  - Starts an agent session.
  - Chooses tools (via LLM + tool list) and requests permissions as needed.
  - Streams output and progress back to the front-end via `agent_output` events.

---

## 3. Agent taxonomy (what kinds of agents aDOs supports)

The research defines a **clear set of first-class agent types** with their typical tools and constraints:

1. **Coding Assistant**
   - **Goal:** Code edit/refactor/test generation.
   - Uses `fs.read`, `fs.write`, `git.commit`, optional `shell.run` for tests/builds.
   - Constraints: one file at a time; show **diff** before writing; timeouts on long builds.

2. **Browser / RPA Agent**
   - **Goal:** Web automation & scraping via the embedded Chromium (Playwright).
   - Tools: `browser.open`, `browser.click`, `browser.fill`, `browser.wait_for`, `browser.scrape`, `browser.download`.
   - High resource usage → at most **one browser instance** at a time on 8 GB; strict domain scoping and timeouts.

3. **Research / Summarisation Agent**
   - **Goal:** Read local docs or web sources and produce summaries, briefs, or Q&A.
   - Tools: `fs.read`, `http.request`, possibly notes tools for storing output.
   - Constraints: input chunking for long texts; token limits; streaming summaries.

4. **Knowledge Base Agent**
   - **Goal:** Work with notes and graph (Obsidian/Notion-style within aDOs).
   - Tools: `notes.read`, `notes.write`, `graph.query`.
   - Constraints: read-mostly by default; explicit confirmation before bulk edits.

5. **Canvas / Design Agent**
   - **Goal:** Interact with the canvas (Figma-like board) for tokens, assets, layout descriptions.
   - Tools: `canvas.export`, maybe `fs.write` for assets.
   - Constraints: operate on active canvas; limit export size; no destructive edits without prompt.

6. **DevOps / CI Agent**
   - **Goal:** Run tests/builds/deploys, manage CI pipelines.
   - Tools: `shell.run`, `fs.read/write`, `http.request`, `git.commit` / `git.create_pr`.
   - Hard gates for **destructive actions**; often run via flows with explicit approvals.

7. **Data / ETL Agent**
   - **Goal:** Data wrangling (CSV → JSON, API ingestion, simple DB ops).
   - Tools: `fs.read/write`, `http.request`, optional DB tools.
   - Constraints: conservative file-size limits; streaming / chunked processing.

These describe **capability bundles** and typical flows, rather than rigid classes; new specialisations should fit within this taxonomy.

---

## 4. Permission & safety model

The doc proposes a **strict, layered safety model**:

### 4.1 Scoped capabilities

- Every tool declares **scopes** like:
  - `fs:read:/project/src`, `fs:write:/project/docs`
  - `git:repo:<name>`
  - `browser:domain:example.com`
  - `shell:exec:allowed-command`
  - `net:domain:api.example.com`
- The orchestrator **validates every tool call** against the tool’s scope and the current approval set. No scope → no call.

### 4.2 Consent & human-in-the-loop

- First time an agent hits a **sensitive scope**, the IDE prompts:
  - “Allow agent to write to `<path>`?” → `Allow once / Always for this folder / Deny`.
- **File writes / code edits** must include a **dry-run + diff** in the prompt, so the user can see exactly what will change.
- High-risk tools (e.g. `shell.run`, network to unknown domains) use more explicit confirmation (even “type YES to continue” in paranoia mode).

### 4.3 Resource, network, secrets & audit

- **Time & resource limits:** per-tool CPU/time caps; kill runaway processes (browser, shell) if over limit.
- **Network egress policy:** all HTTP goes through `http.request` with allow/deny lists; block internal IPs by default.
- **Secrets handling:** secrets kept in a **Secret Vault** using OS-secure storage (e.g. Electron `safeStorage` / Windows Credential Vault); tools request tokens via scoped secret reads, and logs redact them.
- **Audit trail:** every tool call and permission decision logged to a local **Audit DB** (SQLite):
  - Includes timestamp, tool, inputs (sanitised), outputs/diffs, user decision.
  - Designed to support **replay** and tamper detection (hashing/signing).

### 4.4 Sandboxing

- Tools run in **restricted contexts**:
  - Shell commands in constrained processes/containers.
  - Browser automation in separate processes with minimal filesystem access, only via their tools.
  - Agents are treated as **untrusted**; they can request, but never execute, arbitrary Node APIs directly.

---

## 5. Minimal MCP tool set (MVP)

The MVP defines ~12 core tools, all exposed via MCP with schemas:

- **File & Git**
  - `fs.read` – read text files.
  - `fs.write` – create/overwrite files (with diff-preview in UX).
  - `git.commit` – stage & commit changes.
  - `git.create_pr` – open PRs via GitHub/GitLab APIs (may land slightly after initial MVP).

- **Shell & HTTP**
  - `shell.run` – execute non-interactive commands (highly restricted, always gated).
  - `http.request` – make HTTP(S) calls with full control over method, headers, body; scoped by domains.

- **Browser**
  - `browser.open` – launch/navigate a page and return a `pageId`.
  - `browser.click` – interact with elements.
  - `browser.fill` – type into inputs.
  - `browser.wait_for` – wait for conditions/timeouts.
  - `browser.scrape` – read text/HTML for full pages or selectors.

- **Notes & Graph**
  - `notes.read` / `notes.write` – access Markdown notes plus metadata.
  - `graph.query` – query backlinks/tags/relationships.

- **Canvas**
  - `canvas.export` – export current canvas as JSON/SVG/PNG to file or inline content.

Each tool is:

- Strictly **schema-validated** (rejects malformed inputs).
- Bound to **scopes** and logs.
- Documented in human-readable form for both users and LLM prompt templates.

---

## 6. Runtime & performance model

### 6.1 Orchestrator runtime

- Single **Node.js process** for the Agent Orchestrator:
  - **Async event loop** for MCP calls, LLM calls, and UI events.
  - Each agent session has its own **in-memory context** but shares the process.
- External heavy tasks use **pools**:
  - Maintain one (or a very small number of) Playwright browser instance(s).
  - Spawn `child_process` for shell commands with concurrency limits.

### 6.2 Job queue, idempotency & logging

- A small **job queue** caps concurrent tool calls (e.g. only a couple of heavy jobs at once).
- **Prioritisation**: user-interactive tasks take precedence over background flows.
- Each tool call gets a **unique ID**; non-repeatable actions (e.g. commits) use idempotency keys to avoid double-execution after restarts.
- Logs follow **OpenTelemetry-style** traces/spans:
  - One **trace per agent run**, one **span per tool call**.
  - JSON logs to disk with rotation.

### 6.3 Low-RAM strategies (8 GB target)

- **Lazy-loading** heavy modules (e.g. Playwright only on first use).
- **Releasing resources** quickly (closing pages, nulling large buffers).
- **Streaming** for large files and HTTP responses instead of loading everything into RAM.
- A simple **monitor** can enforce soft memory ceiling (e.g. 6.5 GB), pausing/denying new agents when exceeded.

---

## 7. Integration plan (how agents show up in aDOs)

1. **Command Palette**
   - Commands like:
     - “Run Agent: Explain this code”
     - “Run Agent: Summarise selection”
     - “Run Agent: Build & test project”
   - Opens an **Agent Console** panel for streaming output and cancellation.

2. **Visual Flows**
   - **Agent nodes** in the flow canvas:
     - Use agents as steps: “On git commit → agent summarises diff → write release notes → commit”.
   - Flows communicate with agents via Event Bus and receive structured outputs.

3. **Context Menus**
   - Editor & explorer context actions:
     - “Ask Agent → Explain”, “Refactor with Agent”, “Generate tests”, “Create summary note”.
   - Passes scoped context (e.g. current selection, file path) to the orchestrator.

UX expectations:

- Instant **feedback** when agents start (“Agent running…”).
- Ability to **cancel** at any time.
- Progress indicators and partial streaming, not just final answers.

---

## 8. Testing strategy (how we keep this sane)

- **Unit tests for tools**:
  - Golden-file tests for deterministic outputs (e.g. fs.read, diffs).
  - JSON Schema validation tests for good/bad inputs.
- **Permission & sandbox tests**:
  - Simulate disallowed actions to ensure they are blocked.
  - Mock user approvals/denials.
- **Agent-orchestrator integration tests**:
  - Use stub LLMs or scripted tool plans to test the orchestration loop deterministically.
  - Test audit-log completeness and basic replay.
- **Chaos & failure injection**:
  - Timeouts, process crashes, network failures.
  - Ensure graceful errors and no process-wide crashes.
- **UI automation tests**:
  - Use Playwright/Spectron-style tests to drive the aDOs UI:
    - Trigger palette commands, context menu actions, flow nodes.
    - Assert on visible outputs and state changes.
- **Scenario-based evals**:
  - Curated tasks (“Explain this function”, “Scrape this page”, “Generate notes”) rerun across releases to catch regressions.

---

## 9. Risks & mitigations

Key risks from the research and how we address them:

- **Security & data loss**
  - Risk: Agents delete/overwrite files, leak secrets, or run dangerous shell commands.
  - Mitigation: strict scopes; consent prompts; dry-run + diff; secret vault; sandboxing; paranoia mode; audit and undo via Git.

- **Stale / broken tools**
  - Risk: APIs change, browser selectors break, tools become unreliable.
  - Mitigation: modular tool design, health checks, versioning, and the ability to disable/fallback for specific tools.

- **MCP evolution**
  - Risk: Spec changes or incompatibilities as MCP matures.
  - Mitigation: track MCP releases, rely on maintained SDKs, clearly document supported MCP version, and design for incremental upgrades.

- **Windows & Electron quirks**
  - Risk: path issues, shell differences, Electron security pitfalls, Playwright/Electron mismatch.
  - Mitigation: early spikes; path utilities; cross-platform-compatible commands; adherence to Electron security best practices; pinning compatible Electron/Playwright versions.

- **Performance / UX**
  - Risk: agents feel slow or freeze the IDE.
  - Mitigation: resource limits, prioritised job queue, warm browser, streaming UX, clear progress, and easy cancellation.

- **User misunderstanding**
  - Risk: users over-trust agents or are surprised by changes.
  - Mitigation: human-in-the-loop UX, visible diffs, good documentation, “Agent Activity” view, and easy revert mechanisms.

---

## 10. Build plan (track-level view)

Approximate sequencing (aligns with the global 12-week plan):

1. **Weeks 1–2 – Spikes & skeleton**
   - Prototype JSON-RPC to a dummy MCP tool.
   - Verify Playwright + Electron + Windows viability.
   - Draft permission model & scopes.

2. **Weeks 3–4 – Orchestrator & core tools**
   - Implement Agent Orchestrator, Event Bus, Permission Gate, Audit log.
   - Ship first tools: `fs.read`, `fs.write`, `shell.run`, `http.request`.

3. **Weeks 5–6 – Full MVP tool set & basic agents**
   - Add remaining MVP tools (browser, git, notes, graph, canvas).
   - Wire one or two “real” agents (Coding Assistant, Browser/RPA) using a cloud LLM with function calling to validate flows.

4. **Weeks 7–8 – UI integration**
   - Hook agents into Command Palette, context menus, and Flows.
   - Implement consent UI, Agent Console panel, and basic activity view.

5. **Week 9 – Hardening & tests**
   - Build out test suites, permission tests, and chaos testing.
   - Fix security/performance issues found.

6. **Weeks 10–12 – Polish, docs, alpha, stabilisation**
   - Developer docs for adding tools.
   - UX refinement (prompt noise vs safety).
   - Internal alpha + bugfixes; dependency audit; security pass.

---

## 11. Decision record (ADR) – Why MCP + custom orchestrator

- **Chosen option:** MCP-based tool bus + custom Node.js orchestrator.
- **Rejected options:**
  - LangChain / Semantic Kernel as the primary runtime (too heavy, weaker sandboxing, less standardised).
  - OpenAI plugins/functions as the main agent engine (cloud-only, vendor lock-in, no offline-first).
  - Custom proprietary tool protocol (would duplicate MCP with no ecosystem benefits).
- **Rationale:**
  - MCP provides a **shared language** for tools while leaving aDOs free to choose any LLM.
  - It aligns with aDOs’ **offline, secure, transparent** goals.
  - Building our own orchestrator keeps **control over safety, UX, and performance**, while still riding the wave of an open standard.

Use this summary as the canonical “05_Agents & MCP Tool-Bus” page when building the global aDOs synthesis doc, architecture map, and BUILD_PLAN.
