# Deep Research Summary — App Packaging & Distribution

## 1. Scope & Goal

- This track covers **how aDOs is packaged, signed, updated, and distributed** across Windows, macOS, Linux, and optionally as a web IDE.
- It defines the **base tech stack** (Theia Blueprint + Electron), **installer formats**, **auto-update mechanism**, **code-signing strategy**, **security posture in Electron**, and **licence/compliance approach**.
- Primary goals for aDOs v1 (from the doc):
  - Ship a **cross-platform Electron desktop IDE** built on **Eclipse Theia Blueprint (“Theia IDE”)**.
  - Provide **auto-updates** via **electron-updater** using **GitHub Releases** channels (alpha/beta/stable).
  - Ensure **trustworthy installers** through **EV code signing on Windows** and **Apple notarisation on macOS**.
  - Fit a **typical Windows 11 machine with 8 GB RAM**, by trimming heavy Theia extensions.
  - Stay **licence-compliant** (EPL-2.0 for Theia, MIT for Electron, etc.) with a clear **Third-Party Notices** file.
  - Maintain **strong security** via Electron isolation and signed update verification.
- Explicit non-goals for v1 (from doc or clearly implied):
  - No **custom updater from scratch** – reuse Theia Blueprint + electron-builder/updater.
  - No **runtime extension marketplace** for MVP (OpenVSX UI stays off).
  - No **telemetry by default** – only potential opt-in analytics later.
  - No **DRM/Widevine** unless a concrete use-case appears.
  - No **enterprise MSI installer** in v1; NSIS is sufficient initially.

---

## 2. Key Recommendations (Architecture & Design)

- **Recommendation:** Base aDOs on **Eclipse Theia Blueprint (“Theia IDE”)** rather than vanilla Theia.  
  - **Reasoning (from doc):** Blueprint already includes **Electron packaging, auto-update, installer configs, and branding hooks**, avoiding “reinventing packaging from scratch”. A fallback to vanilla Theia + custom Yeoman scaffold is noted, but would require re-implementing updater/installers.  
  - **Impact on aDOs v1:** aDOs should **fork Theia Blueprint** and treat it as the **canonical app shell**, carrying a maintained fork forward and periodically merging upstream Theia releases.

- **Recommendation:** Use **Electron + electron-builder** (NSIS on Windows, DMG on mac, AppImage on Linux) as the primary packaging tool.  
  - **Reasoning (from doc):** electron-builder is **integrated into Theia’s build**, outputs **cross-platform installers**, and supports **auto-update channels, differential updates, and code-sign automation**.  
  - **Impact on aDOs v1:** The packaging pipeline for v1 is **electron-builder-centric**; no competing packaging stack should be introduced unless electron-builder actually becomes untenable.

- **Recommendation:** Implement **auto-updates via electron-updater + GitHub Releases** with multiple channels.  
  - **Reasoning (from doc):** GitHub Releases provides a **simple hosting backend**; electron-updater can use **alpha/beta/stable channels**, supports staged roll-outs, and verifies signed update artefacts.  
  - **Impact on aDOs v1:** aDOs must ship with a **channelled update feed** and a **rollback-friendly release process** (keeping previous versions available).

- **Recommendation:** Enforce a **strict Electron security model** (contextIsolation, no Node in renderers, CSP, https-only).  
  - **Reasoning (from doc):** The doc prescribes **contextIsolation = true**, **no nodeIntegration in renderers**, a **strict CSP** that only loads local app files and approved domains for extensions, and using **shell.openExternal** for web links. Theia’s frontend/backend split is used so the UI runs in a **sandboxed JS context**.  
  - **Impact on aDOs v1:** Security expectations are **baked into the architecture**: all renderer code is treated as untrusted UI; OS/file access is centralised in the backend; any deviation must be treated as an exception and reviewed.

- **Recommendation:** Ship a **minimal, curated extension set** and **disable OpenVSX/extension marketplace** by default.  
  - **Reasoning (from doc):** Heavy or unused extensions (e.g. `@theia/memory-inspector`, `@theia/timeline`) should be removed to keep startup & memory lean; `@theia/vsx-registry` should be removed to prevent runtime extension installs; instead, a **curated list of VS Code extensions** is bundled via `theiaPlugins` with **pinned Open VSX URLs**.  
  - **Impact on aDOs v1:** The extension model for v1 is **“bundled only, pinned versions”**; no in-IDE marketplace. This directly affects UX and security assumptions elsewhere (e.g. command palette, config).

