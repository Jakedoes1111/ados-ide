# aDOs Deep Research — Track 06: Knowledge Layer

> Synthesis summary of the **“06_Knowledge Layer”** deep research document. Treat this as the canonical one‑page view when planning or implementing the knowledge system in aDOs.

---

## 1. Track purpose & scope

- Design **how aDOs stores, searches, and relates knowledge** (notes, tasks, flows, canvas objects) on an **offline 8 GB desktop**.
- Choose a storage + index architecture that is:
  - **Local‑first, human‑readable, durable, agent‑friendly**, and **not tied to any cloud service**.
- Specify:
  - The **file model** (Markdown + front‑matter).
  - The **graph model** (links and typed relations).
  - Text + vector **search strategy**.
  - A **query language** (Dataview‑style).
  - APIs, performance, security, migration, and a **minimal 2‑week implementation plan**.

---

## 2. Core architecture decisions

### 2.1 Source of truth

- **Primary storage:** Plain **Markdown files** with **YAML front‑matter** in a vault directory.
- **Secondary index:** A **single local SQLite DB** per vault for:
  - Metadata (front‑matter),
  - **Full‑text search** (FTS5),
  - **Knowledge graph** (nodes + edges),
  - **Vector embeddings** (via SQLite vector extension like `sqlite-vec` / VSS).

Markdown remains the **only authority**; the DB is a **rebuildable cache/index**, so there is **no lock‑in** and corruption is recoverable.

### 2.2 Rejected designs

- **Markdown + external search engine** (Meilisearch/Typesense):
  - Pros: richer fuzzy search.
  - Cons: bigger footprint (≈8× storage), separate service, more RAM and maintenance.
- **Markdown + dedicated graph DB** (Neo4j, Datalog store):
  - Pros: strong graph querying for massive/deep graphs.
  - Cons: heavy server, JVM or extra runtime, overkill for ~10k notes / ~0.5M links.
- Therefore, **Design A wins:** **Markdown + SQLite (FTS + graph + vectors)**.

---

## 3. File model — Markdown + YAML front‑matter

Each knowledge item = one `.md` file with normal Markdown body and standardised YAML fields, e.g.:

```yaml
---
id: "20231114-6ZQ84X"           # stable unique ID
title: "Project Alpha Plan"     # may differ from filename
created: 2023-10-01T09:00:00Z
updated: 2025-11-14T06:00:00Z
tags: [project, alpha, planning]
type: note                      # note | task | canvas | flow | ...
status: open                    # for tasks
due: 2025-11-20                 # for tasks
assignees: ["alice", "bob"]     # for tasks
links:
  - "20231005-X1Y2Z3"           # explicit outgoing links (by ID)
sources:
  - "https://example.com/spec"
summary: "Short one‑line description"
---
```

Key points:

- **`id`** is required and stable; generated on import if missing.
- YAML is **system‑managed but user‑visible**; users can edit fields if they want power‑user behaviour.
- Arbitrary extra fields are allowed and stored as JSON in the DB for queryability.
- **Content‑level links** (`[[Wiki Links]]`, headings, block links) are parsed and turned into edges.

---

## 4. Graph design — nodes & edges in SQLite

### 4.1 Tables

- `nodes`:
  - `id TEXT PRIMARY KEY` (YAML id),
  - `title TEXT`,
  - `type TEXT`,
  - `created TEXT`, `updated TEXT`,
  - `properties JSON` (full front‑matter).

- `edges`:
  - `id INTEGER PRIMARY KEY`,
  - `source_id TEXT NOT NULL`,
  - `target_id TEXT NOT NULL`,
  - `type TEXT NOT NULL` (e.g. `ref`, `relates_to`, `blocks`, `duplicate_of`),
  - `properties JSON` (optional context, e.g. quote).
  - Indexed on `source_id`, `target_id`, `type`.

### 4.2 Behaviour

- **Wiki links** (`[[Note]]`) → edges of type `ref` from source → target.
- **Typed YAML relations** (e.g. `blocks`, `duplicates`) → edges of specific types.
- **Backlinks** are derived via `edges.target_id = id` (no need to store in file).
- Graph queries (neighbourhood, transitive closure, shortest path) use **recursive CTEs** in SQLite or shallow traversals in code.
- Scale target: **≈10k notes**, **≈0.5M edges** — easily handled by indexed SQLite on 8 GB RAM.

