import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  AppSettings,
  BackupPayload,
  ChangePasswordInput,
  ExportResult,
  ExportSensitiveStrategy,
  Note,
  NoteListItem,
  NoteStatus,
  NoteVersion,
  SaveDraftInput,
  SearchResult,
  SecretField,
  VaultStatus
} from '../../shared/types/notes';

interface LegacyStoreFile {
  passwordHash?: string;
  notes: Note[];
  versions: NoteVersion[];
  settings?: AppSettings;
}

interface NoteRow {
  id: string;
  title: string;
  body: string;
  body_html: string;
  folder: string;
  tags_json: string;
  is_favorite: number;
  status: NoteStatus;
  summary_text: string;
  attachments_json: string;
  secret_fields_json: string;
  current_version_no: number;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  trashed_at: string | null;
}

interface VersionRow {
  id: string;
  note_id: string;
  version_no: number;
  title_snapshot: string;
  body_snapshot: string;
  body_html_snapshot: string;
  tags_snapshot_json: string;
  folder_snapshot: string;
  secret_snapshots_json: string;
  created_at: string;
  reason: NoteVersion['reason'];
}

const now = () => new Date().toISOString();

const seedBody =
  "We've just migrated the primary databases and updated the IAM roles for the production environment. Below are the new sensitive credentials needed to access the clusters.";

function hashPassword(password: string): string {
  return createHash('sha256').update(`secure-notes:${password}`).digest('hex');
}

function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, Buffer.from(salt, 'base64'), 32);
}

function verifierForKey(key: Buffer): string {
  return createHash('sha256').update('secure-notes-verifier').update(key).digest('base64');
}

function mask(value: string): string {
  return '*'.repeat(Math.min(Math.max(value.length, 8), 36));
}