- **Recommendation:** Optimise for **8 GB RAM** via lazy-loading and performance monitoring.  
  - **Reasoning (from doc):** 8 GB is considered “modest for an IDE”; Theia’s plugin system supports **lazy loading**; Theia’s metrics and profiling tools can monitor memory and catch regressions.  
  - **Impact on aDOs v1:** Memory profiling, lazy loading of heavy language servers, and periodic perf checks **must be treated as core engineering work**, not nice-to-have.

- **Recommendation:** Use **GitHub Actions** as the unified CI/CD platform (desktop + Docker).  
  - **Reasoning (from doc):** A sample `release.yml` shows a **matrix build** per OS (Win/macOS/Linux), packaging via electron-builder, publishing to **GitHub Releases**, and optionally pushing Docker images. It also sketches integration of signing via secrets/Azure Trusted Signing.  
  - **Impact on aDOs v1:** CI/CD design should centre on **one GitHub Actions workflow per tagged release**, handling build, sign, upload, and Docker publish – no ad-hoc scripts sprinkled elsewhere.

- **Recommendation:** Provide an **optional web distribution** via Node.js backend + Docker image.  
  - **Reasoning (from doc):** The same Theia app can be run as a **web IDE** using Theia’s backend with a **Docker image**, sharing code and extension set with the desktop app.  
  - **Impact on aDOs v1:** The codebase should be structured so the **desktop and web builds share extensions and configuration**, enabling a later “web mode” with minimal divergence.

- **Recommendation:** Maintain a **Bill of Materials (BOM)** and Third-Party Notices with licence texts.  
  - **Reasoning (from doc):** Theia core is **EPL-2.0 / GPLv2+Classpath**, Electron is **MIT**, VS Code extensions have varied licences, and numerous npm deps exist. The doc explicitly calls for `yarn licenses list --json` or `license-checker` plus a **THIRD-PARTY-NOTICES.txt** with licence texts and a clear statement like “aDOs IDE is based on Eclipse Theia (c) Eclipse Foundation, licensed under EPL-2.0”.  
  - **Impact on aDOs v1:** **Licence compliance is not optional:** BOM generation, notices, and clear attribution must be integrated into the release pipeline.

---

## 3. Non-Negotiable Constraints

- **Constraint:** aDOs must be built on **Eclipse Theia Blueprint / Theia IDE**.  
  - **Source:** Executive summary & “Recommended Path” explicitly specify using Theia Blueprint as the starting point, with vanilla Theia as a fallback only if necessary.  
  - **Implication for implementation:** All packaging, extension configuration, and build scripts **assume a Theia Blueprint fork**; choosing a different base would invalidate much of this plan.

- **Constraint:** **Electron + electron-builder** is the standard packaging pipeline.  
  - **Source:** Multiple sections state electron-builder (with NSIS, DMG, AppImage) as the primary tool, with Electron Forge only as a mitigation if maintenance degrades.  
  - **Implication for implementation:** v1 must **not split effort across multiple packagers**; engineering effort should deepen electron-builder integration (config, signing, auto-update) rather than exploring alternative tooling.

- **Constraint:** **Strong Electron security posture** is mandatory.  
  - **Source:** “Security & Privacy” section mandates `contextIsolation = true`, no Node in renderers, strict CSP, https-only resources, `shell.openExternal` for links, and signed update verification.  
  - **Implication for implementation:** Any feature that requires breaking these assumptions (e.g. Node in renderer) should be treated as **exceptional, high-risk work** requiring explicit review.

- **Constraint:** **No runtime extension marketplace** in MVP; **curated, pinned extensions only**.  
  - **Source:** Guidance to remove `@theia/vsx-registry`, disable runtime extension installs, and instead bundle a curated set via `theiaPlugins` with fixed Open VSX URLs; OpenVSX re-enablement is listed as a future/conditional step.  
  - **Implication for implementation:** The UX, docs, and command palette should assume **users can’t freely install extensions**; any marketplace UI belongs firmly in a later phase.

