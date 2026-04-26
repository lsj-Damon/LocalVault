import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, screen, shell } from 'electron';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { IPC_CHANNELS } from '../shared/contracts/ipc';
import type {
  AppSettings,
  BackupPayload,
  ChangePasswordInput,
  ClipboardImageInput,
  ExportSensitiveStrategy,
  SaveDraftInput,
  SaveTextFileInput
} from '../shared/types/notes';
import type { LocalStore } from './services/localStore';
import { createLocalStore } from './services/localStore';

let store: LocalStore;
let mainWindow: BrowserWindow | null = null;

const startupLogPath = join(process.env.LOCALAPPDATA ?? process.cwd(), 'Local Vault', 'startup.log');

const logStartupError = (error: unknown): void => {
  try {
    mkdirSync(dirname(startupLogPath), { recursive: true });
    const detail = error instanceof Error ? `${error.stack ?? error.message}` : JSON.stringify(error);
    appendFileSync(startupLogPath, `[${new Date().toISOString()}]\n${detail}\n\n`, 'utf8');
  } catch {
    // Ignore logging failures so the original startup error stays authoritative.
  }
};

process.on('uncaughtException', logStartupError);
process.on('unhandledRejection', logStartupError);

const registerIpcHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.appStatus, () => store.status());
  ipcMain.handle(IPC_CHANNELS.appUnlock, (_event, password: string) => store.unlock(password));
  ipcMain.handle(IPC_CHANNELS.appLock, () => store.lock());
  ipcMain.handle(IPC_CHANNELS.appChangePassword, (_event, input: ChangePasswordInput) => store.changePassword(input));
  ipcMain.handle(IPC_CHANNELS.noteList, (_event, status) => store.list(status));
  ipcMain.handle(IPC_CHANNELS.noteGet, (_event, id: string) => store.get(id));
  ipcMain.handle(IPC_CHANNELS.noteCreate, () => store.create());
  ipcMain.handle(IPC_CHANNELS.noteSaveDraft, (_event, input: SaveDraftInput) => store.saveDraft(input));
  ipcMain.handle(IPC_CHANNELS.noteMoveToTrash, (_event, id: string) => store.moveToTrash(id));
  ipcMain.handle(IPC_CHANNELS.noteRestore, (_event, id: string) => store.restore(id));
  ipcMain.handle(IPC_CHANNELS.noteDeleteForever, (_event, id: string) => store.deleteForever(id));
  ipcMain.handle(IPC_CHANNELS.noteToggleFavorite, (_event, id: string) => store.toggleFavorite(id));
  ipcMain.handle(IPC_CHANNELS.searchQuery, (_event, query: string) => store.search(query));
  ipcMain.handle(IPC_CHANNELS.secretReveal, (_event, fieldId: string) => store.revealSecret(fieldId));
  ipcMain.handle(IPC_CHANNELS.historyList, (_event, noteId: string) => store.listHistory(noteId));
  ipcMain.handle(IPC_CHANNELS.historyRestore, (_event, versionId: string) => store.restoreHistory(versionId));
  ipcMain.handle(IPC_CHANNELS.exportMarkdown, (_event, noteId: string, strategy: ExportSensitiveStrategy) =>
    store.exportMarkdown(noteId, strategy)
  );
  ipcMain.handle(IPC_CHANNELS.exportHtml, (_event, noteId: string, strategy: ExportSensitiveStrategy) =>
    store.exportHtml(noteId, strategy)
  );
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => store.getSettings());
  ipcMain.handle(IPC_CHANNELS.settingsSave, (_event, settings: AppSettings) => store.saveSettings(settings));
  ipcMain.handle(IPC_CHANNELS.backupExport, () => store.exportBackup());
  ipcMain.handle(IPC_CHANNELS.backupImport, (_event, payload: BackupPayload) => store.importBackup(payload));
  ipcMain.handle(IPC_CHANNELS.clipboardWriteImage, (_event, input: ClipboardImageInput) => {
    const image = nativeImage.createFromDataURL(input.dataUrl);
    if (image.isEmpty()) {
      throw new Error('Unable to copy image data.');
    }
    clipboard.writeImage(image);
  });
  ipcMain.handle(IPC_CHANNELS.fileSaveText, async (_event, input: SaveTextFileInput) => {
    const result = await dialog.showSaveDialog({
      defaultPath: input.fileName,
      filters: input.filters ?? [{ name: input.mimeType, extensions: [input.fileName.split('.').pop() || 'txt'] }]
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    writeFileSync(result.filePath, input.content, 'utf8');
    return { canceled: false, path: result.filePath };
  });
  ipcMain.handle(IPC_CHANNELS.fileOpenJson, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }
    return {
      canceled: false,
      path: result.filePaths[0],
      payload: JSON.parse(readFileSync(result.filePaths[0], 'utf8'))
    };
  });
};

const createMainWindow = (): void => {
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = Math.min(2240, workAreaSize.width);
  const height = Math.min(1400, workAreaSize.height);

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1280,
    minHeight: 820,
    center: true,
    title: 'Secure Notes',
    backgroundColor: '#f5f7fa',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

app
  .whenReady()
  .then(() => {
    store = createLocalStore(app.getPath('userData'));
    registerIpcHandlers();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  })
  .catch((error: unknown) => {
    logStartupError(error);
    dialog.showErrorBox('Local Vault failed to start', error instanceof Error ? error.message : String(error));
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
