# Deep Research Summary — Canvas Engine & Design Tokens

## 1. Scope & Goal

- This track covers the **Figma-style visual canvas** and **design tokens system** inside the aDOs IDE (Theia/Electron).
- It defines how we:
  - Render and interact with a **2D design canvas** (shapes, text, grouping, auto‑layout).
  - Represent and sync **design tokens** (colours, typography, spacing) between canvas and code.
  - Model **state, persistence, and future collaboration** (CRDT/undo/redo).
  - Expose a programmable **agent/automation API** over the canvas and tokens.
- Primary goals for aDOs v1:
  - Deliver a **fast, low‑overhead 2D canvas** that feels close to Figma for basic workflows.
  - Use **Konva.js + HTML5 Canvas** as the rendering engine, integrated via a Theia front‑end widget.
  - Use **Yjs CRDT** as the single source of truth for canvas + token state (single‑user now, multi‑user later).
  - Use a **W3C Design Tokens (DTCG)–compatible JSON** as the canonical tokens source, transformed to code via **Style Dictionary**.
  - Keep everything **permissively licensed** (MIT/Apache/BSD) and optimised for an **8 GB RAM** target machine.
- Explicit / implied non‑goals for v1:
  - Not a full Figma clone: **no advanced vector Boolean ops, pen tool, prototyping links, variants**, etc.
  - **No multi‑user collab in MVP** (Yjs is used in single‑user mode, but architecture is collab‑ready).
  - **No plugin marketplace** inside the canvas; automations use a curated API surface.
  - **No rich text editor** in v1 (single‑style text boxes only; rich text deferred).

---

## 2. Key Recommendations (Architecture & Design)

- **Recommendation:** Use **Konva.js** as the primary 2D canvas engine (via HTML5 `<canvas>`), with React bindings (`react-konva`).  
  - **Reasoning (from doc):** Konva offers **high performance and stable memory** with dirty‑region rendering, keeping ~60 fps with 1000+ shapes where Fabric.js drops toward 30–45 fps. It has layers, groups, transforms, event bubbling, and a built‑in Transformer widget for selection/resize/rotate. Bundle size and per‑object overhead are significantly lower than Fabric.  
  - **Impact on aDOs v1:** The canvas implementation, performance tuning, and interaction model should all be **Konva‑centric**. All editor features (selection, snapping, grouping) are built as logic around a Konva scene graph rather than SVG or WebGL primitives.

- **Recommendation:** Use **Yjs** as the state model (CRDT) for both canvas elements and design tokens.  
  - **Reasoning (from doc):** Yjs provides **efficient, binary CRDT updates**, low memory usage vs Automerge, built‑in undo/redo, and presence APIs for future multi‑user collab. It avoids unbounded history growth by default and supports explicit GC and snapshots.  
  - **Impact on aDOs v1:** All canvas/tokens state must be represented as **Yjs data structures** (Y.Map/Y.Array) with a clear schema. UI and automations operate by reading/writing Yjs, ensuring we get **undo/redo and future collab “for free”**.

- **Recommendation:** Adopt **W3C Design Tokens (DTCG) format** for `tokens.json` and **Style Dictionary** as the token → code transformer.  
  - **Reasoning (from doc):** DTCG provides a standard JSON shape (`$value`, `$type`), and Style Dictionary (Apache‑2.0) can consume that format and emit **CSS variables and TypeScript exports**. This enables a **round‑trip workflow**: tokens are edited in the IDE, applied live to the canvas, then published to real project code.  
  - **Impact on aDOs v1:** The **single source of truth** for tokens is a DTCG‑compliant `tokens.json`. Style Dictionary is wired into the backend to generate `tokens.css` and `tokens.ts` (or equivalent), and the UI assumes tokens are referenced by name (e.g. `fill = {brand.primary}`) rather than raw values.

- **Recommendation:** Implement auto‑layout using **Yoga Layout** (Flexbox engine) paired with Konva containers.  
  - **Reasoning (from doc):** Yoga is a proven, high‑performance Flexbox engine used in React Native and others, exposing a C/JS API that can compute positions for children given direction, padding, spacing, etc. That matches a simplified Figma‑style auto‑layout model for vertical/horizontal stacks.  
  - **Impact on aDOs v1:** “Auto‑layout frames” are implemented as **Yoga nodes + Konva groups**: the Yoga tree computes child positions, and Konva renders them. The MVP auto‑layout feature set (simple stacks with padding + spacing) is constrained to what Yoga can express.