- **Constraint:** Target **8 GB RAM** as a supported baseline.  
  - **Source:** Exec summary and performance section explicitly optimise for an 8 GB Windows 11 machine, with lazy loading and perf monitoring.  
  - **Implication for implementation:** Languages, plugins, and features must be chosen and tuned so a **typical workflow remains usable at 8 GB**; heavy stacks may require explicit warnings or alternative setups.

- **Constraint:** **Licensing and attribution** for Theia, Electron, and extensions must be honoured.  
  - **Source:** “Bill of Materials” and legal risk sections detail EPL-2.0 obligations, MIT, Apache, and issues with GPL extensions.  
  - **Implication for implementation:** v1 must contain **BOM generation**, **THIRD-PARTY-NOTICES**, and must **avoid bundling GPL/AGPL extensions** unless you’re ready for the legal consequences.

- **Constraint:** **Code-signed installers & updates** are required for public distribution.  
  - **Source:** Code signing sections mandate EV cert for Windows and Apple notarisation, with clear mitigations if EV isn’t available yet.  
  - **Implication for implementation:** Release pipeline cannot be considered “complete” until **EV/Apple signing and notarisation paths are working** or a documented preview-only exception is in place.

---

## 4. Components, Libraries & OSS Repos

| Component / Role                      | Recommended Tech / Repo                              | Why it’s recommended (from doc)                                                                                          | Risks / Caveats                                                                                          |
|--------------------------------------|------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| IDE foundation & template            | **Eclipse Theia Blueprint / Theia IDE** (`eclipse-theia/theia-blueprint`) | Provides **ready-made Electron app**, auto-update, installer configs, branding, and extension wiring.                   | Inherits Theia release cadence; upstream changes must be tracked and periodically merged.               |
| Core IDE framework                   | **Eclipse Theia** core (`@theia/*`)                  | Modern, extensible IDE framework; supports desktop & web modes; used as the logical core.                               | Licenced under EPL-2.0 / GPLv2+CE; must meet EPL obligations and avoid incompatible GPL combinations.   |
| Desktop runtime                      | **Electron**                                         | Standard JS-based desktop shell; integrated with Theia; supports cross-platform builds.                                 | Electron security pitfalls if isolation is misconfigured; large runtime (~150 MB).                      |
| Packager / installer builder        | **electron-builder**                                 | Integrated with Blueprint; supports NSIS, DMG, AppImage; auto-update channels; code-sign automation.                    | Maintainer reduced activity; may require future migration to Electron Forge if project further stagnates.|
| Auto-update engine                   | **electron-updater**                                 | Simple integration with GitHub Releases channels; supports delta updates and staged rollouts.                           | Misconfig can cause update failures; must handle rollback and staging carefully.                        |
| Windows installer backend            | **NSIS** (via electron-builder)                      | Default Windows installer technology; supports one-click install and silent / enterprise modes.                         | MSI is not generated by default; MSI support would require extra config (WiX/Squirrel) if needed later. |
| CI/CD platform                       | **GitHub Actions**                                   | First-class integration with GitHub repos; sample workflow provided for 3-OS matrix builds and release publication.     | Requires careful secrets management for signing keys and Azure integration.                             |
| Windows signing service (optional)   | **Azure Trusted Signing**                            | Enables cloud-based EV signing without exposing private keys on CI runners.                                             | Azure setup complexity; Azure-specific lock-in for signing pipeline.                                    |
| Extension marketplace backend        | **Open VSX**                                         | Source of VS Code-compatible extensions; allows pinned version URLs.                                                    | Disabled in MVP (no in-app marketplace); if re-enabled, becomes a security/stability surface.           |
| Web/remote distribution             | **Docker + Node.js** (Theia backend image)           | Allows running the same IDE as a web app; shares configuration and extension set with desktop.                          | Web deployment adds server-side attack surface and operational overhead.                                |
| Licence/BOM tooling                  | `yarn licenses list --json` / **license-checker**     | Used to generate list of production dependencies and licences for THIRD-PARTY-NOTICES.                                  | Needs to be kept in sync with dependency updates; misconfiguration can miss some transitive deps.       |
| Metrics & performance                | **Theia metrics / profiling tools** (Prometheus-style) | Built-in support to instrument backend memory/perf and profile startup and extension behaviour.                          | Requires intentional setup and monitoring; if ignored, perf regressions will sneak into releases.       |

*(Only concrete technologies and repos clearly mentioned or strongly implied by the document are included.)*

---

## 5. Trade-offs & Alternatives

