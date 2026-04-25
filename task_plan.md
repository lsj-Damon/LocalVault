# Task Plan: Local Secure Notes Implementation Planning

## Goal
Produce an implementation-grade Electron app foundation for the local secure notes app, including architecture documents and a maintainable React UI based on the Figma direction.

## Current Phase
Phase 12

## Phases

### Phase 1: Requirements & Discovery
- [x] Consolidate user requirements
- [x] Confirm platform and product constraints
- [x] Record key findings and decisions
- **Status:** complete

### Phase 2: Architecture & Structure
- [x] Confirm Electron as the chosen stack
- [x] Define project directory structure
- [x] Define process and IPC boundaries
- **Status:** complete

### Phase 3: Data Model & Security
- [x] Design SQLite schema
- [x] Define secret-field search strategy
- [x] Define versioning and trash model
- **Status:** complete

### Phase 4: Documentation
- [x] Write implementation architecture document
- [x] Sync design doc where decisions changed
- [x] Update findings and progress logs
- **Status:** complete

### Phase 5: Delivery
- [x] Review planning artifacts
- [x] Summarize outputs and next steps for the user
- **Status:** complete

### Phase 6: Electron UI Foundation
- [x] Check Figma MCP availability
- [x] Scaffold Electron + React + TypeScript project
- [x] Extract design direction into local CSS tokens
- [x] Implement static UI components from the Figma screenshot
- [x] Run build verification
- **Status:** complete

### Phase 7: Screenshot-Accurate UI Restoration
- [x] Restore lock screen state from screenshot
- [x] Restore main notes workspace layout and selected AWS note
- [x] Restore version history drawer state
- [x] Restore export modal state with blurred workspace backdrop
- [x] Run build verification
- **Status:** complete

### Phase 8: MVP Functional Implementation
- [x] Add shared note contracts and IPC channels
- [x] Add main-process local store, session unlock, note CRUD, search, secrets, history, trash, and export handlers
- [x] Expose preload bridge with typed notes API
- [x] Replace static renderer with functional stateful notes workspace
- [x] Run build verification
- **Status:** complete

### Phase 9: MVP Workflow Completion
- [x] Add favorites, recent, folder, tag, and trash filters
- [x] Add image attachment import, preview, caption, remove, save, and export support
- [x] Add settings dialog and configurable auto-lock
- [x] Add backup export and import flow
- [x] Replace non-ASCII mask glyphs with ASCII-safe output
- [x] Run build verification
- **Status:** complete

### Phase 10: TipTap Rich Text Editor
- [x] Install TipTap renderer dependencies with project-local npm cache
- [x] Add rich text HTML storage while preserving plaintext search body
- [x] Replace textarea editor with TipTap editor
- [x] Add formatting toolbar for bold, italic, lists, code block, blockquote, horizontal rule, undo, and redo
- [x] Update Markdown/HTML export to use rich text content
- [x] Run build verification
- **Status:** complete

### Phase 11: SQLite Data Layer
- [x] Replace JSON-backed main store with SQLite `app.db`
- [x] Add SQLite schema for notes, versions, app metadata, and FTS5 search
- [x] Preserve existing IPC and renderer contracts
- [x] Add legacy JSON migration into SQLite
- [x] Verify build and SQLite/FTS runtime smoke tests
- **Status:** complete

### Phase 12: Security, Files, Editor Nodes, Tests, Desktop Integration
- [x] Add session key derivation and AES-256-GCM encryption for secret fields
- [x] Move attachments to an application-managed attachments directory
- [x] Add TipTap custom nodes for secret fields and attachments
- [x] Add store/import/export/search regression tests
- [x] Add Electron native file dialogs and packaging groundwork
- **Status:** complete

## Key Questions
1. How should secret-field search work without storing plaintext search data on disk?
2. What repo structure best separates `main`, `preload`, `renderer`, and shared contracts?
3. What snapshot strategy is simplest for history/versioning in MVP?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Product is Windows-only | User explicitly does not need cross-platform support |
| Editor is rich-text first, no Markdown editing mode | Matches "ordinary notes app" usability goal |
| Sensitive fields must be searchable | User explicitly requires this |
| Export prioritizes Markdown and HTML | User explicitly requires readable exports |
| Recycle bin and history are required | User explicitly requires both |
| Electron is the confirmed app shell | WebView2 is unavailable on the user's machine, and Electron best supports the editor and export requirements |
| Secret-field search uses unlock-only in-memory index | Keeps sensitive searchability without persisting searchable plaintext to disk |
| History uses snapshot-based versions | Simplest restore path for MVP |
| Figma MCP is configured but not exposed to the current tool session | `codex mcp list` shows OAuth, but MCP resource listing returned no frame resources in this session |
| Implement static UI from screenshot and documented design direction | Allows progress while preserving a clean path to replace tokens from real Figma data later |
| MVP functionality now uses Node's built-in SQLite behind the planned IPC boundary | Avoids native npm dependency issues while storing app data in a real SQLite database |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `Get-ChildItem` received multiple names through `-Filter` and failed | 1 | Switched back to explicit file reads and direct paths instead of trying to filter multiple names in one call |
| `npm install` failed writing to global npm cache | 1 | Used project-local `NPM_CONFIG_CACHE` |
| `esbuild` postinstall failed because environment anomaly text polluted version validation | 1 | Reinstalled with `--ignore-scripts`; build still passed |
| Stale `node install.js` held `node_modules\electron` lock | 1 | Stopped the residual process, removed failed `node_modules`, and reinstalled |
| `electron-builder --dir` timed out during package validation | 1 | Recorded as remaining runtime/packaging environment blocker; normal build and tests pass |

## Notes
- Keep the implementation plan aligned with the approved design doc.
- Prefer concrete module boundaries over generic architecture language.
- Avoid introducing unnecessary infrastructure for a single-user offline desktop app.