- **Recommendation:** Split responsibilities clearly between **Theia front‑end widget** and **backend extension services**.  
  - **Reasoning (from doc):** Rendering and interaction belong in the Electron renderer (React + Konva + Yjs), while heavy or Node‑only tasks (file I/O, Style Dictionary token builds, PDF export) live in the backend. This keeps the UI responsive and uses Theia’s normal extension architecture.  
  - **Impact on aDOs v1:** The extension must define:
    - A front‑end widget hosting the canvas + tokens UI, bound to a Yjs document.
    - Backend services for saving/loading design files, running Style Dictionary, exports, and (later) Yjs WebSocket sync.

- **Recommendation:** Expose a **typed agent/automation API** that wraps Yjs and Konva operations behind a stable contract.  
  - **Reasoning (from doc):** By routing all model‑changing operations through a controller that emits events (e.g. “element created”, “token changed”), external agents (AI tools, scripts) can manipulate the canvas safely, including headless operations, without reaching into internals.  
  - **Impact on aDOs v1:** We must define an **internal “DesignCanvasService” API** (TypeScript interfaces) with functions like `createShape`, `updateElement`, `applyToken`, `getSelection`, and events for selection/state changes, and treat this as the long‑term contract for automations.

- **Recommendation:** Optimise specifically for **8 GB RAM** footprint and smooth interaction.  
  - **Reasoning (from doc):** The target hardware is a modest Windows 11 laptop; Electron overhead is ~200–300 MB alone. Konva + Yjs are chosen in part for low idle CPU and RAM, with options for OffscreenCanvas if needed. Style Dictionary runs only on demand.  
  - **Impact on aDOs v1:** The canvas view must **virtualise where possible** (avoid mounting many huge canvases), ensure shapes are destroyed correctly, and test typical flows so that memory stays within a sensible budget (e.g. idle ≤ ~600 MB, spikes ≤ ~1.5 GB).

- **Recommendation:** Keep the stack **fully permissive‑licensed** and avoid GPL/AGPL at runtime.  
  - **Reasoning (from doc):** Konva, Yjs, Style Dictionary, Yoga, and supporting libraries (react‑konva) are MIT/Apache/BSD; this avoids copyleft obligations and fits Theia’s EPL/MIT licensing stance.  
  - **Impact on aDOs v1:** Any additional canvas, token, or rich‑text related libraries must be checked for **MIT/BSD/Apache** only; AGPL components (e.g. some collab editors) are off‑limits.

---

## 3. Non‑Negotiable Constraints

- **Constraint:** The canvas implementation is **Konva‑based HTML5 Canvas**, not SVG or WebGL.  
  - **Source:** Executive summary + decision matrix clearly recommend Konva over Fabric, Pixi, Paper, Excalidraw.  
  - **Implication for implementation:** All rendering, hit‑testing, and interaction code must be written against **Konva’s scene graph and event model**. Alternative engines (Pixi/WebGL, Excalidraw) can be inspirations or future options but are not part of v1.

- **Constraint:** **Yjs** is the authoritative state layer for canvas and tokens.  
  - **Source:** Architecture sections describe Yjs documents as the canonical model, with undo/redo via Yjs UndoManager and persistence via encoded updates.  
  - **Implication for implementation:** No separate ad‑hoc state store should exist; React components must derive their state from Yjs. Undo/redo, snapshots, and future collab all rely on **using Yjs consistently everywhere**.

- **Constraint:** Design tokens must be stored in a **DTCG‑compatible `tokens.json`** and transformed via **Style Dictionary**.  
  - **Source:** Design tokens system section explicitly prescribes DTCG JSON and SD transforms to CSS/TS.  
  - **Implication for implementation:** Tokens UI, canvas styling, and publish flow all assume **token names and types** come from this JSON. Style Dictionary must be wired into the backend as the only supported publish mechanism in v1.

- **Constraint:** The entire stack must remain **permissively licensed** (MIT/Apache/BSD) with **no GPL/AGPL** in runtime.  
  - **Source:** Licensing section enumerates chosen libraries and explicitly avoids copyleft licences.  
  - **Implication for implementation:** Any new dependency (e.g. for rich text, exports, icons) must be vetted for licence; AGPL collab kits and GPL PDF libs are out of scope.

