# Progress Log

## Session: 2026-04-24

### Phase 1: Requirements & Discovery
- **Status:** complete
- **Started:** 2026-04-24
- Actions taken:
  - Converted product idea into a written requirements document
  - Researched comparable open-source projects on GitHub
  - Compared stacks used by Joplin, Trilium Notes, TagSpaces, Notesnook, QOwnNotes, and AFFiNE
  - Adjusted the recommended stack after learning `WebView2` is unusable on this machine
  - Confirmed Electron as the chosen application shell
- Files created/modified:
  - `docs/plans/2026-04-24-local-secure-notes-design.md`
  - `docs/research/2026-04-24-local-secure-notes-open-source-landscape.md`

### Phase 2: Architecture & Structure
- **Status:** complete
- Actions taken:
  - Created persistent planning files in project root
  - Completed implementation-grade planning for project structure, IPC boundaries, and runtime responsibilities
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `docs/plans/2026-04-24-local-secure-notes-implementation-architecture.md`

### Phase 3: Data Model & Security
- **Status:** complete
- Actions taken:
  - Designed SQLite table layout for notes, documents, attachments, tags, versions, and settings
  - Defined unlock-only in-memory search index strategy for secret fields
  - Chose snapshot-based version history for MVP
- Files created/modified:
  - `docs/plans/2026-04-24-local-secure-notes-implementation-architecture.md`

### Phase 4: Documentation
- **Status:** complete
- Actions taken:
  - Synchronized planning files with the current implementation decisions
  - Added the implementation architecture document to the repo
  - Updated the product design doc to reference implementation-level planning
- Files created/modified:
  - `docs/plans/2026-04-24-local-secure-notes-design.md`
  - `docs/plans/2026-04-24-local-secure-notes-implementation-architecture.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Session catchup script | `session-catchup.py` against repo path | Return previous session info if any | No actionable output beyond command execution | N/A |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-24 | PowerShell `Get-ChildItem -Filter` cannot take multiple file names | 1 | Used direct file reads and explicit paths |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 5: Delivery |
| Where am I going? | Final summary and next implementation step |
| What's the goal? | Produce an implementation-grade Electron architecture plan for the local secure notes app |
| What have I learned? | See `findings.md` |
| What have I done? | See phase logs above |

## Session: 2026-04-25

### Phase 6: Electron UI Foundation
- **Status:** complete
- Actions taken:
  - Checked MCP resources for Figma; no frame resources were exposed in the current tool session
  - Confirmed `codex mcp list` shows the `figma` server enabled with OAuth
  - Created Electron + React + TypeScript project scaffold
  - Implemented the screenshot-inspired high-fidelity static UI with maintainable React components
  - Added design tokens and Apple-inspired color system in CSS
  - Installed dependencies using a project-local npm cache and `--ignore-scripts`
  - Ran `npm run build` successfully
  - Tried to run Electron's install script to fetch `electron.exe`; the script timed out and left no runtime binary
  - Started a renderer-only Vite preview at `http://127.0.0.1:5173/`
- Files created/modified:
  - `package.json`
  - `package-lock.json`
  - `electron.vite.config.ts`
  - `tsconfig.json`
  - `.gitignore`
  - `src/main/index.ts`
  - `src/preload/index.ts`
  - `src/renderer/index.html`
  - `src/renderer/src/main.tsx`
  - `src/renderer/src/app/App.tsx`
  - `src/renderer/src/data/mockNotes.tsx`
  - `src/renderer/src/styles/global.css`
  - `src/renderer/vite.config.ts`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Test Results: 2026-04-25
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| MCP resource list | `list_mcp_resources` | Figma resources available | Empty resource list | Blocked |
| Codex MCP status | `codex.exe mcp list` | Figma server configured | `figma` enabled with OAuth | Pass |
| Dependency install | `npm install` | Dependencies installed | Failed due global cache permission and esbuild install validation | Failed |
| Dependency install workaround | `NPM_CONFIG_CACHE=.npm-cache npm install --ignore-scripts` | Dependencies installed | Dependencies installed | Pass |
| Build | `npm run build` | TypeScript and Electron/Vite build pass | Build completed successfully | Pass |
| Electron runtime binary | `node node_modules/electron/install.js` | `node_modules/electron/dist/electron.exe` exists | Timed out; binary still missing | Blocked |
| Renderer preview server | `Invoke-WebRequest http://127.0.0.1:5173/` | HTTP 200 | HTTP 200 | Pass |