function encryptWithKey(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptWithKey(payload: string, key: Buffer): string {
  const [version, iv, tag, encrypted] = payload.split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

function htmlFromPlainText(value: string): string {
  return `<p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
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

function summarize(bodyHtml: string): string {
  return stripHtml(bodyHtml).slice(0, 96);
}

function createSecret(noteId: string, label: string, fieldType: SecretField['fieldType'], value: string): SecretField {
  return {
    id: randomUUID(),
    noteId,
    label,
    fieldType,
    value,
    maskedPreview: mask(value)
  };
}

function createSeedNotes(): Note[] {
  const createdAt = now();
  const awsId = randomUUID();
  const strategyId = randomUUID();
  const vaultId = randomUUID();

  return [
    {
      id: awsId,
      title: 'AWS Production Environment',
      body: seedBody,
      bodyHtml:
        "<p>We've just migrated the primary databases and updated the IAM roles for the production environment. Below are the new <strong>sensitive credentials</strong> needed to access the clusters.</p>",
      folder: 'Engineering',
      tags: ['DevOps', 'Sensitive'],
      isFavorite: false,
      status: 'active',
      summaryText: 'Credentials and setup details for the new production cluster.',
      attachments: [
        {
          id: randomUUID(),
          noteId: awsId,
          name: 'server-rack-reference.png',
          mimeType: 'image/png',
          sizeBytes: 428112,
          caption: 'Production rack reference image',
          createdAt
        }
      ],
      secretFields: [
        createSecret(awsId, 'API KEY - AWS ACCESS KEY ID', 'api_key', 'AKIAIOSFODNN7EXAMPLE'),
        createSecret(awsId, 'SECRET - AWS SECRET ACCESS KEY', 'token', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
      ],
      currentVersionNo: 1,
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: createdAt
    },
    {
      id: strategyId,
      title: 'Q4 Product Strategy',
      body: 'Key objectives and design principles for the upcoming quarter.',
      bodyHtml: '<p>Key objectives and design principles for the upcoming quarter.</p>',
      folder: 'Work',
      tags: ['Planning', 'Design'],
      isFavorite: false,
      status: 'active',
      summaryText: 'Key objectives and design principles for the upcoming quarter.',
      attachments: [],
      secretFields: [],
      currentVersionNo: 1,
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: createdAt
    },
    {
      id: vaultId,
      title: 'Personal Vault',
      body: 'Banking details and recovery codes.',
      bodyHtml: '<p>Banking details and recovery codes.</p>',
      folder: 'Private',
      tags: ['Personal'],
      isFavorite: true,
      status: 'active',
      summaryText: 'Banking details and recovery codes.',
      attachments: [],
      secretFields: [createSecret(vaultId, 'Recovery code - Authenticator', 'password', '734921-992184')],
      currentVersionNo: 1,
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: createdAt
    }
  ];
}

function makeVersion(note: Note, reason: NoteVersion['reason']): NoteVersion {
  return {
    id: randomUUID(),
    noteId: note.id,
    versionNo: note.currentVersionNo,
    titleSnapshot: note.title,
    bodySnapshot: note.body,
    bodyHtmlSnapshot: note.bodyHtml,
    tagsSnapshot: [...note.tags],
    folderSnapshot: note.folder,
    secretSnapshots: note.secretFields.map((field) => ({
      id: field.id,
      label: field.label,
      fieldType: field.fieldType,
      maskedPreview: field.maskedPreview,
      value: field.value
    })),
    createdAt: now(),
    reason
  };
}

export class LocalStore {
  private db: DatabaseSync | null = null;
  private unlocked = false;
  private sessionKey: Buffer | null = null;
  private attachmentsDir = '';

  constructor(
    private readonly dbPath: string,
    private readonly userDataPath: string,
    private readonly legacyJsonPath?: string
  ) {}

  initialize(): void {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.attachmentsDir = join(this.userDataPath, 'attachments');
    mkdirSync(this.attachmentsDir, { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
    this.seedIfEmpty();
    this.importLegacyJsonIfNeeded();
  }

  status(): VaultStatus {
    return {
      initialized: this.hasMasterPassword()
    };
  }

  unlock(password: string): { ok: boolean; firstRun: boolean } {
    const salt = this.getMeta('keySalt');
    const verifier = this.getMeta('keyVerifier');
    const legacyPasswordHash = this.getMeta('passwordHash');
    const firstRun = !salt && !verifier && !legacyPasswordHash;

    if (firstRun) {
      const nextSalt = randomBytes(16).toString('base64');
      const key = deriveKey(password, nextSalt);
      this.setMeta('keySalt', nextSalt);
      this.setMeta('keyVerifier', verifierForKey(key));
      this.setMeta('passwordHash', hashPassword(password));
      this.sessionKey = key;
      this.unlocked = true;
      this.encryptPlaintextSecrets();
      return { ok: true, firstRun };
    }

    if (salt && verifier) {
      const key = deriveKey(password, salt);
      const expected = Buffer.from(verifier, 'base64');
      const actual = Buffer.from(verifierForKey(key), 'base64');
      const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
      this.sessionKey = ok ? key : null;
      this.unlocked = ok;
      if (ok) {
        this.encryptPlaintextSecrets();
      }
      return { ok, firstRun: false };
    }

    const ok = legacyPasswordHash === hashPassword(password);
    if (ok) {
      const nextSalt = randomBytes(16).toString('base64');
      const key = deriveKey(password, nextSalt);
      this.setMeta('keySalt', nextSalt);
      this.setMeta('keyVerifier', verifierForKey(key));
      this.sessionKey = key;
      this.unlocked = true;
      this.encryptPlaintextSecrets();
    }
    return { ok, firstRun: false };
  }

  changePassword(input: ChangePasswordInput): { ok: boolean } {
    this.assertUnlocked();
    const currentKey = this.verifyMasterPassword(input.currentPassword);
    if (!currentKey) {
      return { ok: false };
    }

    const nextSalt = randomBytes(16).toString('base64');
    const nextKey = deriveKey(input.nextPassword, nextSalt);
    const notes = this.allNotes();
    const rewrittenNotes = notes.map((note) => ({
      ...note,
      secretFields: note.secretFields.map((field) => this.reencryptSecretField(field, currentKey, nextKey))
    }));

    const db = this.dbHandle();
    db.exec('BEGIN');
    try {
      this.sessionKey = nextKey;
      for (const note of rewrittenNotes) {
        this.upsertNote(note);
      }
      this.setMeta('keySalt', nextSalt);
      this.setMeta('keyVerifier', verifierForKey(nextKey));
      this.setMeta('passwordHash', hashPassword(input.nextPassword));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      this.sessionKey = currentKey;
      throw error;
    }

    this.sessionKey = nextKey;
    this.unlocked = true;
    return { ok: true };
  }

  lock(): void {
    this.unlocked = false;
    this.sessionKey = null;
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.unlocked = false;
    this.sessionKey = null;
  }

  list(status: NoteStatus = 'active'): NoteListItem[] {
    this.assertUnlocked();
    return this.dbHandle()
      .prepare('SELECT * FROM notes WHERE status = ? ORDER BY updated_at DESC')
      .all(status)
      .map((row) => toListItem(rowToNote(row as unknown as NoteRow)));
  }

  get(id: string): Note {
    this.assertUnlocked();
    const note = this.requireNote(id);
    note.lastOpenedAt = now();
    this.upsertNote(note);
    return structuredClone(note);
  }

  create(): Note {
    this.assertUnlocked();
    const timestamp = now();
    const note: Note = {
      id: randomUUID(),
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
    this.upsertNote(note);
    this.insertVersion(makeVersion(note, 'create'));
    return structuredClone(note);
  }

  saveDraft(input: SaveDraftInput): Note {
    this.assertUnlocked();
    const note = this.requireNote(input.id);
    const nextSecretFields = input.secretFields.map((field) => {
      const existing = note.secretFields.find((item) => item.id === field.id);
      return this.prepareSecretForStorage({ ...field, noteId: note.id, id: field.id || randomUUID() }, existing);
    });
    const nextAttachments = input.attachments.map((attachment) => ({
      ...attachment,
      noteId: note.id,
      id: attachment.id || randomUUID()
    }));
    const changed =
      note.title !== input.title ||
      note.body !== input.body ||
      note.bodyHtml !== input.bodyHtml ||
      note.folder !== input.folder ||
      note.isFavorite !== input.isFavorite ||
      note.tags.join('\u0000') !== input.tags.join('\u0000') ||
      JSON.stringify(note.attachments) !== JSON.stringify(nextAttachments) ||
      JSON.stringify(note.secretFields) !== JSON.stringify(nextSecretFields);

    note.title = input.title.trim() || 'Untitled Note';
    note.body = input.body;
    note.bodyHtml = input.bodyHtml || htmlFromPlainText(input.body);
    note.folder = input.folder.trim() || 'Private';
    note.tags = input.tags.map((tag) => tag.trim()).filter(Boolean);
    note.isFavorite = input.isFavorite;
    note.attachments = nextAttachments;
    note.secretFields = nextSecretFields;
    note.summaryText = summarize(note.bodyHtml);

    if (changed) {
      note.currentVersionNo += 1;
      note.updatedAt = now();
      this.upsertNote(note);
      this.insertVersion(makeVersion(note, 'autosave'));
      this.pruneVersions(note.id);
    }

    return structuredClone(note);
  }

  moveToTrash(id: string): void {
    this.assertUnlocked();
    const note = this.requireNote(id);
    note.status = 'trashed';
    note.trashedAt = now();
    note.updatedAt = now();
    this.upsertNote(note);
  }

  restore(id: string): void {
    this.assertUnlocked();
    const note = this.requireNote(id);
    note.status = 'active';
    note.trashedAt = undefined;
    note.updatedAt = now();
    this.upsertNote(note);
  }

  deleteForever(id: string): void {
    this.assertUnlocked();
    const db = this.dbHandle();
    db.prepare('DELETE FROM note_versions WHERE note_id = ?').run(id);
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id);
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  toggleFavorite(id: string): Note {
    this.assertUnlocked();
    const note = this.requireNote(id);
    note.isFavorite = !note.isFavorite;
    note.updatedAt = now();
    this.upsertNote(note);
    return structuredClone(note);
  }

  search(query: string): SearchResult[] {
    this.assertUnlocked();
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return this.list('active').map((item) => ({ ...item, matchType: 'title', matchLabel: 'All notes' }));
    }

    const db = this.dbHandle();
    const normalRows = db
      .prepare(
        `SELECT n.*
         FROM notes_fts f
         JOIN notes n ON n.id = f.note_id
         WHERE notes_fts MATCH ? AND n.status = 'active'
         ORDER BY n.updated_at DESC`
      )
      .all(escapeFtsQuery(needle));

    const results = new Map<string, SearchResult>();
    for (const row of normalRows) {
      const note = rowToNote(row as unknown as NoteRow);
      results.set(note.id, {
        ...toListItem(note),
        matchType: matchTypeForNote(note, needle),
        matchLabel: 'Content'
      });
    }

    for (const note of this.allNotes('active')) {
      const secret = note.secretFields.find(
        (field) => this.secretSearchText(field).includes(needle) || field.label.toLowerCase().includes(needle)
      );
      if (secret && !results.has(note.id)) {
        results.set(note.id, {
          ...toListItem(note),
          secretHit: true,
          matchType: 'secret',
          matchLabel: secret.label
        });
      }
    }

    return [...results.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private secretSearchText(field: SecretField): string {
    if (field.value) {
      return field.value.toLowerCase();
    }
    if (!field.encryptedValue || !this.sessionKey) {
      return '';
    }
    try {
      return decryptWithKey(field.encryptedValue, this.sessionKey).toLowerCase();
    } catch {
      return '';
    }
  }

  revealSecret(fieldId: string): string {
    this.assertUnlocked();
    const field = this.allNotes().flatMap((note) => note.secretFields).find((item) => item.id === fieldId);
    if (!field) {
      throw new Error('Secret field not found');
    }
    if (field.value) {
      return field.value;
    }
    if (!field.encryptedValue) {
      throw new Error('Secret field has no encrypted value');
    }
    return decryptWithKey(field.encryptedValue, this.requireSessionKey());
  }

  listHistory(noteId: string): NoteVersion[] {
    this.assertUnlocked();
    return this.dbHandle()
      .prepare('SELECT * FROM note_versions WHERE note_id = ? ORDER BY created_at DESC')
      .all(noteId)
      .map((row) => {
        const version = rowToVersion(row as unknown as VersionRow);
        return {
          ...version,
          secretSnapshots: version.secretSnapshots.map(({ value, ...rest }) => rest)
        };
      });
  }

  restoreHistory(versionId: string): Note {
    this.assertUnlocked();
    const row = this.dbHandle().prepare('SELECT * FROM note_versions WHERE id = ?').get(versionId) as unknown as VersionRow | undefined;
    if (!row) {
      throw new Error('Version not found');
    }
    const version = rowToVersion(row);
    const note = this.requireNote(version.noteId);
    note.title = version.titleSnapshot;
    note.body = version.bodySnapshot;
    note.bodyHtml = version.bodyHtmlSnapshot;
    note.tags = [...version.tagsSnapshot];
    note.folder = version.folderSnapshot;
    note.secretFields = version.secretSnapshots.map((field) => ({ ...field, noteId: note.id }));
    note.currentVersionNo += 1;
    note.updatedAt = now();
    this.upsertNote(note);
    this.insertVersion(makeVersion(note, 'restore'));
    return structuredClone(note);
  }

  exportMarkdown(noteId: string, strategy: ExportSensitiveStrategy): ExportResult {
    this.assertUnlocked();
    const note = this.requireNote(noteId);
    const attachments = renderAttachmentsMarkdown(note.attachments);
    const secrets = renderSecretsMarkdown(this.secretsForExport(note.secretFields, strategy), strategy);
    return {
      fileName: `${safeFileName(note.title)}.md`,
      mimeType: 'text/markdown',
      content: [`# ${note.title}`, '', markdownFromHtml(note.bodyHtml || htmlFromPlainText(note.body)), '', attachments, '', secrets]
        .filter(Boolean)
        .join('\n')
    };
  }

  exportHtml(noteId: string, strategy: ExportSensitiveStrategy): ExportResult {
    this.assertUnlocked();
    const note = this.requireNote(noteId);
    const attachments = renderAttachmentsHtml(note.attachments);
    const secrets = renderSecretsHtml(this.secretsForExport(note.secretFields, strategy), strategy);
    return {
      fileName: `${safeFileName(note.title)}.html`,
      mimeType: 'text/html',
      content: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(note.title)}</title></head><body><article><h1>${escapeHtml(
        note.title
      )}</h1>${note.bodyHtml || htmlFromPlainText(note.body)}${attachments}${secrets}</article></body></html>`
    };
  }

  getSettings(): AppSettings {
    this.assertUnlocked();
    return {
      ...this.getSettingsUnsafe(),
      dataDirectory: dirname(this.dbPath)
    };
  }

  saveSettings(settings: AppSettings): AppSettings {
    this.assertUnlocked();
    this.setMeta(
      'settings',
      JSON.stringify({
        autoLockMinutes: Math.max(1, Math.min(120, Math.round(settings.autoLockMinutes))),
        dataDirectory: dirname(this.dbPath)
      })
    );
    return this.getSettings();
  }

  exportBackup(): ExportResult {
    this.assertUnlocked();
    const payload: BackupPayload = {
      exportedAt: now(),
      appVersion: '0.3.0',
      notes: this.allNotes(),
      versions: this.allVersions(),
      settings: this.getSettings()
    };
    return {
      fileName: `secure-notes-backup-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
      content: JSON.stringify(payload, null, 2)
    };
  }

  importBackup(payload: BackupPayload): void {
    this.assertUnlocked();
    if (!Array.isArray(payload.notes) || !Array.isArray(payload.versions)) {
      throw new Error('Invalid backup payload');
    }

    const db = this.dbHandle();
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM notes_fts; DELETE FROM note_versions; DELETE FROM notes;');
      for (const note of payload.notes) {
        this.upsertNote(normalizeNote(note));
      }
      for (const version of payload.versions) {
        this.insertVersion(normalizeVersion(version));
      }
      this.setMeta('settings', JSON.stringify(payload.settings ?? this.getSettingsUnsafe()));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  private migrate(): void {
    this.dbHandle().exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        body_html TEXT NOT NULL,
        folder TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        is_favorite INTEGER NOT NULL,
        status TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        attachments_json TEXT NOT NULL,
        secret_fields_json TEXT NOT NULL,
        current_version_no INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT NOT NULL,
        trashed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS note_versions (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        version_no INTEGER NOT NULL,
        title_snapshot TEXT NOT NULL,
        body_snapshot TEXT NOT NULL,
        body_html_snapshot TEXT NOT NULL,
        tags_snapshot_json TEXT NOT NULL,
        folder_snapshot TEXT NOT NULL,
        secret_snapshots_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        note_id UNINDEXED,
        title,
        body,
        tags
      );
    `);

    if (!this.getMeta('settings')) {
      this.setMeta('settings', JSON.stringify({ autoLockMinutes: 5, dataDirectory: dirname(this.dbPath) }));
    }
  }

  private seedIfEmpty(): void {
    const row = this.dbHandle().prepare('SELECT COUNT(*) AS count FROM notes').get() as { count: number };
    if (row.count > 0) {
      return;
    }
    for (const note of createSeedNotes()) {
      this.upsertNote(note);
      this.insertVersion(makeVersion(note, 'create'));
    }
  }

  private importLegacyJsonIfNeeded(): void {
    if (!this.legacyJsonPath || !existsSync(this.legacyJsonPath)) {
      return;
    }

    const hasMigration = this.getMeta('legacyJsonMigrated') === 'true';
    if (hasMigration) {
      return;
    }

    try {
      const legacy = JSON.parse(readFileSync(this.legacyJsonPath, 'utf8')) as LegacyStoreFile;
      if (!Array.isArray(legacy.notes) || legacy.notes.length === 0) {
        this.setMeta('legacyJsonMigrated', 'true');
        return;
      }

      const db = this.dbHandle();
      db.exec('BEGIN');
      try {
        db.exec('DELETE FROM notes_fts; DELETE FROM note_versions; DELETE FROM notes;');
        for (const note of legacy.notes) {
          this.upsertNote(normalizeNote(note));
        }
        for (const version of legacy.versions ?? legacy.notes.map((note) => makeVersion(normalizeNote(note), 'create'))) {
          this.insertVersion(normalizeVersion(version));
        }
        if (legacy.passwordHash) {
          this.setMeta('passwordHash', legacy.passwordHash);
        }
        if (legacy.settings) {
          this.setMeta('settings', JSON.stringify(legacy.settings));
        }
        this.setMeta('legacyJsonMigrated', 'true');
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } catch {
      this.setMeta('legacyJsonMigrated', 'true');
    }
  }

  private allNotes(status?: NoteStatus): Note[] {
    const sql = status ? 'SELECT * FROM notes WHERE status = ? ORDER BY updated_at DESC' : 'SELECT * FROM notes ORDER BY updated_at DESC';
    const rows = status ? this.dbHandle().prepare(sql).all(status) : this.dbHandle().prepare(sql).all();
    return rows.map((row) => this.hydrateAttachments(rowToNote(row as unknown as NoteRow)));
  }

  private allVersions(): NoteVersion[] {
    return this.dbHandle()
      .prepare('SELECT * FROM note_versions ORDER BY created_at DESC')
      .all()
      .map((row) => rowToVersion(row as unknown as VersionRow));
  }

  private requireNote(id: string): Note {
    const row = this.dbHandle().prepare('SELECT * FROM notes WHERE id = ?').get(id) as unknown as NoteRow | undefined;
    if (!row) {
      throw new Error('Note not found');
    }
    return this.hydrateAttachments(rowToNote(row));
  }

  private upsertNote(noteInput: Note): void {
    const note = normalizeNote({
      ...noteInput,
      attachments: noteInput.attachments.map((attachment) => this.prepareAttachmentForStorage(attachment, noteInput.id)),
      secretFields: noteInput.secretFields.map((field) => this.prepareSecretForStorage(field))
    });
    const db = this.dbHandle();
    db.prepare(
      `INSERT INTO notes (
        id, title, body, body_html, folder, tags_json, is_favorite, status, summary_text,
        attachments_json, secret_fields_json, current_version_no, created_at, updated_at, last_opened_at, trashed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        body_html = excluded.body_html,
        folder = excluded.folder,
        tags_json = excluded.tags_json,
        is_favorite = excluded.is_favorite,
        status = excluded.status,
        summary_text = excluded.summary_text,
        attachments_json = excluded.attachments_json,
        secret_fields_json = excluded.secret_fields_json,
        current_version_no = excluded.current_version_no,
        updated_at = excluded.updated_at,
        last_opened_at = excluded.last_opened_at,
        trashed_at = excluded.trashed_at`
    ).run(
      note.id,
      note.title,
      note.body,
      note.bodyHtml,
      note.folder,
      JSON.stringify(note.tags),
      note.isFavorite ? 1 : 0,
      note.status,
      note.summaryText,
      JSON.stringify(note.attachments),
      JSON.stringify(note.secretFields),
      note.currentVersionNo,
      note.createdAt,
      note.updatedAt,
      note.lastOpenedAt,
      note.trashedAt ?? null
    );
    this.indexNote(note);
  }

  private indexNote(note: Note): void {
    const db = this.dbHandle();
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(note.id);
    if (note.status === 'active') {
      db.prepare('INSERT INTO notes_fts(note_id, title, body, tags) VALUES (?, ?, ?, ?)').run(
        note.id,
        note.title,
        note.body,
        note.tags.join(' ')
      );
    }
  }

  private insertVersion(versionInput: NoteVersion): void {
    const version = normalizeVersion(versionInput);
    this.dbHandle()
      .prepare(
        `INSERT OR REPLACE INTO note_versions (
          id, note_id, version_no, title_snapshot, body_snapshot, body_html_snapshot,
          tags_snapshot_json, folder_snapshot, secret_snapshots_json, created_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        version.id,
        version.noteId,
        version.versionNo,
        version.titleSnapshot,
        version.bodySnapshot,
        version.bodyHtmlSnapshot,
        JSON.stringify(version.tagsSnapshot),
        version.folderSnapshot,
        JSON.stringify(version.secretSnapshots),
        version.createdAt,
        version.reason
      );
  }

  private pruneVersions(noteId: string): void {
    const rows = this.dbHandle()
      .prepare('SELECT id FROM note_versions WHERE note_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 50')
      .all(noteId) as Array<{ id: string }>;
    for (const row of rows) {
      this.dbHandle().prepare('DELETE FROM note_versions WHERE id = ?').run(row.id);
    }
  }

  private getSettingsUnsafe(): AppSettings {
    const value = this.getMeta('settings');
    if (!value) {
      return { autoLockMinutes: 5, dataDirectory: dirname(this.dbPath) };
    }
    return {
      autoLockMinutes: 5,
      dataDirectory: dirname(this.dbPath),
      ...JSON.parse(value)
    };
  }

  private getMeta(key: string): string | undefined {
    const row = this.dbHandle().prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  private hasMasterPassword(): boolean {
    return Boolean((this.getMeta('keySalt') && this.getMeta('keyVerifier')) || this.getMeta('passwordHash'));
  }

  private verifyMasterPassword(password: string): Buffer | null {
    const salt = this.getMeta('keySalt');
    const verifier = this.getMeta('keyVerifier');
    if (salt && verifier) {
      const key = deriveKey(password, salt);
      const expected = Buffer.from(verifier, 'base64');
      const actual = Buffer.from(verifierForKey(key), 'base64');
      return expected.length === actual.length && timingSafeEqual(expected, actual) ? key : null;
    }

    const legacyPasswordHash = this.getMeta('passwordHash');
    return legacyPasswordHash === hashPassword(password) ? this.sessionKey : null;
  }

  private secretsForExport(fields: SecretField[], strategy: ExportSensitiveStrategy): SecretField[] {
    if (strategy !== 'reveal') {
      return fields;
    }
    return fields.map((field) => ({
      ...field,
      value: field.value ?? (field.encryptedValue ? decryptWithKey(field.encryptedValue, this.requireSessionKey()) : '')
    }));
  }

  private setMeta(key: string, value: string): void {
    this.dbHandle().prepare('INSERT INTO app_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  private prepareSecretForStorage(field: SecretField, existing?: SecretField): SecretField {
    const value = field.value;
    if (value && !this.sessionKey) {
      return {
        ...field,
        maskedPreview: mask(value)
      };
    }

    const encryptedValue = value ? encryptWithKey(value, this.requireSessionKey()) : field.encryptedValue ?? existing?.encryptedValue;

    return {
      id: field.id || randomUUID(),
      noteId: field.noteId,
      label: field.label,
      fieldType: field.fieldType,
      maskedPreview: value ? mask(value) : field.maskedPreview || existing?.maskedPreview || '********',
      encryptedValue
    };
  }

  private reencryptSecretField(field: SecretField, currentKey: Buffer, nextKey: Buffer): SecretField {
    const hasSecretValue = field.value !== undefined || Boolean(field.encryptedValue);
    if (!hasSecretValue) {
      return field;
    }

    const value = field.value ?? decryptWithKey(field.encryptedValue ?? '', currentKey);
    return {
      ...field,
      value: undefined,
      encryptedValue: encryptWithKey(value, nextKey),
      maskedPreview: field.maskedPreview || mask(value)
    };
  }

  private prepareAttachmentForStorage(attachment: Note['attachments'][number], noteId: string): Note['attachments'][number] {
    if (!attachment.dataUrl || attachment.storageKey) {
      return { ...attachment, noteId };
    }

    const storageKey = `${noteId}-${attachment.id || randomUUID()}-${safeFileName(attachment.name)}`;
    const commaIndex = attachment.dataUrl.indexOf(',');
    const base64 = commaIndex >= 0 ? attachment.dataUrl.slice(commaIndex + 1) : attachment.dataUrl;
    writeFileSync(join(this.attachmentsDir, storageKey), Buffer.from(base64, 'base64'));

    return {
      ...attachment,
      noteId,
      storageKey,
      dataUrl: undefined
    };
  }

  private hydrateAttachments(note: Note): Note {
    return {
      ...note,
      attachments: note.attachments.map((attachment) => {
        if (attachment.dataUrl || !attachment.storageKey) {
          return attachment;
        }
        const path = join(this.attachmentsDir, attachment.storageKey);
        if (!existsSync(path)) {
          return attachment;
        }
        const data = readFileSync(path).toString('base64');
        return {
          ...attachment,
          dataUrl: `data:${attachment.mimeType};base64,${data}`
        };
      })
    };
  }

  private encryptPlaintextSecrets(): void {
    for (const note of this.allNotes()) {
      let changed = false;
      const secretFields = note.secretFields.map((field) => {
        if (!field.value) {
          return field;
        }
        changed = true;
        return this.prepareSecretForStorage(field);
      });
      if (changed) {
        this.upsertNote({ ...note, secretFields });
      }
    }
  }

  private requireSessionKey(): Buffer {
    if (!this.sessionKey) {
      throw new Error('Vault key is not available');
    }
    return this.sessionKey;
  }

  private assertUnlocked(): void {
    if (!this.unlocked) {
      throw new Error('Vault is locked');
    }
  }

  private dbHandle(): DatabaseSync {
    if (!this.db) {
      throw new Error('SQLite store is not initialized');
    }
    return this.db;
  }
}

export function createLocalStore(userDataPath: string): LocalStore {
  const store = new LocalStore(join(userDataPath, 'app.db'), userDataPath, join(userDataPath, 'secure-notes-store.json'));
  store.initialize();
  return store;
}

function normalizeNote(note: Note): Note {
  const bodyHtml = note.bodyHtml ?? htmlFromPlainText(note.body ?? '');
  return {
    ...note,
    body: note.body ?? stripHtml(bodyHtml),
    bodyHtml,
    summaryText: note.summaryText || summarize(bodyHtml),
    attachments: note.attachments ?? [],
    secretFields: (note.secretFields ?? []).map((field) => ({
      ...field,
      noteId: note.id,
      maskedPreview: field.maskedPreview || mask(field.value ?? '')
    })),
    currentVersionNo: note.currentVersionNo ?? 1,
    createdAt: note.createdAt ?? now(),
    updatedAt: note.updatedAt ?? now(),
    lastOpenedAt: note.lastOpenedAt ?? now()
  };
}

function normalizeVersion(version: NoteVersion): NoteVersion {
  return {
    ...version,
    bodyHtmlSnapshot: version.bodyHtmlSnapshot ?? htmlFromPlainText(version.bodySnapshot),
    tagsSnapshot: version.tagsSnapshot ?? [],
    secretSnapshots: version.secretSnapshots ?? []
  };
}

function rowToNote(row: NoteRow): Note {
  return normalizeNote({
    id: row.id,
    title: row.title,
    body: row.body,
    bodyHtml: row.body_html,
    folder: row.folder,
    tags: parseJson<string[]>(row.tags_json, []),
    isFavorite: row.is_favorite === 1,
    status: row.status,
    summaryText: row.summary_text,
    attachments: parseJson<Note['attachments']>(row.attachments_json, []),
    secretFields: parseJson<SecretField[]>(row.secret_fields_json, []),
    currentVersionNo: row.current_version_no,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    trashedAt: row.trashed_at ?? undefined
  });
}

function rowToVersion(row: VersionRow): NoteVersion {
  return normalizeVersion({
    id: row.id,
    noteId: row.note_id,
    versionNo: row.version_no,
    titleSnapshot: row.title_snapshot,
    bodySnapshot: row.body_snapshot,
    bodyHtmlSnapshot: row.body_html_snapshot,
    tagsSnapshot: parseJson<string[]>(row.tags_snapshot_json, []),
    folderSnapshot: row.folder_snapshot,
    secretSnapshots: parseJson<NoteVersion['secretSnapshots']>(row.secret_snapshots_json, []),
    createdAt: row.created_at,
    reason: row.reason
  });
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

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function escapeFtsQuery(query: string): string {
  return query
    .split(/\s+/)
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(' ');
}

function matchTypeForNote(note: Note, needle: string): SearchResult['matchType'] {
  if (note.title.toLowerCase().includes(needle)) return 'title';
  if (note.tags.some((tag) => tag.toLowerCase().includes(needle))) return 'tag';
  return 'body';
}

function renderSecretsMarkdown(fields: SecretField[], strategy: ExportSensitiveStrategy): string {
  if (strategy === 'exclude' || fields.length === 0) {
    return '';
  }

  return fields
    .map((field) => ['```secret', `label: ${field.label}`, `value: ${strategy === 'reveal' ? field.value : '********'}`, '```'].join('\n'))
    .join('\n\n');
}

function renderSecretsHtml(fields: SecretField[], strategy: ExportSensitiveStrategy): string {
  if (strategy === 'exclude' || fields.length === 0) {
    return '';
  }

  return `<section>${fields
    .map(
      (field) =>
        `<div><strong>${escapeHtml(field.label)}</strong><code>${escapeHtml(
          strategy === 'reveal' ? field.value ?? '' : '********'
        )}</code></div>`
    )
    .join('')}</section>`;
}

function renderAttachmentsMarkdown(attachments: Note['attachments']): string {
  if (attachments.length === 0) {
    return '';
  }
  return attachments
    .map((attachment) => {
      const caption = attachment.caption || attachment.name;
      return attachment.dataUrl ? `![${caption}](${attachment.dataUrl})` : `- Attachment: ${attachment.name}`;
    })
    .join('\n\n');
}

function renderAttachmentsHtml(attachments: Note['attachments']): string {
  if (attachments.length === 0) {
    return '';
  }
  return `<section>${attachments
    .map((attachment) =>
      attachment.dataUrl
        ? `<figure><img src="${attachment.dataUrl}" alt="${escapeHtml(attachment.caption || attachment.name)}"><figcaption>${escapeHtml(
            attachment.caption || attachment.name
          )}</figcaption></figure>`
        : `<p>Attachment: ${escapeHtml(attachment.name)}</p>`
    )
    .join('')}</section>`;
}

function markdownFromHtml(value: string): string {
  return value
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gis, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gis, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ').trim() || 'note';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