- **Constraint:** MVP feature scope is **intentionally limited**.  
  - **Source:** MVP spec section defines specific user stories and explicitly marks out‑of‑scope items (multi‑user collab, pen tool, Boolean ops, variants, prototyping, shape libraries, plugins).  
  - **Implication for implementation:** Engineering time for v1 must stay focused on: basic shapes, grouping, snapping, text, simple auto‑layout, tokens, publish, undo/redo, save/load. Anything beyond that is a future phase.

- **Constraint:** The canvas must be delivered as a **Theia extension widget**, not a detached app.  
  - **Source:** Architecture outline assumes a Theia front‑end widget + backend extension using Theia’s commands, keybindings, file system, theming, etc.  
  - **Implication for implementation:** Integration must follow **Theia’s extension points** (commands, menus, editors) so the canvas behaves like a first‑class IDE view and can be opened from design files or commands.

---

## 4. Components, Libraries & OSS Repos

| Component / Role              | Recommended Tech / Repo                           | Why it’s recommended                                                                                     | Risks / Caveats                                                                                 |
|-------------------------------|---------------------------------------------------|----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| 2D canvas engine              | **Konva.js** (`konvajs/konva`)                   | High‑perf HTML5 canvas engine with layers, transforms, events, dirty‑region rendering, Transformer UI.   | Smaller community and mainly one lead maintainer; mitigate via abstraction + option to fork.   |
| React canvas bindings         | **react‑konva**                                  | Idiomatic React wrapper over Konva; fits Theia’s React front‑end nicely.                                | Ties us to React; future non‑React front‑ends would need a different integration layer.        |
| State / CRDT engine           | **Yjs** (`yjs/yjs`)                              | Efficient CRDT with undo/redo, awareness, low memory; already used widely in collab editors.            | Also largely single‑maintainer; CRDT model requires discipline to avoid schema sprawl.         |
| Design tokens format          | **W3C DTCG design tokens JSON**                  | Open standard for tokens (`$value`, `$type`), supported by modern tooling like Style Dictionary.        | Spec still evolving; need to track any breaking changes and constrain to stable subset.        |
| Token → code transformer      | **Style Dictionary** (`style-dictionary`)        | Mature tool to convert DTCG tokens to CSS/TS and other targets; Apache‑2.0, widely adopted.             | Adds a Node dependency and build step; must be kept in sync with token schema changes.         |
| Auto‑layout engine            | **Yoga Layout** (`facebook/yoga`)                | Battle‑tested Flexbox layout engine, ideal for vertical/horizontal stacks and padding/spacing.          | Only covers flex; Figma‑style mixed constraints require extra logic or careful scoping.        |
| Front‑end framework           | **React** (Theia front‑end base)                 | Already used in Theia; easy composition of canvas, sidebars, toolbars, and property panels.             | More complex rendering tree; must ensure we don’t over‑render on Yjs update storms.            |
| IDE framework / host          | **Eclipse Theia** / **Theia Blueprint**          | Provides extension model, commands, file system, theming, Electron host, and layout management.         | Inherits Theia’s complexity and release cadence; we must track upstream changes.               |
| Persistence & FS access       | Theia backend + Node.js FS APIs                  | Use Theia’s FileService and backend processes to read/write design files and tokens, run SD builds.      | Must handle Git merges / external edits carefully (reload prompts, conflict handling).         |
| Export tooling (optional)     | **node‑canvas / PDF libs / SVG utilities**       | Used to render high‑res PNG/PDF or SVG exports from Konva scenes in the backend.                        | Need to choose permissive libs; some (e.g. Cairo) have LGPL bits if used directly.             |
| Future rich text (post‑MVP)   | **ProseMirror / TipTap core** (MIT)              | Candidate for future rich text editing integrated as overlay/editor for text elements.                  | Must avoid AGPL collab kits; also adds complexity to the editor stack.                         |

*(Only concrete technologies actually recommended or clearly planned in the doc are listed.)*

---

## 5. Trade‑offs & Alternatives

- **Decision point:** Canvas engine – **Konva vs Fabric vs Pixi vs Paper vs Excalidraw**  
  - **Option A (Konva):** High performance, moderate features, lower memory, clean API, good React bindings; lacks built‑in rich text and SVG export.  
  - **Option B (Fabric):** Very feature‑rich (SVG import, rich editable text), but heavier, slower for large scenes, and more prone to leaks without manual cleanup.  
  - **Option C (Pixi):** WebGL powerhouse for thousands of sprites, but low‑level; missing editor‑style widgets (selection, handles, guides).  
  - **Option D (Paper):** Excellent vector maths and Boolean ops, good for art, but less optimised for large interactive scenes.  
  - **Option E (Excalidraw):** Extremely performant, ready‑made editor, but oriented to whiteboarding; extension/customisation is harder and doesn’t align well with token pipeline.  
  - **Document’s leaning:** **Konva as primary engine**, using others only as inspiration or niche future additions.  
  - **My interpretation:** aDOs v1 should treat Konva as **foundational**; switching engines later would be a major architectural change and should only be considered if Konva genuinely blocks key requirements.

