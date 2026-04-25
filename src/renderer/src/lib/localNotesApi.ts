import type {
  ExportResult,
  ExportSensitiveStrategy,
  AppSettings,
  BackupPayload,
  Note,
  NoteListItem,
  NotesApi,
  NoteStatus,
  NoteVersion,
  SaveDraftInput,
  SearchResult,
  SecretField
} from '../../../shared/types/notes';

interface BrowserStore {
  passwordHash?: string;
  notes: Note[];
  versions: NoteVersion[];
  settings: AppSettings;
}

const key = 'secure-notes-browser-store';
const now = () => new Date().toISOString();

function id(): string {
  return crypto.randomUUID();
}

function hashPassword(password: string): string {
  return btoa(unescape(encodeURIComponent(`secure-notes:${password}`)));
}

function mask(value: string): string {
  return '*'.repeat(Math.min(Math.max(value.length, 8), 36));
}

function htmlFromPlainText(value: string): string {
  return `<p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function seedSecret(noteId: string, label: string, fieldType: SecretField['fieldType'], value: string): SecretField {
  return { id: id(), noteId, label, fieldType, value, maskedPreview: mask(value) };
}

function seed(): BrowserStore {
  const createdAt = now();
  const noteId = id();
  const note: Note = {
    id: noteId,
    title: 'AWS Production Environment',
    body:
      "We've just migrated the primary databases and updated the IAM roles for the production environment. Below are the new sensitive credentials needed to access the clusters.",
    bodyHtml:
      "<p>We've just migrated the primary databases and updated the IAM roles for the production environment. Below are the new <strong>sensitive credentials</strong> needed to access the clusters.</p>",
    folder: 'Engineering',
    tags: ['DevOps', 'Sensitive'],
    isFavorite: false,
    status: 'active',
    summaryText: 'Credentials and setup details for the new production cluster.',
    attachments: [],
    secretFields: [
      seedSecret(noteId, 'API KEY · AWS ACCESS KEY ID', 'api_key', 'AKIAIOSFODNN7EXAMPLE'),
      seedSecret(noteId, 'SECRET · AWS SECRET ACCESS KEY', 'token', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
    ],
    currentVersionNo: 1,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt
  };
  return {
    notes: [
      note,
      {
        ...note,
        id: id(),
        title: 'Q4 Product Strategy',
        body: 'Key objectives and design principles for the upcoming quarter.',
        bodyHtml: '<p>Key objectives and design principles for the upcoming quarter.</p>',
        folder: 'Work',
        tags: ['Planning', 'Design'],
        summaryText: 'Key objectives and design principles for the upcoming quarter.',
        secretFields: [],
        isFavorite: false
      },
      {
        ...note,
        id: id(),
        title: 'Personal Vault',
        body: 'Banking details and recovery codes.',
        bodyHtml: '<p>Banking details and recovery codes.</p>',
        folder: 'Private',
        tags: ['Personal'],
        summaryText: 'Banking details and recovery codes.',
        secretFields: [],
        isFavorite: true
      }
    ],
    versions: [makeVersion(note, 'create')],
    settings: {
      autoLockMinutes: 5,
      dataDirectory: 'Browser localStorage'
    }
  };
}

function read(): BrowserStore {
  const raw = localStorage.getItem(key);
  if (!raw) {
    const initial = seed();
    write(initial);
    return initial;
  }
  const store = JSON.parse(raw) as BrowserStore;
  store.settings ??= { autoLockMinutes: 5, dataDirectory: 'Browser localStorage' };
  store.notes = store.notes.map((note) => ({ ...note, bodyHtml: note.bodyHtml ?? htmlFromPlainText(note.body), attachments: note.attachments ?? [] }));
  store.versions = store.versions.map((version) => ({
    ...version,
    bodyHtmlSnapshot: version.bodyHtmlSnapshot ?? htmlFromPlainText(version.bodySnapshot)
  }));
  return store;
}

function write(store: BrowserStore): void {
  localStorage.setItem(key, JSON.stringify(store));
}

function summarize(body: string): string {
  return stripHtml(body).slice(0, 96);
}

function toListItem(note: Note): NoteListItem {
  return {
    id: note.id,
    title: note.title,
    summaryText: note.summaryText,
    folder: note.folder,
    tags: note.tags,
    isFavorite: note.isFavorite,
    status: note.status,
    updatedAt: note.updatedAt,
    lastOpenedAt: note.lastOpenedAt
  };
}

function makeVersion(note: Note, reason: NoteVersion['reason']): NoteVersion {
  return {
    id: id(),
    noteId: note.id,
    versionNo: note.currentVersionNo,
    titleSnapshot: note.title,
    bodySnapshot: note.body,
    bodyHtmlSnapshot: note.bodyHtml,
    tagsSnapshot: [...note.tags],
    folderSnapshot: note.folder,
    secretSnapshots: note.secretFields.map((field) => ({ ...field })),
    createdAt: now(),
    reason
  };
}

function requireNote(store: BrowserStore, noteId: string): Note {
  const note = store.notes.find((item) => item.id === noteId);
  if (!note) {
    throw new Error('Note not found');
  }
  return note;
}

export function getNotesApi(): NotesApi {
  return window.notesApi ?? browserNotesApi;
}

const browserNotesApi: NotesApi = {
  version: '0.2.0-browser',
  app: {
    async status() {
      return { initialized: Boolean(read().passwordHash) };
    },
    async unlock(password) {
      const store = read();
      const firstRun = !store.passwordHash;
      if (firstRun) {
        store.passwordHash = hashPassword(password);
        write(store);
        return { ok: true, firstRun };
      }
      return { ok: store.passwordHash === hashPassword(password), firstRun };
    },
    async lock() {
      return undefined;
    },
    async changePassword(input) {
      const store = read();
      if (store.passwordHash !== hashPassword(input.currentPassword)) {
        return { ok: false };
      }
      store.passwordHash = hashPassword(input.nextPassword);
      write(store);
      return { ok: true };
    }
  },
  note: {
    async list(status: NoteStatus = 'active') {
      return read()
        .notes.filter((note) => note.status === status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(toListItem);
    },
    async get(noteId) {
      const store = read();
      const note = requireNote(store, noteId);
      note.lastOpenedAt = now();
      write(store);
      return structuredClone(note);
    },
    async create() {
      const store = read();
      const timestamp = now();
      const note: Note = {
        id: id(),
        title: 'Untitled Note',
        body: '',
        bodyHtml: '<p></p>',
        folder: 'Private',
        tags: [],
        isFavorite: false,
        status: 'active',
        summaryText: '',
        attachments: [],
        secretFields: [],
        currentVersionNo: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: timestamp
      };
      store.notes.unshift(note);
      store.versions.unshift(makeVersion(note, 'create'));
      write(store);
      return structuredClone(note);
    },
    async saveDraft(input: SaveDraftInput) {
      const store = read();
      const note = requireNote(store, input.id);
      note.title = input.title.trim() || 'Untitled Note';
      note.body = input.body;
      note.bodyHtml = input.bodyHtml || htmlFromPlainText(input.body);
      note.folder = input.folder.trim() || 'Private';
      note.tags = input.tags.map((tag) => tag.trim()).filter(Boolean);
      note.isFavorite = input.isFavorite;
      note.attachments = input.attachments.map((attachment) => ({ ...attachment, id: attachment.id || id(), noteId: note.id }));
      note.secretFields = input.secretFields.map((field) => ({
        ...field,
        id: field.id || id(),
        noteId: note.id,
        maskedPreview: field.value ? mask(field.value) : field.maskedPreview
      }));
      note.summaryText = summarize(note.bodyHtml || note.body);
      note.currentVersionNo += 1;
      note.updatedAt = now();
      store.versions.unshift(makeVersion(note, 'autosave'));
      write(store);
      return structuredClone(note);
    },
    async moveToTrash(noteId) {
      const store = read();
      const note = requireNote(store, noteId);
      note.status = 'trashed';
      note.trashedAt = now();
      write(store);
    },
    async restore(noteId) {
      const store = read();
      const note = requireNote(store, noteId);
      note.status = 'active';
      note.trashedAt = undefined;
      write(store);
    },
    async deleteForever(noteId) {
      const store = read();
      store.notes = store.notes.filter((note) => note.id !== noteId);
      store.versions = store.versions.filter((version) => version.noteId !== noteId);
      write(store);
    },
    async toggleFavorite(noteId) {
      const store = read();
      const note = requireNote(store, noteId);
      note.isFavorite = !note.isFavorite;
      write(store);
      return structuredClone(note);
    }
  },
  search: {
    async query(query) {
      const needle = query.toLowerCase().trim();
      const notes = read().notes.filter((note) => note.status === 'active');
      if (!needle) {
        return notes.map((note) => ({ ...toListItem(note), matchType: 'title', matchLabel: 'All notes' }));
      }
      return notes.flatMap<SearchResult>((note) => {
        const item = toListItem(note);
        if (note.title.toLowerCase().includes(needle)) return [{ ...item, matchType: 'title', matchLabel: 'Title' }];
        if (note.body.toLowerCase().includes(needle)) return [{ ...item, matchType: 'body', matchLabel: 'Body' }];
        if (note.tags.some((tag) => tag.toLowerCase().includes(needle))) return [{ ...item, matchType: 'tag', matchLabel: 'Tag' }];
        const secret = note.secretFields.find((field) => `${field.label} ${field.value}`.toLowerCase().includes(needle));
        return secret ? [{ ...item, secretHit: true, matchType: 'secret', matchLabel: secret.label }] : [];
      });
    }
  },
  secret: {
    async reveal(fieldId) {
      const field = read()
        .notes.flatMap((note) => note.secretFields)
        .find((item) => item.id === fieldId);
      return field?.value ?? '';
    }
  },
  history: {
    async list(noteId) {
      return read().versions.filter((version) => version.noteId === noteId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async restore(versionId) {
      const store = read();
      const version = store.versions.find((item) => item.id === versionId);
      if (!version) throw new Error('Version not found');
      const note = requireNote(store, version.noteId);
      note.title = version.titleSnapshot;
      note.body = version.bodySnapshot;
      note.bodyHtml = version.bodyHtmlSnapshot;
      note.tags = [...version.tagsSnapshot];
      note.folder = version.folderSnapshot;
      note.secretFields = version.secretSnapshots.map((field) => ({ ...field, noteId: note.id }));
      note.updatedAt = now();
      store.versions.unshift(makeVersion(note, 'restore'));
      write(store);
      return structuredClone(note);
    }
  },
  export: {
    async markdown(noteId, strategy) {
      const note = requireNote(read(), noteId);
      return buildMarkdown(note, strategy);
    },
    async html(noteId, strategy) {
      const note = requireNote(read(), noteId);
      return buildHtml(note, strategy);
    }
  },
  settings: {
    async get() {
      return read().settings;
    },
    async save(settings) {
      const store = read();
      store.settings = {
        autoLockMinutes: Math.max(1, Math.min(120, Math.round(settings.autoLockMinutes))),
        dataDirectory: 'Browser localStorage'
      };
      write(store);
      return store.settings;
    }
  },
  backup: {
    async export() {
      const store = read();
      const payload: BackupPayload = {
        exportedAt: now(),
        appVersion: '0.2.0-browser',
        notes: store.notes,
        versions: store.versions,
        settings: store.settings
      };
      return {
        fileName: `secure-notes-backup-${new Date().toISOString().slice(0, 10)}.json`,
        mimeType: 'application/json',
        content: JSON.stringify(payload, null, 2)
      };
    },
    async import(payload) {
      if (!Array.isArray(payload.notes) || !Array.isArray(payload.versions)) {
        throw new Error('Invalid backup payload');
      }
      write({
        passwordHash: read().passwordHash,
        notes: payload.notes,
        versions: payload.versions,
        settings: payload.settings ?? { autoLockMinutes: 5, dataDirectory: 'Browser localStorage' }
      });
    }
  },
  file: {
    async saveText(input) {
      downloadTextFile(input);
      return { canceled: false };
    },
    async openJson() {
      return { canceled: true };
    }
  }
};

function buildMarkdown(note: Note, strategy: ExportSensitiveStrategy): ExportResult {
  const secrets =
    strategy === 'exclude'
      ? ''
      : note.secretFields
          .map((field) => ['```secret', `label: ${field.label}`, `value: ${strategy === 'reveal' ? field.value : '********'}`, '```'].join('\n'))
          .join('\n\n');
  return {
    fileName: `${note.title}.md`,
    mimeType: 'text/markdown',
    content: [`# ${note.title}`, '', markdownFromHtml(note.bodyHtml || htmlFromPlainText(note.body)), '', renderAttachmentsMarkdown(note.attachments), '', secrets].filter(Boolean).join('\n')
  };
}