- **Decision point:** Base template – **Theia Blueprint vs vanilla Theia + custom packaging**  
  - **Option A (Blueprint):** Reuse existing Electron app, updater, installers, branding hooks. Fastest path, minimal reinvention.  
  - **Option B (Vanilla Theia):** Use Theia platform with a custom `package.json` and generator; more control but must rebuild updater and installers.  
  - **Document’s leaning:** Clearly towards **Blueprint** as default; vanilla Theia is an explicit fallback.  
  - **My interpretation:** aDOs v1 should **standardise on Blueprint** and only consider vanilla Theia if there is a hard blocker (licensing or technical) that cannot be resolved via the fork.

- **Decision point:** Packager – **electron-builder vs Electron Forge**  
  - **Option A (electron-builder):** Mature, feature-complete (cross-platform, differential updates, signing integration), used by Theia today.  
  - **Option B (Electron Forge):** More actively maintained but less feature-rich and not integrated into Theia’s current scripts.  
  - **Document’s leaning:** **Stick with electron-builder**, while monitoring its stability and keeping Forge as a future fallback.  
  - **My interpretation:** For v1, **don’t split efforts** – lean fully into electron-builder, but architect configuration so a later migration is feasible (e.g. centralise build config).

- **Decision point:** Windows code signing – **EV vs OV/self-signed**  
  - **Option A (EV cert):** Provides immediate SmartScreen trust, professional UX, and is recommended for aDOs.  
  - **Option B (OV/self-signed interim):** Can ship preview builds earlier; will show warnings and is suitable only for testing/early adopters.  
  - **Document’s leaning:** **EV is the goal**, with OV/self-signed as temporary mitigation if EV delays would block launch.  
  - **My interpretation:** Treat EV as **required for general public release**; OV/self-signed is strictly for *internal/early preview* phases.

- **Decision point:** Extension installation – **bundled-only vs user-installable marketplace**  
  - **Option A (bundled only, OpenVSX disabled):** Better stability, security, and reproducibility; fits 8 GB target.  
  - **Option B (marketplace enabled):** More flexibility for users, but higher risk (malicious/incompatible extensions) and harder to support.  
  - **Document’s leaning:** **MVP = bundled only**, with OpenVSX re-enablement and potential curation as a future feature.  
  - **My interpretation:** aDOs v1 should **fully commit** to the curated-bundle model; the moment you enable a marketplace, you are in a different complexity class.

- **Decision point:** Enterprise packaging – **NSIS only vs NSIS + MSI**  
  - **Option A (NSIS only):** Simpler; NSIS can run in silent mode and enterprises can repackage into MSI if needed.  
  - **Option B (Native MSI):** More enterprise-friendly out of the box (via WiX or Squirrel) but adds build complexity.  
  - **Document’s leaning:** Stick with **NSIS initially**, consider MSI only if enterprise demand appears.  
  - **My interpretation:** MSI support should be treated as **explicitly out of scope for v1** unless there’s a concrete enterprise deployment requirement.

---

## 6. Open Questions / Gaps

- **Question:** Do we need **DRM/Widevine** support for protected video?  
  - **Why it matters:** Enables certain media or browser-style features from inside the IDE; adds complexity to Electron configuration.  
  - **What evidence is missing:** Concrete product use-cases requiring DRM; none are assumed in the doc (it calls this “unlikely”).

- **Question:** Should aDOs expose a **plugin marketplace UI** for user-installed extensions in a later phase?  
  - **Why it matters:** Impacts security model, UX, support load, and extension compatibility testing.  
  - **What evidence is missing:** Product decision on extension freedom vs curated stability; the doc only notes that MVP keeps OpenVSX off and suggests possible future curation.

- **Question:** Is an **enterprise MSI installer** actually required for the target market?  
  - **Why it matters:** Affects installer tech (NSIS vs WiX/Squirrel) and CI/CD complexity; may block adoption in some corporate environments.  
  - **What evidence is missing:** Real enterprise requirements from target users; current assumption is that silent NSIS + IT repackaging is enough.

- **Question:** What level of **telemetry/analytics** is acceptable, if any?  
  - **Why it matters:** Influences privacy stance, legal review, and architecture for metrics collection.  
  - **What evidence is missing:** Product & legal decision on whether opt-in usage stats (e.g. extension usage) are desired; doc assumes opt-in only but leaves implementation open.