- **Decision point:** State model – **Yjs vs Automerge vs ad‑hoc Redux‑style state**  
  - **Option A (Yjs):** CRDT with compact updates, undo/redo, presence, battle‑tested in collab editors.  
  - **Option B (Automerge):** CRDT as well, but heavier memory usage in benchmarks and more history overhead.  
  - **Option C (Custom/Redux):** Simple to start, but lacks collab and structured undo/redo; harder to evolve to multi‑user later.  
  - **Document’s leaning:** **Yjs** clearly preferred over Automerge and ad‑hoc models.  
  - **My interpretation:** v1 should be built as if collab will happen later: **no separate “local state” system** beyond Yjs.

- **Decision point:** Tokens pipeline – **Style Dictionary vs custom scripts**  
  - **Option A (Style Dictionary):** Standard, well‑documented, does DTCG natively, multi‑target output, Apache‑2.0.  
  - **Option B (Custom transform scripts):** More control but re‑implements a lot; higher maintenance burden and more bugs.  
  - **Document’s leaning:** Use **Style Dictionary** as the default; custom transforms only where SD needs extension.  
  - **My interpretation:** v1 should **lean fully into SD** and avoid premature custom pipelines; any special needs should be implemented as SD plugins.

- **Decision point:** Auto‑layout engine – **Yoga vs hand‑rolled constraints**  
  - **Option A (Yoga):** Stable, fast flexbox semantics, easy to align with basic Figma‑like stacks.  
  - **Option B (Custom engine):** Full control but costly to design, implement, and debug; high risk of subtle layout bugs.  
  - **Document’s leaning:** **Yoga** for the majority of layouts, with manual logic only for edge cases.  
  - **My interpretation:** aDOs v1 should **limit auto‑layout scope to what Yoga does well** and explicitly defer more exotic constraints.

- **Decision point:** Editor component – **build from primitives vs embed Excalidraw**  
  - **Option A (Own Konva‑based editor):** Maximum control over tokens integration, semantics, and agent API.  
  - **Option B (Excalidraw embed):** Faster initial integration, but harder to integrate deep token round‑tripping and custom layout logic.  
  - **Document’s leaning:** Excalidraw is treated as **inspiration and reference**, not as the core engine.  
  - **My interpretation:** v1 should **own the editor**, using Excalidraw ideas (shortcuts, feel) but not its internal data model.

---

## 6. Open Questions / Gaps

- **Question:** How rich should the **auto‑layout feature set** be in v1?  
  - **Why it matters:** Each extra constraint/option (e.g. “hug contents”, alignment per axis) increases complexity in the Yoga + Konva integration.  
  - **What evidence is missing:** A clear product decision on “minimum delightful” auto‑layout vs strict minimal flex stacks.

- **Question:** What is the **long‑term design file format** strategy (JSON vs binary Yjs snapshots vs hybrid)?  
  - **Why it matters:** JSON is Git‑friendly but verbose; Yjs binary is compact but opaque. The choice affects Git workflows, diffing, and external tooling.  
  - **What evidence is missing:** A decision on whether users are expected to inspect/merge design files in Git, or treat them as opaque artefacts.

- **Question:** How far should **design tokens** integrate with **IDE themes** vs project‑level design systems?  
  - **Why it matters:** If tokens also drive Theia’s theme, we need a clean story for applying them safely (and possibly restarting the IDE).  
  - **What evidence is missing:** Product guidance on whether tokens are primarily for **app UI** or also for **aDOs UI theming**.

- **Question:** Which **export formats** are must‑have in v1 (PNG, SVG, PDF), and at what fidelity?  
  - **Why it matters:** PDF/SVG require additional utilities and careful vector serialization; PNG is easy but flatter.  
  - **What evidence is missing:** Priority ranking of export formats for v1 vs later (e.g. “PNG only in v1” may be acceptable).

- **Question:** How to handle **external edits and Git merges** of `tokens.json` and design files while the canvas is open.  
  - **Why it matters:** External changes can race with in‑IDE edits and Yjs state, causing divergence if not managed.  
  - **What evidence is missing:** Policy decisions on who “wins” (last writer vs prompts) and UX for reload/overwrite workflows.

