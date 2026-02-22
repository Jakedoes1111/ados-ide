# aDOs IDE

**A local, AI-augmented IDE and mini-OS for cognitive development**

aDOs IDE is a desktop application that combines the power of a modern IDE with AI agents, visual automation flows, an embedded browser, knowledge management, and an infinite canvas—all running locally on your machine with privacy and offline-first principles.

---

## What is aDOs IDE?

aDOs IDE is a unified workspace that brings together:

- **🔧 Full-featured IDE** - Based on Eclipse Theia, with file editing, terminals, Git integration, and code intelligence
- **🤖 AI Agents** - Local AI agents that can read/write files, browse the web, edit code, and interact with your workspace—all with explicit permissions and human oversight
- **🔄 Visual Flows** - Node-based automation editor (like n8n) for building reusable workflows that connect files, HTTP, browser actions, and agents
- **🌐 Embedded Browser** - Tabbed browser with profile isolation, history, bookmarks, and automation capabilities
- **📝 Knowledge Layer** - Markdown-based note vault with full-text search, link graphs, and backlinks—powered by SQLite
- **🎨 Infinite Canvas** - Figma-style canvas for diagrams, mind maps, and visual planning with design token support
- **⌨️ Command Palette** - Raycast-style unified command interface accessible via keyboard shortcuts

All of this runs **locally** on your machine—no cloud required, no telemetry, no auto-updates. Your data stays yours.

---

## Key Features

### Privacy & Security First
- **Offline-first**: All core functionality works without internet
- **No telemetry**: Zero outbound analytics or tracking
- **Capability-based permissions**: Every tool and agent action requires explicit scopes and user approval
- **Audit logging**: Full trail of all privileged actions
- **Hardened Electron**: Sandboxed renderers, context isolation, no Node in web content

### AI-Augmented Development
- **MCP Tool Bus**: Model Context Protocol-based tool system for safe agent interactions
- **Human-in-the-loop**: All file writes show diffs before applying
- **Scoped capabilities**: Agents can only access what you explicitly grant
- **Local execution**: All agent processing happens on your machine

### Unified Workspace
- **Command Palette**: Single entry point for commands, files, flows, and actions (Ctrl+Shift+P)
- **Knowledge Graph**: Link notes, documents, and code together with backlinks and graph queries
- **Visual Automation**: Build flows that connect files, HTTP, browser, notes, and agents
- **Canvas Workspace**: Visual planning and diagramming integrated into your workflow

---

## Target Platform

**v1 Focus**: Linux, Windows, and macOS desktop environments

- Performance optimized for mainstream developer laptops/desktops (integrated graphics, 8-16GB RAM)
- Cross-platform parity is a release priority across Linux, Windows, and macOS
- Web builds remain out of scope for v1
- Electron-based desktop application

---

## Architecture

aDOs IDE is built on:

- **Eclipse Theia** - Extensible IDE platform
- **Electron** - Desktop application framework
- **SQLite + Markdown** - Data persistence and knowledge storage
- **MCP (Model Context Protocol)** - Tool orchestration for agents
- **React + TypeScript** - Frontend framework
- **Yjs** - CRDT-based collaboration primitives (for canvas)

### Core Subsystems

1. **Command Palette** - Unified keyboard-first control surface
2. **Canvas Engine** - Infinite canvas with design tokens
3. **Visual Flows** - Node-based automation editor
4. **Browser + CDP** - Embedded browser with automation
5. **Agents & MCP Tool Bus** - AI orchestration with capability model
6. **Knowledge Layer** - Markdown vault + SQLite search
7. **Security & Permissions** - Capability-based access control

---

## Development Status

**Current Phase**: Phase 0-1 (Foundations & Core Shell)

See [BUILD_PLAN.md](BUILD_PLAN.md) for detailed development roadmap and [BUILD_LOG.md](BUILD_LOG.md) for progress updates.

### Completed
- ✅ Theia Blueprint fork and Electron setup
- ✅ Security hardening (contextIsolation, sandbox)
- ✅ aDOs branding and packaging configuration
- ✅ Command palette extension structure
- ✅ Knowledge layer backend architecture

### In Progress
- 🔄 Frontend webpack build optimization
- 🔄 Knowledge layer SQLite integration
- 🔄 Command palette enhancements

---

## Getting Started

### Prerequisites

- **Node.js**: >= 20
- **Yarn**: >= 1.7.0 < 2
- **OS**: Linux, Windows, or macOS
- **8GB+ RAM** recommended (16GB preferred for heavy flows/agents/browser usage)

### Building from Source

```bash
# Install dependencies
yarn install

# Build development version (faster, less optimized)
yarn build:dev

# Download VS Code plugins
yarn download:plugins

# Run Electron app
yarn electron start
```

### Building Production

```bash
# Build production version
yarn build

# Package platform-native desktop artifacts
# (run on the target OS for best compatibility/signing flow)
yarn package:applications
```

The packaged application will be in `theia-app/applications/electron/dist/`.

---

## Project Structure

```
aDOs_IDE/
├── theia-app/              # Main Theia-based application
│   ├── applications/       # Electron and browser apps
│   └── theia-extensions/   # Product and custom aDOs extensions
│       ├── product/        # Theia product shell integration
│       ├── modal-layout/   # Modal layout extension
│       ├── voice/          # Voice interaction extension
│       ├── launcher/       # Launcher/system integration extension
│       └── updater/        # Update flow plumbing (manual updates in v1)
├── docs/                   # Documentation
│   ├── research/          # Research notes
│   └── research-deep/     # Deep research documents
├── BUILD_PLAN.md          # Development roadmap
├── BUILD_LOG.md           # Progress tracking
├── DECISIONS.md           # Architecture decisions (ADRs)
└── aDOs_v1_SYNTHESIS.md   # Cross-track architecture synthesis
```

---

## Documentation

- **[BUILD_PLAN.md](BUILD_PLAN.md)** - Phased development plan
- **[DECISIONS.md](DECISIONS.md)** - Architecture Decision Records (ADRs)
- **[aDOs_v1_SYNTHESIS.md](aDOs_v1_SYNTHESIS.md)** - Complete architecture overview
- **[BUILD_LOG.md](BUILD_LOG.md)** - Implementation progress and notes
- **[docs/README.md](docs/README.md)** - Documentation authority order and status

---

## Philosophy

aDOs IDE is designed around these principles:

1. **Local-first**: Your data, your machine, your control
2. **Privacy-first**: No telemetry, no cloud requirements, no tracking
3. **Capability-based security**: Explicit permissions for all privileged actions
4. **Human-in-the-loop**: AI agents assist but never act without oversight
5. **Unified workspace**: One environment for coding, research, planning, and automation

---

## License

MIT License - See [LICENSE](LICENSE) file for details

---

## Contributing

This is currently a personal project in active development. See [BUILD_PLAN.md](BUILD_PLAN.md) for the development roadmap.

---

## Acknowledgments

- Built on [Eclipse Theia](https://theia-ide.org/) - An extensible IDE platform
- Inspired by tools like Cursor, Notion, Obsidian, Raycast, Figma, and n8n
- Uses [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for AI tool orchestration

---

**Note**: aDOs IDE v1 is in active development. Features and APIs are subject to change.
