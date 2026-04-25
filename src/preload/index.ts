import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/contracts/ipc';
import type {
  AppSettings,
  BackupPayload,
  ChangePasswordInput,
  ExportSensitiveStrategy,
  NoteStatus,
  SaveDraftInput,
  SaveTextFileInput
} from '../shared/types/notes';

contextBridge.exposeInMainWorld('notesApi', {
  version: '0.2.0',
  app: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.appStatus),
    unlock: (password: string) => ipcRenderer.invoke(IPC_CHANNELS.appUnlock, password),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.appLock),
    changePassword: (input: ChangePasswordInput) => ipcRenderer.invoke(IPC_CHANNELS.appChangePassword, input)
  },
  note: {
    list: (status?: NoteStatus) => ipcRenderer.invoke(IPC_CHANNELS.noteList, status),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.noteGet, id),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.noteCreate),
    saveDraft: (input: SaveDraftInput) => ipcRenderer.invoke(IPC_CHANNELS.noteSaveDraft, input),
    moveToTrash: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.noteMoveToTrash, id),
    restore: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.noteRestore, id),
    deleteForever: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.noteDeleteForever, id),
    toggleFavorite: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.noteToggleFavorite, id)
  },
  search: {
    query: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.searchQuery, query)
  },
  secret: {
    reveal: (fieldId: string) => ipcRenderer.invoke(IPC_CHANNELS.secretReveal, fieldId)
  },
  history: {
    list: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.historyList, noteId),
    restore: (versionId: string) => ipcRenderer.invoke(IPC_CHANNELS.historyRestore, versionId)
  },
  export: {
    markdown: (noteId: string, strategy: ExportSensitiveStrategy) =>
      ipcRenderer.invoke(IPC_CHANNELS.exportMarkdown, noteId, strategy),
    html: (noteId: string, strategy: ExportSensitiveStrategy) => ipcRenderer.invoke(IPC_CHANNELS.exportHtml, noteId, strategy)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    save: (settings: AppSettings) => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, settings)
  },
  backup: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.backupExport),
    import: (payload: BackupPayload) => ipcRenderer.invoke(IPC_CHANNELS.backupImport, payload)
  },
  file: {
    saveText: (input: SaveTextFileInput) => ipcRenderer.invoke(IPC_CHANNELS.fileSaveText, input),
    openJson: () => ipcRenderer.invoke(IPC_CHANNELS.fileOpenJson)
  }
});