---

## 5. Search & embeddings

### 5.1 Full‑text search (FTS5)

- Use **SQLite FTS5** virtual table `notes_fts` indexing:
  - `title`, `body`, optionally tags and summary.
- Properties:
  - Very **compact index** (tens of MB for tens of thousands of docs).
  - Sub‑100ms queries on local data.
  - Supports phrase, boolean, prefix queries and ranked results.
- Updates:
  - On note save, re‑index that note in a single transaction (`INSERT OR REPLACE`).

### 5.2 Semantic search (vectors)

- Use **SQLite vector extension** (e.g. `sqlite-vec` / VSS):
  - Table like `embeddings(node_id TEXT, embedding VECTOR(384))`.
  - k‑NN search by cosine/L2 distance.
- **Embedding model:**
  - Local **small 384‑dim** model (e.g. BGE‑small or MiniLM‑L6‑v2), **CPU‑only**, optionally quantised.
  - Memory ≈100–150 MB, suitable for 8 GB laptops.
- Index strategy:
  - Embed notes (or chunks) in background worker.
  - Store vectors in SQLite; brute‑force search is fine for **≤100k vectors**.
- Used for:
  - **Semantic search** in UI.
  - **RAG context retrieval** for agents (knowledge‑aware assistants).

---

## 6. Query layer — Dataview‑style aQL

Introduce a **lightweight query language** (aQL), inspired by Obsidian Dataview:

- Core constructs:
  - `FROM` — pick a source set (tag, type, folder).
  - `WHERE` — filter by fields (`status`, `due`, `tags`, etc.) and links.
  - `SORT BY` — sort results.
  - Output modes: `LIST`, `TABLE`, later `GRAPH`.

Examples:

1. **Tasks due this week for a project:**

   ```text
   LIST FROM #task
   WHERE status = "open"
     AND due >= date(2025-11-14)
     AND due <  date(2025-11-21)
     AND [[Project Alpha Plan]] in file.outlinks
   ```

2. **Open urgent tasks sorted by due date:**

   ```text
   TABLE title, due
   FROM #task
   WHERE status = "open" AND contains(tags, "urgent")
   SORT BY due
   ```

3. **Notes with >5 backlinks created this month:**

   ```text
   LIST
   WHERE created >= date(2025-11-01)
     AND created <  date(2025-12-01)
     AND length(file.inlinks) > 5
   ```

- Implementation: parse aQL → compile to SQL against `nodes`, `edges`, `notes_fts`, and JSON properties.
- Agents can call `query(q)` to get structured JSON results.

---

## 7. Collaboration & sync

- **MVP:** single‑user, local‑first; **no CRDT/real‑time collaboration**.
- Recommended approach for multi‑device in v1:
  - Store vault in **Git** or a **cloud‑synced folder** (Dropbox/OneDrive/etc.).
  - Use existing diff/merge tools; aDOs can provide a nicer diff viewer.
- CRDTs (Yjs/Automerge) are **explicitly deferred** to a later version due to:
  - Complexity, memory overhead, and risk of weird merges in structured YAML.
- Design is CRDT‑ready: plaintext files + stable IDs mean we can later plug in CRDT for the editor without redesigning storage.

---

## 8. APIs & URI scheme

### 8.1 Core APIs (conceptual)

- `getNote(id) -> Note`
- `createNote(metadata, content) -> id`
- `updateNote(id, metadataDelta?, contentDelta?) -> Note`
- `deleteNote(id)`
- `listBacklinks(id) -> [NoteRef]`
- `search(query, mode="text"|"semantic") -> [Result]`
- `query(aql) -> QueryResult`
- Graph helpers: `neighborhood(id, depth)`, `findPath(start, end, maxDepth)`.
- Embedding maintenance: `updateEmbeddings(id)` (usually automatic).

### 8.2 Agent guardrails

- Agents are **read‑capable, write‑restricted**:
  - To modify content they must call:
    - `agentProposeEdit(id, newContent|patch) -> diff`
  - UI shows diff; only **user approval** triggers actual `updateNote`.
- All agent actions are **logged** (who, when, which note, what diff).

### 8.3 URI scheme

- Register **`ados://`** links:
  - `ados://note/<id>` → open note.
  - `ados://note/<id>#<anchor>` → open note at heading/block.
  - `ados://task/<id>` → open task.