## Error Log: 2026-04-25
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-25 | Figma MCP frame resources unavailable in current tool session | 1 | Implemented from screenshot and current design docs |
| 2026-04-25 | npm global cache permission error | 1 | Used project-local `.npm-cache` |
| 2026-04-25 | esbuild postinstall validation polluted by environment anomaly output | 1 | Installed with `--ignore-scripts`; verified with `npm run build` |
| 2026-04-25 | `node install.js` process held `node_modules\electron` lock | 1 | Stopped residual process, removed generated `node_modules`, reinstalled |
| 2026-04-25 | Electron runtime install script timed out | 1 | Stopped residual `node install.js`; build remains valid, but local desktop launch needs Electron binary download fixed |

### Phase 7: Screenshot-Accurate UI Restoration
- **Status:** complete
- Actions taken:
  - Rebuilt `App.tsx` around the screenshot state flow: lock screen, main notes workspace, version history drawer, and export dialog
  - Updated mock notes and version history data to match the visible Figma screenshots
  - Replaced renderer CSS with screenshot-derived layout, colors, spacing, rounded corners, shadows, and modal blur behavior
  - Verified renderer preview is reachable at `http://127.0.0.1:5173/`
- Files modified:
  - `src/renderer/src/app/App.tsx`
  - `src/renderer/src/data/mockNotes.tsx`
  - `src/renderer/src/styles/global.css`
  - `task_plan.md`
  - `progress.md`

## Test Results: Phase 7
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Build | `npm run build` | TypeScript and Electron/Vite build pass | Build completed with exit code 0 | Pass |
| Renderer preview | `Invoke-WebRequest http://127.0.0.1:5173/` | HTTP 200 | HTTP 200 | Pass |

### Phase 8: MVP Functional Implementation
- **Status:** complete
- Actions taken:
  - Added shared IPC channel constants and typed note/export/history/secret contracts
  - Added main-process `LocalStore` with unlock, note CRUD, search, secret reveal, history restore, trash, and Markdown/HTML export
  - Exposed the same operations through the preload `window.notesApi` bridge
  - Reworked the renderer from static screenshot composition into a functional notes workspace
  - Added browser-preview fallback using localStorage so the renderer can be tested without the Electron runtime
  - Kept the screenshot-derived visual layout while adding editable title/body/folder/tags, secret field controls, export options, history restore, trash restore/delete, lock, and save actions
- Files created/modified:
  - `src/shared/contracts/ipc.ts`
  - `src/shared/types/notes.ts`
  - `src/main/services/localStore.ts`
  - `src/main/index.ts`
  - `src/preload/index.ts`
  - `src/renderer/src/types/global.d.ts`
  - `src/renderer/src/lib/localNotesApi.ts`
  - `src/renderer/src/app/App.tsx`
  - `src/renderer/src/styles/global.css`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Test Results: Phase 8
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Build | `npm run build` | TypeScript and Electron/Vite build pass | Build completed with exit code 0 | Pass |
| Renderer preview | `Invoke-WebRequest http://127.0.0.1:5173/` | HTTP 200 | HTTP 200 | Pass |

## Error Log: Phase 8
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-25 | TypeScript inferred `flatMap` search results as `unknown[]` | 1 | Added explicit `SearchResult[]` and `flatMap<SearchResult>` typing |

### Phase 9: MVP Workflow Completion
- **Status:** complete
- Actions taken:
  - Added functional sidebar filters for all notes, favorites, recent, folders, tags, and trash
  - Added image attachment import through the toolbar, attachment previews, captions, removal, persistence, backup, and Markdown/HTML export rendering
  - Added app settings with configurable auto-lock and visible data directory
  - Added backup export/import APIs in shared contracts, main process, preload bridge, and browser fallback
  - Replaced bullet mask output with ASCII asterisks to avoid terminal/export encoding noise
- Files modified:
  - `src/shared/contracts/ipc.ts`
  - `src/shared/types/notes.ts`
  - `src/main/index.ts`
  - `src/main/services/localStore.ts`
  - `src/preload/index.ts`
  - `src/renderer/src/lib/localNotesApi.ts`
  - `src/renderer/src/app/App.tsx`
  - `src/renderer/src/styles/global.css`
  - `task_plan.md`
  - `progress.md`

## Test Results: Phase 9
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Build | `npm run build` | TypeScript and Electron/Vite build pass | Build completed with exit code 0 | Pass |