- **Question:** What are the **official performance budgets** for canvas complexity in v1 (max elements, frames, images)?  
  - **Why it matters:** Without explicit budgets, scope creep can silently push the stack beyond comfortable performance limits.  
  - **What evidence is missing:** A documented target (e.g. “100–200 objects per frame, 5 frames open”) that guides performance testing.

---

## 7. Implementation Hooks for the aDOs v1 Build Plan

- **Phase suggestion:** **Phase 0 – Canvas & Tokens Foundation**  
  - **What to implement:** Create a Theia front‑end widget with a basic Konva Stage + Layer, wired to a simple Yjs doc; show static shapes and a stub Tokens panel reading from a hard‑coded `tokens.json`.  
  - **Dependencies:** Theia extension skeleton; Konva + React + Yjs wired into front‑end bundle.  
  - **Risk level:** **Low–Medium** – mostly wiring and build configuration; main risk is integration friction with Theia’s front‑end.

- **Phase suggestion:** **Phase 1 – Core Canvas Interactions**  
  - **What to implement:** Tools for rectangle/ellipse/text creation; selection with Konva Transformer; move/resize/rotate; multi‑select; delete; basic keyboard shortcuts. All mutations go through Yjs, with UndoManager enabled.  
  - **Dependencies:** Phase 0 working Yjs + Konva loop.  
  - **Risk level:** **Medium** – interaction bugs and undo grouping logic need careful tuning.

- **Phase suggestion:** **Phase 1 – Design Tokens Application**  
  - **What to implement:** Tokens panel bound to a Yjs map; ability to create/edit colour/size tokens; apply tokens to element fill/stroke/text; live updates when tokens change.  
  - **Dependencies:** Phase 1 canvas interactions; DTCG token schema settled.  
  - **Risk level:** **Medium** – need a clean mapping between element style props and token references.

- **Phase suggestion:** **Phase 2 – Style Dictionary “Publish Tokens” Flow**  
  - **What to implement:** Backend Style Dictionary integration that reads `tokens.json` from Yjs/disk and emits `tokens.css` + `tokens.ts` into the workspace; command + notification UI around “Publish”.  
  - **Dependencies:** Phase 1 tokens; Theia backend RPC wiring.  
  - **Risk level:** **Medium–High** – SD config and paths can be finicky; must ensure outputs integrate nicely with real projects.

- **Phase suggestion:** **Phase 2 – Auto‑Layout Frames (Yoga)**  
  - **What to implement:** Frame type that turns a group into a Yoga layout node with direction, padding, spacing, alignment; re‑position children on change and on child resize/content change.  
  - **Dependencies:** Stable grouping and basic layout semantics; Yoga binding ready.  
  - **Risk level:** **Medium–High** – layout bugs can be subtle; need a constrained feature set to keep it manageable.

- **Phase suggestion:** **Phase 2 – Save/Load Design Files**  
  - **What to implement:** Serialization of Yjs state to a `.design` JSON (or encoded snapshot), autosave on change, and correct restore when reopening; integration with Theia’s custom editor for design files.  
  - **Dependencies:** Yjs schema stable; tokens and elements modelled cleanly.  
  - **Risk level:** **Medium** – must ensure backwards compatibility story for future schema changes.

- **Phase suggestion:** **Phase 3 – Performance & Memory Hardening**  
  - **What to implement:** Profiling typical scenes (e.g., 50–200 objects, multiple frames); set and test budgets; ensure destroyed canvases and elements are GC’d; optimise re‑renders and snapping calculations.  
  - **Dependencies:** Core features in place so realistic workloads exist.  
  - **Risk level:** **Medium** – mostly engineering discipline and profiling rather than conceptual risk.

- **Phase suggestion:** **Phase 3 – Agent/Automation API**  
  - **What to implement:** Define and expose a `DesignCanvasService` (or similar) with methods for reading state, mutating elements/tokens, and subscribing to events; document it for AI/automation workflows.  
  - **Dependencies:** Yjs schema and canvas interactions stable; no major model churn expected.  
  - **Risk level:** **Medium–High** – API design decisions will be hard to change later; needs thoughtful scoping.

These hooks make it straightforward to slot this track into the global `aDOs-v1-BUILD_PLAN.md`, align it with other tracks (packaging, command palette, security), and hand off concrete, phased tasks to coding agents or human devs.