- Used for:
  - Internal links, canvas objects, automations, and external deep‑linking.

---

## 9. Performance model (8 GB target)

Goals:

- Index **≈10k notes** + **0.5M links** with:
  - Initial indexing in **seconds–minutes**.
  - Typical queries in **<100 ms**.
- Strategies:
  - Use **WAL mode** + batched transactions.
  - **File watcher + debounced indexer**:
    - On file save: re‑parse YAML, update node, FTS, edges, and mark for re‑embedding.
  - **Background worker** for embeddings to avoid UI stalls.
  - Tune SQLite cache size; avoid loading entire vault in memory.
  - **Lazy graph rendering** (e.g. show local neighbourhood, not full graph by default).
- Provide **“Reindex vault”** command for self‑healing if anything drifts.

---

## 10. Security & privacy

- **Vault isolation:** each vault has its own DB; no cross‑vault access by default.
- **Encryption:**
  - Encourage OS‑level disk encryption for v1.
  - Design leaves room for future **SQLCipher** / vault‑level encryption.
- **Sensitive data & embeddings:**
  - Optional **redaction rules** (regex‑based) before embedding to strip secrets (API keys, passwords).
  - YAML flag like `embedding: false` to **exclude notes from vector index**.
- **Agent sandbox:**
  - Agents use only the **knowledge‑layer APIs** (no raw FS/network).
  - Fine‑grained scopes possible later (e.g. agent can only read notes with certain tags).
- **No telemetry by default;** all data and indexes stay on device.
- **Audit log** for agent‑initiated changes and critical operations.

---

## 11. Migration & implementation

### 11.1 Migration

- **Obsidian / plain Markdown:**
  - Scan `.md` files; parse existing YAML if present.
  - If no `id`, generate one and (optionally) write back into YAML.
  - Build `nodes`, `edges`, `notes_fts` and embeddings.
  - Respect Obsidian `[[Wiki Links]]`; map names → IDs without breaking compatibility.
- **Notion exports:**
  - Import Markdown pages like any note.
  - Optionally convert CSV database exports into task/record notes with YAML fields.

### 11.2 2‑week implementation outline (knowledge‑layer slice)

1. **Days 1–2 – Schema & scanner**
   - Create SQLite schema (`nodes`, `edges`, FTS table).
   - Implement initial vault scan → nodes + edges.

2. **Day 3 – YAML & metadata**
   - Robust front‑matter parsing; map fields into JSON properties.

3. **Day 4 – Link parsing & graph**
   - Extract wiki/YAML links; populate `edges`; test backlinks.

4. **Day 5 – FTS integration**
   - Add FTS5 index, populate, and expose basic text search.

5. **Day 6 – aQL query engine**
   - Implement minimal parser + SQL compilation; support key examples.

6. **Day 7 – Vector search**
   - Integrate `sqlite-vec`/VSS + small embedding model; basic semantic search.

7. **Day 8 – APIs & agent diff flow**
   - Expose CRUD/search/query APIs; implement `agentProposeEdit` + diff.

8. **Day 9 – Tests & integrity checks**
   - Fixtures for 1k–5k notes; test indexing, queries, migrations, reindex.

9. **Day 10 – Perf tuning & docs**
   - Measure P50/P95 latencies; tweak pragmas; document schemas & usage.

---

## 12. Decision record (ADR) — Why Markdown + SQLite

- **Chosen:** Markdown files + YAML front‑matter as source of truth, with **SQLite** for:
  - Metadata & graph (`nodes`/`edges`),
  - Full‑text search (FTS5),
  - Vector search (sqlite‑vec/VSS).
- **Rejected:**
  - Meilisearch/Typesense/Elastic: heavier, separate service, more RAM/storage, not ideal for offline single‑user app.
  - Neo4j/graph DB: unnecessary complexity and footprint for expected scale.
- **Rationale:**
  - Fits **local‑first, offline, transparent** ethos of aDOs.
  - Users always retain **plain‑text, tool‑agnostic** data.
  - Single embedded DB keeps footprint tiny but supports:
    - fast search,
    - flexible graph queries,
    - modern semantic retrieval,
    - and safe agent interactions.

Use this as the canonical “06_Knowledge Layer” summary when building the global aDOs synthesis doc, architecture diagrams, and BUILD_PLAN.