### Phase 10: TipTap Rich Text Editor
- **Status:** complete
- Actions taken:
  - Installed `@tiptap/react` and `@tiptap/starter-kit` using project-local `.npm-cache`
  - Added `bodyHtml` and `bodyHtmlSnapshot` to note and history contracts
  - Added migration fallback from old plaintext notes to paragraph HTML
  - Replaced the plaintext textarea with a TipTap editor
  - Added rich-text controls for heading, bold, italic, bullet list, code block, blockquote, horizontal rule, undo, and redo
  - Updated Markdown and HTML export to use rich text HTML while preserving plaintext body for search and summaries
- Files modified:
  - `package.json`
  - `package-lock.json`
  - `src/shared/types/notes.ts`
  - `src/main/services/localStore.ts`
  - `src/renderer/src/lib/localNotesApi.ts`
  - `src/renderer/src/app/App.tsx`
  - `src/renderer/src/styles/global.css`
  - `task_plan.md`
  - `progress.md`

## Test Results: Phase 10
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Dependency install | `NPM_CONFIG_CACHE=.npm-cache npm install @tiptap/react @tiptap/starter-kit --ignore-scripts` | Dependencies installed | Dependencies installed | Pass |
| Build | `npm run build` | TypeScript and Electron/Vite build pass | Build completed with exit code 0 | Pass |
| Renderer preview | `Invoke-WebRequest http://127.0.0.1:5173/` | HTTP 200 | HTTP 200 | Pass |

## Error Log: Phase 10
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-25 | npm install failed on global cache with EPERM | 1 | Re-ran install with project-local `.npm-cache` and `--ignore-scripts` |

### Phase 11: SQLite Data Layer
- **Status:** complete
- Actions taken:
  - Replaced the main-process JSON-backed `LocalStore` with a SQLite-backed implementation using `node:sqlite`
  - Added tables for `notes`, `note_versions`, `app_meta`, and FTS5 `notes_fts`
  - Preserved the existing IPC/preload/renderer contracts so the UI did not need a data API rewrite
  - Added migration from the old `secure-notes-store.json` file into `app.db`
  - Kept backup import/export, history, trash, secrets, settings, attachments, and rich-text HTML storage working over SQLite
- Files modified:
  - `src/main/services/localStore.ts`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Test Results: Phase 11
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Build | `npm run build` | TypeScript and Electron/Vite build pass | Build completed with exit code 0 | Pass |
| SQLite smoke | In-memory `node:sqlite` table insert/select | Return `ok` | Returned `ok` | Pass |
| FTS5 smoke | In-memory FTS5 table query | Return inserted row id | Returned `1` | Pass |

## Error Log: Phase 11
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-25 | `node:sqlite` row types are intentionally broad | 1 | Added explicit `unknown as NoteRow/VersionRow` casts at row conversion boundaries |

### Phase 12: Security, Files, Editor Nodes, Tests, Desktop Integration
- **Status:** complete
- Actions taken:
  - Added password-derived session keys with Node `scryptSync`
  - Added AES-256-GCM encryption for secret fields and migration of existing plaintext secret values after unlock
  - Changed secret reveal/search/export to decrypt only while the vault is unlocked
  - Added application-managed `attachments/` storage; imported data URLs are written to files and hydrated back for renderer previews
  - Added TipTap custom nodes for secret field and attachment reference placeholders
  - Added Electron native save/open JSON IPC channels and renderer usage for export/backup save
  - Added `electron-builder.yml`, `npm run dist`, and `electron-builder`
  - Added Node test runner coverage for SQLite persistence, encrypted secrets, search, export, history, lock behavior, and backup import/export
- Files created/modified:
  - `electron-builder.yml`
  - `tests/localStore.test.ts`
  - `package.json`
  - `package-lock.json`
  - `src/shared/contracts/ipc.ts`
  - `src/shared/types/notes.ts`
  - `src/main/index.ts`
  - `src/main/services/localStore.ts`
  - `src/preload/index.ts`
  - `src/renderer/src/app/App.tsx`
  - `src/renderer/src/lib/localNotesApi.ts`
  - `src/renderer/src/styles/global.css`
  - `task_plan.md`
  - `progress.md`

## Test Results: Phase 12
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Store tests | `npm test` | All LocalStore regression tests pass | 2 passed, 0 failed | Pass |
| Build | `npm run build` | TypeScript and Electron/Vite build pass | Build completed with exit code 0 | Pass |
| Packaging config | `npx electron-builder --dir --config electron-builder.yml` | Validate packaging config | Timed out after 124s | Blocked |

## Error Log: Phase 12
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-25 | Temporary test directory removal failed on Windows because SQLite DB was still open | 1 | Added `LocalStore.close()` and called it during test cleanup |
| 2026-04-25 | `electron-builder --dir` timed out | 1 | Recorded as packaging/runtime environment blocker; normal build and tests pass |