function buildHtml(note: Note, strategy: ExportSensitiveStrategy): ExportResult {
  const secrets =
    strategy === 'exclude'
      ? ''
      : note.secretFields
          .map((field) => `<p><strong>${field.label}</strong>: <code>${strategy === 'reveal' ? field.value : '********'}</code></p>`)
          .join('');
  return {
    fileName: `${note.title}.html`,
    mimeType: 'text/html',
    content: `<!doctype html><meta charset="utf-8"><h1>${note.title}</h1>${note.bodyHtml || htmlFromPlainText(note.body)}${renderAttachmentsHtml(note.attachments)}${secrets}`
  };
}

function renderAttachmentsMarkdown(attachments: Note['attachments']): string {
  return attachments
    .map((attachment) => (attachment.dataUrl ? `![${attachment.caption || attachment.name}](${attachment.dataUrl})` : `- Attachment: ${attachment.name}`))
    .join('\n\n');
}

function renderAttachmentsHtml(attachments: Note['attachments']): string {
  return attachments
    .map((attachment) =>
      attachment.dataUrl
        ? `<figure><img src="${attachment.dataUrl}" alt="${attachment.caption || attachment.name}"><figcaption>${attachment.caption || attachment.name}</figcaption></figure>`
        : `<p>Attachment: ${attachment.name}</p>`
    )
    .join('');
}

function markdownFromHtml(value: string): string {
  return value
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gis, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gis, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadTextFile(result: { fileName: string; mimeType: string; content: string }) {
  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
