# Findings & Decisions

## Requirements
- Windows desktop app only
- Offline-first local notes app
- Rich-text editor, no Markdown editing mode
- Must support text, images, attachments, secret fields
- Must support searching secret fields
- Must support recycle bin and history/versioning
- Must export readable `Markdown` and `HTML`
- Must use Electron as the chosen stack
- Figma-generated UI should be translated into maintainable React components, not copied as generated code

## Research Findings
- The original `WPF + WebView2` direction is not viable on this machine because `WebView2`/Edge cannot be used.
- `Tauri` is not suitable under this constraint on Windows because it also depends on the system webview.
- Electron is the most practical replacement because it bundles Chromium and avoids system webview dependency.
- Pure WPF/WinUI rich-text controls would make custom secret blocks, image-rich editing, and HTML/Markdown export significantly harder.
- A practical security compromise is to keep normal note text indexed on disk with `FTS5`, while keeping secret-field search indexes only in memory during unlocked sessions.
- Current tool session cannot read the Figma frame through MCP even though `codex mcp list` reports the Figma server as OAuth-authenticated.
- The implementation uses the provided screenshot and existing design docs as the source of truth until MCP frame data is available in-session.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use `Electron + React + TypeScript + Vite` | Best fit for rich editor UX and bundled runtime control |
| Use `TipTap` on top of `ProseMirror` | Easier custom node/block development for secret fields and attachments |
| Use `SQLite + FTS5` | Sufficient for offline single-user scale and fast local search |
| Use `Main / Preload / Renderer` separation | Standard Electron security and maintainability boundary |
| Keep secret search index in memory after unlock | Avoids persisting searchable plaintext tokens to disk |
| Use snapshot-based history for MVP | Simpler than event sourcing and easier to restore |
| Use a single-package repo with `src/main`, `src/preload`, `src/renderer`, `src/shared` | Keeps the codebase simple and clear for a single desktop app |
| Use screenshot-derived tokens for the first UI pass | Keeps implementation moving without hard-coding Figma-generated code |
| Use project-local npm cache for installs | Avoids the environment permission issue in the global npm cache path |
| Implement MVP persistence with Node's built-in SQLite behind IPC | Avoids current native dependency/postinstall instability while providing a real SQLite `app.db` data layer |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Existing recommendation depended on `WebView2` | Replaced with Electron-first architecture |
| PowerShell multi-name `Get-ChildItem -Filter` usage failed | Stopped using `-Filter` that way and used direct paths instead |
| Figma MCP resources unavailable in current session | Implemented from screenshot and documented the limitation |
| npm install was blocked by cache permissions and an esbuild postinstall validation issue | Used local cache, stopped stale install process, and installed with `--ignore-scripts`; build passed |
| Electron runtime binary is missing because postinstall was skipped and manual install timed out | Project builds, but desktop launch requires fetching `node_modules/electron/dist/electron.exe` |
| `better-sqlite3` was not added | Used `node:sqlite` from Node/Electron instead, avoiding native npm install risk while keeping SQLite and FTS5 |

## Resources
- `docs/plans/2026-04-24-local-secure-notes-design.md`
- `docs/research/2026-04-24-local-secure-notes-open-source-landscape.md`
- Electron docs: https://www.electronjs.org/docs/latest
- Electron process model: https://www.electronjs.org/docs/latest/tutorial/process-model
- WPF RichTextBox overview: https://learn.microsoft.com/en-us/dotnet/desktop/wpf/controls/richtextbox-overview
- `TextRange.Save`: https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange.save

## Visual/Browser Findings
- The key technical blocker is not the desktop shell itself, but the availability of a modern embedded editor runtime.
- Electron remains the cleanest way to guarantee a Chromium-based editor without relying on system browser components.
- The Figma screenshot shows a three-column notes app with a left vault sidebar, middle note list, right editor, secret field block, and export dialog.
