export type NoteStatus = 'active' | 'archived' | 'trashed';

export type ExportSensitiveStrategy = 'mask' | 'reveal' | 'exclude';

export interface SecretField {
  id: string;
  noteId: string;
  label: string;
  fieldType: 'password' | 'token' | 'api_key' | 'text';
  maskedPreview: string;
  value?: string;
  encryptedValue?: string;
}

export interface Attachment {
  id: string;
  noteId: string;
  storageKey?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  dataUrl?: string;
  createdAt: string;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  versionNo: number;
  titleSnapshot: string;
  bodySnapshot: string;
  bodyHtmlSnapshot: string;
  tagsSnapshot: string[];
  folderSnapshot: string;
  secretSnapshots: Array<Pick<SecretField, 'id' | 'label' | 'fieldType' | 'maskedPreview'> & { value?: string }>;
  createdAt: string;
  reason: 'manual' | 'autosave' | 'restore' | 'create';
}

export interface Note {
  id: string;
  title: string;
  body: string;
  bodyHtml: string;
  folder: string;
  tags: string[];
  isFavorite: boolean;
  status: NoteStatus;
  summaryText: string;
  attachments: Attachment[];
  secretFields: SecretField[];
  currentVersionNo: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  trashedAt?: string;
}

export interface NoteListItem {
  id: string;
  title: string;
  summaryText: string;
  folder: string;
  tags: string[];
  isFavorite: boolean;
  status: NoteStatus;
  updatedAt: string;
  lastOpenedAt: string;
  secretHit?: boolean;
}

export interface SearchResult extends NoteListItem {
  matchType: 'title' | 'body' | 'tag' | 'secret';
  matchLabel: string;
}

export interface ExportResult {
  fileName: string;
  mimeType: string;
  content: string;
  path?: string;
}

export interface SaveTextFileInput extends ExportResult {
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface AppSettings {
  autoLockMinutes: number;
  dataDirectory: string;
}

export interface VaultStatus {
  initialized: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  nextPassword: string;
}

export interface BackupPayload {
  exportedAt: string;
  appVersion: string;
  notes: Note[];
  versions: NoteVersion[];
  settings: AppSettings;
}

export interface SaveDraftInput {
  id: string;
  title: string;
  body: string;
  bodyHtml: string;
  folder: string;
  tags: string[];
  isFavorite: boolean;
  attachments: Attachment[];
  secretFields: SecretField[];
}

export interface NotesApi {
  version: string;
  app: {
    status(): Promise<VaultStatus>;
    unlock(password: string): Promise<{ ok: boolean; firstRun: boolean }>;
    lock(): Promise<void>;
    changePassword(input: ChangePasswordInput): Promise<{ ok: boolean }>;
  };
  note: {
    list(status?: NoteStatus): Promise<NoteListItem[]>;
    get(id: string): Promise<Note>;
    create(): Promise<Note>;
    saveDraft(input: SaveDraftInput): Promise<Note>;
    moveToTrash(id: string): Promise<void>;
    restore(id: string): Promise<void>;
    deleteForever(id: string): Promise<void>;
    toggleFavorite(id: string): Promise<Note>;
  };
  search: {
    query(query: string): Promise<SearchResult[]>;
  };
  secret: {
    reveal(fieldId: string): Promise<string>;
  };
  history: {
    list(noteId: string): Promise<NoteVersion[]>;
    restore(versionId: string): Promise<Note>;
  };
  export: {
    markdown(noteId: string, strategy: ExportSensitiveStrategy): Promise<ExportResult>;
    html(noteId: string, strategy: ExportSensitiveStrategy): Promise<ExportResult>;
  };
  settings: {
    get(): Promise<AppSettings>;
    save(settings: AppSettings): Promise<AppSettings>;
  };
  backup: {
    export(): Promise<ExportResult>;
    import(payload: BackupPayload): Promise<void>;
  };
  file: {
    saveText(input: SaveTextFileInput): Promise<{ canceled: boolean; path?: string }>;
    openJson(): Promise<{ canceled: boolean; payload?: unknown; path?: string }>;
  };
}