- **Question:** Exact **OS support matrix** (Windows versions, macOS versions, Linux distros/glibc minimum).  
  - **Why it matters:** Determines testing matrix, documented system requirements, and troubleshooting scope.  
  - **What evidence is missing:** A formal support policy; doc gives examples (Win 11, recent macOS on Intel/M1, Ubuntu LTS + maybe Fedora) but no final list.

- **Question:** How strictly do we want to **pin dependency versions** (Theia, Electron, extensions) vs staying near latest?  
  - **Why it matters:** Tighter pinning improves stability but slows adoption of upstream fixes/features; looser pinning increases breakage risk.  
  - **What evidence is missing:** Release cadence targets and risk appetite; doc recommends pinning and cautious upgrades but doesn’t fix a schedule.

---

## 7. Implementation Hooks for the aDOs v1 Build Plan

- **Phase suggestion:** **Phase 0 – Foundation**  
  - **What to implement:** Fork Theia Blueprint, strip unused Theia extensions, add aDOs-specific branding and minimal curated `theiaPlugins`.  
  - **Dependencies:** None beyond Git/GitHub and base dev environment.  
  - **Risk level:** **Low** – mostly configuration and branding; main risk is mis-removing extensions and breaking menus.

- **Phase suggestion:** **Phase 1 – Core Packaging & Local Builds**  
  - **What to implement:** Configure electron-builder (`appId`, NSIS defaults, artefact names), get `yarn build` and `yarn electron package` producing working installers on Windows (and optionally macOS/Linux).  
  - **Dependencies:** Phase 0 fork and minimal app working in dev mode.  
  - **Risk level:** **Medium** – packaging configs can be finicky; cross-platform issues may surface.

- **Phase suggestion:** **Phase 1 – Security Hardening**  
  - **What to implement:** Enforce Electron security settings (contextIsolation, no nodeIntegration, strict CSP), ensure all renderer-side code respects these constraints, and verify update signature checks.  
  - **Dependencies:** Basic Electron app is up and running.  
  - **Risk level:** **Medium** – any hidden dependency on Node in renderer may require refactors.

- **Phase suggestion:** **Phase 2 – Auto-Update & Channels**  
  - **What to implement:** Integrate electron-updater with GitHub Releases, set up alpha/beta/stable channels, and implement staged roll-out configuration (e.g. `stagingPercentage`).  
  - **Dependencies:** Working packaging + GitHub Releases workflow.  
  - **Risk level:** **High** – faulty updates can brick user installs; must be tested carefully.

- **Phase suggestion:** **Phase 2 – CI/CD Pipeline**  
  - **What to implement:** GitHub Actions `release.yml` for matrix builds, artefact upload, and basic release publishing; include steps for Docker image build/push.  
  - **Dependencies:** Local packaging process stabilised.  
  - **Risk level:** **Medium** – secrets management and multi-OS build reliability need attention.

- **Phase suggestion:** **Phase 3 – Code Signing & Notarisation**  
  - **What to implement:** EV certificate integration on Windows (local & CI via Azure Trusted Signing or self-hosted runner), Apple Developer ID signing and notarisation via `afterSign` script.  
  - **Dependencies:** CI/CD in place; certificates obtained.  
  - **Risk level:** **High** – misconfigured signing breaks installers or updates; security implications if keys are mishandled.

- **Phase suggestion:** **Phase 3 – Performance Budget & Monitoring**  
  - **What to implement:** Define and test typical workflows on 8 GB machines, set target memory/CPU budgets, enable Theia metrics/profiling, and add automated perf checks in CI.  
  - **Dependencies:** Core IDE experience stable enough to benchmark.  
  - **Risk level:** **Medium** – requires discipline to maintain over time, but technically straightforward.

- **Phase suggestion:** **Phase 4 – Optional Web IDE & Docker Image**  
  - **What to implement:** Package Theia backend into a Docker image, expose web frontend, and ensure extension set & configuration matches the desktop IDE where sensible.  
  - **Dependencies:** Desktop app architecture stable; security model adapted for web deployment.  
  - **Risk level:** **Medium–High** – introduces a server-side attack surface and operational complexity.

These hooks should make it straightforward to drop this track into an overall `aDOs-v1-BUILD_PLAN.md` with phases, milestones, and task breakdowns.
