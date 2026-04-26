import {
  Bold,
  Heading2,
  Clock3,
  Code2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Hash,
  Image,
  Italic,
  KeyRound,
  List,
  LockKeyhole,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  Trash2,
  Undo2,
  Redo2,
  X
} from 'lucide-react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { mergeAttributes, Node } from '@tiptap/core';
import { ChangeEvent, ClipboardEvent, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  Attachment,
  BackupPayload,
  ExportSensitiveStrategy,
  Note,
  NoteListItem,
  NoteStatus,
  NoteVersion,
  SecretField,
  VaultStatus
} from '../../../shared/types/notes';
import { getNotesApi } from '../lib/localNotesApi';

const api = getNotesApi();

const SecretFieldNode = Node.create({
  name: 'secretField',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      label: {
        default: 'Secret field'
      },
      fieldId: {
        default: ''
      }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-secret-field]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-secret-field': 'true',
        class: 'tiptap-secret-node'
      }),
      ['span', { class: 'tiptap-node-icon' }, 'key'],
      ['span', {}, HTMLAttributes.label || 'Secret field'],
      ['code', {}, '********']
    ];
  }
});

const AttachmentReferenceNode = Node.create({
  name: 'attachmentReference',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      name: {
        default: 'Attachment'
      },
      attachmentId: {
        default: ''
      }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-attachment-reference]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-attachment-reference': 'true',
        class: 'tiptap-attachment-node'
      }),
      ['span', { class: 'tiptap-node-icon' }, 'file'],
      ['span', {}, HTMLAttributes.name || 'Attachment']
    ];
  }
});

type ViewFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'recent' }
  | { type: 'folder'; value: string }
  | { type: 'tag'; value: string }
  | { type: 'trash' };

interface NoteContextMenuState {
  note: NoteListItem;
  x: number;
  y: number;
}

export function App() {
  const [isUnlocked, setUnlocked] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [unlockError, setUnlockError] = useState('');
  const [statusFilter, setStatusFilter] = useState<NoteStatus>('active');
  const [viewFilter, setViewFilter] = useState<ViewFilter>({ type: 'all' });
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [isExportOpen, setExportOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [noteContextMenu, setNoteContextMenu] = useState<NoteContextMenuState | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  const activityTimer = useRef<number | null>(null);

  useEffect(() => {
    void api.app.status().then(setVaultStatus);
  }, []);

  async function unlock(password: string) {
    const result = await api.app.unlock(password);
    if (!result.ok) {
      setUnlockError('Password did not match this vault.');
      return;
    }
    setUnlocked(true);
    setVaultStatus({ initialized: true });
    setSettings(await api.settings.get());
    setUnlockError('');
    if (result.firstRun) {
      setToast('Vault password created');
    }
  }

  async function refresh(nextStatus = statusFilter, nextView = viewFilter) {
    const rawList = query.trim() && nextStatus === 'active' ? await api.search.query(query) : await api.note.list(nextStatus);
    const list = filterNotes(rawList, nextView);
    setNotes(list);
    if (list.length > 0) {
      const stillSelected = selectedNote && list.some((note) => note.id === selectedNote.id);
      if (!stillSelected) {
        setSelectedNote(await api.note.get(list[0].id));
      }
    } else {
      setSelectedNote(null);
    }
  }

  useEffect(() => {
    if (isUnlocked) {
      void refresh();
    }
  }, [isUnlocked, statusFilter, query, viewFilter]);

  useEffect(() => {
    if (!noteContextMenu) return;
    const closeMenu = () => setNoteContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [noteContextMenu]);

  useEffect(() => {
    if (!isUnlocked || !settings) return;

    const lock = async () => {
      await api.app.lock();
      setUnlocked(false);
      setToast('Vault locked');
    };
    const resetTimer = () => {
      if (activityTimer.current) {
        window.clearTimeout(activityTimer.current);
      }
      activityTimer.current = window.setTimeout(lock, settings.autoLockMinutes * 60 * 1000);
    };
    const events = ['keydown', 'pointerdown', 'mousemove'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (activityTimer.current) {
        window.clearTimeout(activityTimer.current);
      }
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isUnlocked, settings]);

  async function selectNote(id: string) {
    setSelectedNote(await api.note.get(id));
    setRevealedSecrets({});
  }

  async function createNote() {
    const note = await api.note.create();
    setSelectedNote(note);
    await refresh('active');
  }

  async function saveNote(next: Note) {
    setSelectedNote(next);
    const saved = await api.note.saveDraft({
      id: next.id,
      title: next.title,
      body: next.body,
      bodyHtml: next.bodyHtml,
      folder: next.folder,
      tags: next.tags,
      isFavorite: next.isFavorite,
      attachments: next.attachments,
      secretFields: next.secretFields
    });
    setSelectedNote(saved);
    await refresh();
    setToast('Saved');
  }

  async function moveToTrash() {
    if (!selectedNote) return;
    await api.note.moveToTrash(selectedNote.id);
    await refresh();
  }

  async function restoreNote() {
    if (!selectedNote) return;
    await api.note.restore(selectedNote.id);
    setStatusFilter('active');
    await refresh('active');
  }

  async function deleteForever() {
    if (!selectedNote) return;
    await api.note.deleteForever(selectedNote.id);
    await refresh();
  }

  async function deleteNoteFromList(note: NoteListItem) {
    setNoteContextMenu(null);
    if (note.status === 'trashed') {
      const confirmed = window.confirm(`Permanently delete "${note.title}"?`);
      if (!confirmed) return;
      await api.note.deleteForever(note.id);
      setToast('Note deleted');
    } else {
      await api.note.moveToTrash(note.id);
      setToast('Note moved to Trash');
    }
    await refresh();
  }

  async function reveal(field: SecretField) {
    if (revealedSecrets[field.id]) {
      setRevealedSecrets((current) => {
        const next = { ...current };
        delete next[field.id];
        return next;
      });
      return;
    }
    const value = await api.secret.reveal(field.id);
    setRevealedSecrets((current) => ({ ...current, [field.id]: value }));
  }

  async function copySecret(field: SecretField) {
    const value = revealedSecrets[field.id] ?? (await api.secret.reveal(field.id));
    await navigator.clipboard.writeText(value);
    setToast('Secret copied');
  }

  function applyViewFilter(filter: ViewFilter) {
    setViewFilter(filter);
    const status: NoteStatus = filter.type === 'trash' ? 'trashed' : 'active';
    setStatusFilter(status);
    void refresh(status, filter);
  }

  async function saveSettings(next: AppSettings) {
    const saved = await api.settings.save(next);
    setSettings(saved);
    setToast('Settings saved');
  }

  async function changePassword(currentPassword: string, nextPassword: string) {
    const result = await api.app.changePassword({ currentPassword, nextPassword });
    if (!result.ok) {
      return false;
    }
    setToast('Password updated');
    return true;
  }

  if (!isUnlocked) {
    return <LockScreen isInitialized={vaultStatus?.initialized ?? null} onUnlock={unlock} error={unlockError} />;
  }

  return (
    <main className={`desktop-stage ${isExportOpen ? 'modal-active' : ''}`}>
      <div className="workspace-window">
        <Sidebar
          viewFilter={viewFilter}
          onFilter={applyViewFilter}
          onLock={async () => {
            await api.app.lock();
            setUnlocked(false);
          }}
          onSettings={() => setSettingsOpen(true)}
        />
        <NoteList
          notes={notes}
          selectedId={selectedNote?.id}
          query={query}
          statusFilter={statusFilter}
          onCreate={createNote}
          onQuery={setQuery}
          onContextMenu={(note, x, y) => setNoteContextMenu({ note, x, y })}
          onSelect={selectNote}
        />
        <section className="editor-panel">
          <EditorToolbar
            disabled={!selectedNote}
            isHistoryOpen={isHistoryOpen}
            onExport={() => setExportOpen(true)}
            onHistory={() => setHistoryOpen((current) => !current)}
            onImage={() => document.getElementById('image-input')?.click()}
            onTrash={moveToTrash}
          />
          {selectedNote ? (
            <EditorCanvas
              note={selectedNote}
              revealedSecrets={revealedSecrets}
              onCopySecret={copySecret}
              onReveal={reveal}
              onRestore={restoreNote}
              onDeleteForever={deleteForever}
              onToast={setToast}
              onSave={saveNote}
            />
          ) : (
            <div className="empty-state">No notes in this view.</div>
          )}
        </section>
        {isHistoryOpen && selectedNote ? <VersionHistory noteId={selectedNote.id} onClose={() => setHistoryOpen(false)} onRestore={setSelectedNote} /> : null}
      </div>

      {isExportOpen && selectedNote ? <ExportDialog noteId={selectedNote.id} onClose={() => setExportOpen(false)} /> : null}
      {noteContextMenu ? (
        <NoteContextMenu
          note={noteContextMenu.note}
          x={noteContextMenu.x}
          y={noteContextMenu.y}
          onDelete={() => void deleteNoteFromList(noteContextMenu.note)}
        />
      ) : null}
      {isSettingsOpen && settings ? (
        <SettingsDialog
          settings={settings}
          onBackupImported={async () => {
            await refresh();
            setToast('Backup imported');
          }}
          onClose={() => setSettingsOpen(false)}
          onChangePassword={changePassword}
          onSave={saveSettings}
        />
      ) : null}
      {toast ? <div className="toast" onAnimationEnd={() => setToast('')}>{toast}</div> : null}
    </main>
  );
}

function LockScreen({
  isInitialized,
  onUnlock,
  error
}: {
  isInitialized: boolean | null;
  onUnlock: (password: string) => Promise<void>;
  error: string;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const isSetup = isInitialized === false;
  const isLoading = isInitialized === null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    if (isLoading) return;
    if (isSetup && password.length < 8) {
      setLocalError('Use at least 8 characters.');
      return;
    }
    if (isSetup && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    void onUnlock(password);
  }

  return (
    <main className="lock-stage">
      <form className="unlock-card" onSubmit={submit}>
        <div className="unlock-icon">
          <LockKeyhole size={40} strokeWidth={2.3} />
        </div>
        <h1>Local Vault</h1>
        <p>{isSetup ? 'Create your master password.' : 'Enter your master password.'}</p>
        <input aria-label="Master password" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        {isSetup ? (
          <input
            aria-label="Confirm master password"
            placeholder="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        ) : null}
        <button type="submit" disabled={isLoading || !password}>{isSetup ? 'Create Vault' : 'Unlock'}</button>
        <small className="unlock-error">{localError || error}</small>
        <span>{isSetup ? 'MINIMUM 8 CHARACTERS' : 'SECURE LOCAL VAULT'}</span>
      </form>
    </main>
  );
}

function Sidebar({
  viewFilter,
  onFilter,
  onLock,
  onSettings
}: {
  viewFilter: ViewFilter;
  onFilter: (filter: ViewFilter) => void;
  onLock: () => void;
  onSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <nav className="nav-section">
        <div className="section-label">Vault</div>
        <button className={`nav-item ${viewFilter.type === 'all' ? 'active' : ''}`} onClick={() => onFilter({ type: 'all' })}>
          <FileText size={20} />
          <span>All Notes</span>
        </button>
        <button className={`nav-item ${viewFilter.type === 'favorites' ? 'active' : ''}`} onClick={() => onFilter({ type: 'favorites' })}>
          <Star size={20} />
          <span>Favorites</span>
        </button>
        <button className={`nav-item ${viewFilter.type === 'recent' ? 'active' : ''}`} onClick={() => onFilter({ type: 'recent' })}>
          <Clock3 size={20} />
          <span>Recent</span>
        </button>
      </nav>

      <nav className="nav-section folders">
        <div className="section-label">Folders</div>
        {['Engineering', 'Work', 'Private'].map((folder) => (
          <button className={`nav-item folder ${viewFilter.type === 'folder' && viewFilter.value === folder ? 'active' : ''}`} key={folder} onClick={() => onFilter({ type: 'folder', value: folder })}>
            <Folder size={20} />
            <span>{folder}</span>
          </button>
        ))}
      </nav>

      <nav className="nav-section tags-section">
        <div className="section-label">Tags</div>
        {['DevOps', 'Design', 'Sensitive'].map((tag) => (
          <button className={`tag-nav ${viewFilter.type === 'tag' && viewFilter.value === tag ? 'active' : ''}`} key={tag} onClick={() => onFilter({ type: 'tag', value: tag })}>
            <Hash size={19} />
            <span>{tag}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className={`nav-item ${viewFilter.type === 'trash' ? 'active' : ''}`} onClick={() => onFilter({ type: 'trash' })}>
          <Trash2 size={19} />
          <span>Trash</span>
        </button>
        <button className="nav-item" onClick={onSettings}>
          <Settings size={19} />
          <span>Settings</span>
        </button>
        <button className="nav-item" onClick={onLock}>
          <LockKeyhole size={19} />
          <span>Lock Vault</span>
        </button>
      </div>
    </aside>
  );
}

function NoteList({
  notes,
  selectedId,
  query,
  statusFilter,
  onCreate,
  onContextMenu,
  onQuery,
  onSelect
}: {
  notes: NoteListItem[];
  selectedId?: string;
  query: string;
  statusFilter: NoteStatus;
  onCreate: () => void;
  onContextMenu: (note: NoteListItem, x: number, y: number) => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
}) {
  function openContextMenu(event: MouseEvent<HTMLButtonElement>, note: NoteListItem) {
    event.preventDefault();
    onSelect(note.id);
    onContextMenu(note, event.clientX, event.clientY);
  }

  return (
    <section className="note-list-panel">
      <header className="note-list-header">
        <h2>{statusFilter === 'trashed' ? 'Trash' : 'All Notes'}</h2>
        <button className="icon-button flat" onClick={onCreate} aria-label="Create note">
          <Plus size={23} />
        </button>
      </header>

      <label className="search-field">
        <Search size={19} />
        <input placeholder="Search notes, fields..." value={query} onChange={(event) => onQuery(event.target.value)} />
      </label>

      <div className="note-cards">
        {notes.map((note) => (
          <button
            className={`note-card ${note.id === selectedId ? 'selected' : ''}`}
            key={note.id}
            onClick={() => onSelect(note.id)}
            onContextMenu={(event) => openContextMenu(event, note)}
          >
            <span className="note-card-top">
              <strong>{note.title}</strong>
              <time>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
            </span>
            <span className="note-summary">{note.secretHit ? `Secret match: ${'matchLabel' in note ? note.matchLabel : 'Sensitive field'}` : note.summaryText}</span>
            <span className="note-tags">
              {note.tags.map((tag) => (
                <span className={`note-tag ${tag === 'DevOps' || tag === 'Sensitive' ? 'tag-blue' : 'tag-gray'}`} key={tag}>
                  {tag}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function NoteContextMenu({
  note,
  x,
  y,
  onDelete
}: {
  note: NoteListItem;
  x: number;
  y: number;
  onDelete: () => void;
}) {
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 56);

  return (
    <div className="note-context-menu" style={{ left, top }} onPointerDown={(event) => event.stopPropagation()}>
      <button className={note.status === 'trashed' ? 'danger' : ''} onClick={onDelete}>
        <Trash2 size={16} />
        <span>{note.status === 'trashed' ? 'Delete Forever' : 'Move to Trash'}</span>
      </button>
    </div>
  );
}

function EditorToolbar({
  disabled,
  isHistoryOpen,
  onExport,
  onHistory,
  onImage,
  onTrash
}: {
  disabled: boolean;
  isHistoryOpen: boolean;
  onExport: () => void;
  onHistory: () => void;
  onImage: () => void;
  onTrash: () => void;
}) {
  return (
    <header className="editor-toolbar">
      <div className="toolbar-group">
        <button className="tool-button" aria-label="Bold">
          <Bold size={20} />
        </button>
        <button className="tool-button" aria-label="Italic">
          <Italic size={20} />
        </button>
        <button className="tool-button" aria-label="List">
          <List size={20} />
        </button>
        <span className="toolbar-divider" />
        <button className="tool-button" aria-label="Code block">
          <Code2 size={20} />
        </button>
        <button className="tool-button" disabled={disabled} onClick={onImage} aria-label="Insert image">
          <Image size={20} />
        </button>
        <button className="tool-button" aria-label="Attach file">
          <Paperclip size={20} />
        </button>
        <button className="tool-button" aria-label="Insert secret field">
          <KeyRound size={20} />
        </button>
      </div>

      <div className="toolbar-group actions">
        <button className={`tool-button ${isHistoryOpen ? 'active' : ''}`} disabled={disabled} onClick={onHistory} aria-label="Version History" title="Version History">
          <RotateCcw size={20} />
        </button>
        <button className="tool-button" disabled={disabled} onClick={onExport} aria-label="Export note" title="Export">
          <Download size={20} />
        </button>
        <button className="tool-button" disabled={disabled} onClick={onTrash} aria-label="Move to trash" title="Move to trash">
          <Trash2 size={20} />
        </button>
        <span className="toolbar-divider" />
        <button className="tool-button" aria-label="More actions">
          <MoreHorizontal size={22} />
        </button>
      </div>
    </header>
  );
}

function EditorCanvas({
  note,
  revealedSecrets,
  onCopySecret,
  onDeleteForever,
  onRestore,
  onReveal,
  onToast,
  onSave
}: {
  note: Note;
  revealedSecrets: Record<string, string>;
  onCopySecret: (field: SecretField) => void;
  onDeleteForever: () => void;
  onRestore: () => void;
  onReveal: (field: SecretField) => void;
  onToast: (message: string) => void;
  onSave: (note: Note) => void;
}) {
  const [draft, setDraft] = useState(note);
  const tagText = useMemo(() => draft.tags.join(', '), [draft.tags]);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  function update(next: Partial<Note>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function save() {
    void onSave(draft);
  }

  function attachmentNameFor(file: File): string {
    if (file.name) {
      return file.name;
    }
    const extension = file.type.split('/')[1] || 'png';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `pasted-image-${timestamp}.${extension}`;
  }

  function fileToAttachment(file: File): Promise<Attachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read pasted image'));
      reader.onload = () => {
        resolve({
          id: crypto.randomUUID(),
          noteId: draft.id,
          name: attachmentNameFor(file),
          mimeType: file.type || 'image/png',
          sizeBytes: file.size,
          caption: '',
          dataUrl: String(reader.result),
          createdAt: new Date().toISOString()
        });
      };
      reader.readAsDataURL(file);
    });
  }

  async function addAttachment(file: File) {
    const attachment = await fileToAttachment(file);
    setDraft((current) => {
      const next = { ...current, attachments: [...current.attachments, { ...attachment, noteId: current.id }] };
      void onSave(next);
      return next;
    });
  }

  function addSecret() {
    const field: SecretField = {
      id: crypto.randomUUID(),
      noteId: draft.id,
      label: 'CUSTOM SECRET',
      fieldType: 'text',
      value: 'replace-me',
      maskedPreview: '********'
    };
    update({ secretFields: [...draft.secretFields, field] });
  }

  function removeSecret(fieldId: string) {
    const next = {
      ...draft,
      secretFields: draft.secretFields.filter((field) => field.id !== fieldId)
    };
    setDraft(next);
    void onSave(next);
  }

  function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void addAttachment(file);
    event.target.value = '';
  }

  function pasteImage(event: ClipboardEvent<HTMLElement>) {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
    const file = imageItem?.getAsFile() ?? Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'));
    if (!file) return;

    event.preventDefault();
    void addAttachment(file);
  }

  return (
    <article className="editor-canvas" onPaste={pasteImage}>
      <input className="title-input" value={draft.title} onChange={(event) => update({ title: event.target.value })} onBlur={save} />
      <div className="note-subline">
        <span>
          <Clock3 size={19} />
          Edited {new Date(draft.updatedAt).toLocaleString()}
        </span>
        <span>
          <Folder size={19} />
          <input className="inline-input" value={draft.folder} onChange={(event) => update({ folder: event.target.value })} onBlur={save} />
        </span>
      </div>
      <label className="metadata-row">
        Tags
        <input value={tagText} onChange={(event) => update({ tags: event.target.value.split(',') })} onBlur={save} />
      </label>
      <div className="editor-divider" />
      <RichTextEditor
        html={draft.bodyHtml || htmlFromPlainText(draft.body)}
        onBlur={save}
        onChange={(bodyHtml, body) => update({ bodyHtml, body })}
      />
      <input id="image-input" className="hidden-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={addImage} />
      <button className="secondary-button" onClick={addSecret}>
        <KeyRound size={17} />
        Add secret field
      </button>

      {draft.secretFields.map((field, index) => (
        <SecretFieldBlock
          field={field}
          index={index}
          key={field.id}
          revealed={revealedSecrets[field.id]}
          onCopy={() => onCopySecret(field)}
          onRemove={() => removeSecret(field.id)}
          onReveal={() => onReveal(field)}
          onUpdate={(next) => {
            const fields = draft.secretFields.map((item) => (item.id === field.id ? { ...item, ...next } : item));
            update({ secretFields: fields });
          }}
        />
      ))}

      <AttachmentsGallery
        attachments={draft.attachments}
        onCaption={(attachmentId, caption) =>
          update({
            attachments: draft.attachments.map((attachment) => (attachment.id === attachmentId ? { ...attachment, caption } : attachment))
          })
        }
        onToast={onToast}
        onRemove={(attachmentId) =>
          update({
            attachments: draft.attachments.filter((attachment) => attachment.id !== attachmentId)
          })
        }
      />
      <div className="editor-actions">
        <button className="primary-button" onClick={save}>Save Draft</button>
        {draft.status === 'trashed' ? <button className="secondary-button" onClick={onRestore}>Restore</button> : null}
        {draft.status === 'trashed' ? <button className="danger-button" onClick={onDeleteForever}>Delete Forever</button> : null}
      </div>
    </article>
  );
}

function SecretFieldBlock({
  field,
  index,
  revealed,
  onCopy,
  onRemove,
  onReveal,
  onUpdate
}: {
  field: SecretField;
  index: number;
  revealed?: string;
  onCopy: () => void;
  onRemove: () => void;
  onReveal: () => void;
  onUpdate: (field: Partial<SecretField>) => void;
}) {
  return (
    <section className="secret-block">
      <div className="secret-icon">
        <KeyRound size={22} />
      </div>
      <div className="secret-content">
        <input className="secret-label-input" value={field.label} onChange={(event) => onUpdate({ label: event.target.value })} />
        <input
          className="secret-value-input"
          type={revealed ? 'text' : 'password'}
          value={revealed ?? field.value ?? ''}
          onChange={(event) => onUpdate({ value: event.target.value, maskedPreview: '*'.repeat(Math.max(event.target.value.length, 8)) })}
          aria-label={`Secret field ${index + 1}`}
        />
      </div>
      <button className="tool-button" onClick={onReveal} aria-label="Reveal secret">{revealed ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      <button className="tool-button" onClick={onCopy} aria-label="Copy secret"><FileText size={18} /></button>
      <button className="tool-button danger-icon" onClick={onRemove} aria-label="Delete secret field" title="Delete secret field">
        <Trash2 size={18} />
      </button>
    </section>
  );
}

function RichTextEditor({
  html,
  onBlur,
  onChange
}: {
  html: string;
  onBlur: () => void;
  onChange: (bodyHtml: string, body: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        }
      }),
      SecretFieldNode,
      AttachmentReferenceNode
    ],
    content: html,
    editorProps: {
      attributes: {
        class: 'tiptap-surface'
      }
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML(), editor.getText());
    },
    onBlur() {
      onBlur();
    }
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== html) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [editor, html]);

  if (!editor) {
    return <div className="rich-editor loading">Loading editor...</div>;
  }

  return (
    <section className="rich-editor">
      <RichTextToolbar editor={editor} />
      <EditorContent editor={editor} />
    </section>
  );
}

function RichTextToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="rich-toolbar" aria-label="Rich text controls">
      <button className={editor.isActive('heading', { level: 2 }) ? 'active' : ''} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} type="button" aria-label="Heading">
        <Heading2 size={18} />
      </button>
      <button className={editor.isActive('bold') ? 'active' : ''} onClick={() => editor.chain().focus().toggleBold().run()} type="button" aria-label="Bold">
        <Bold size={18} />
      </button>
      <button className={editor.isActive('italic') ? 'active' : ''} onClick={() => editor.chain().focus().toggleItalic().run()} type="button" aria-label="Italic">
        <Italic size={18} />
      </button>
      <button className={editor.isActive('bulletList') ? 'active' : ''} onClick={() => editor.chain().focus().toggleBulletList().run()} type="button" aria-label="Bullet list">
        <List size={18} />
      </button>
      <button className={editor.isActive('codeBlock') ? 'active' : ''} onClick={() => editor.chain().focus().toggleCodeBlock().run()} type="button" aria-label="Code block">
        <Code2 size={18} />
      </button>
      <button className={editor.isActive('blockquote') ? 'active' : ''} onClick={() => editor.chain().focus().toggleBlockquote().run()} type="button" aria-label="Blockquote">
        <FileText size={18} />
      </button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} type="button" aria-label="Horizontal rule">
        <MoreHorizontal size={18} />
      </button>
      <span />
      <button
        onClick={() => editor.chain().focus().insertContent({ type: 'secretField', attrs: { label: 'Secret field', fieldId: crypto.randomUUID() } }).run()}
        type="button"
        aria-label="Insert secret field node"
      >
        <KeyRound size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().insertContent({ type: 'attachmentReference', attrs: { name: 'Attachment', attachmentId: crypto.randomUUID() } }).run()}
        type="button"
        aria-label="Insert attachment node"
      >
        <Paperclip size={18} />
      </button>
      <span />
      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} type="button" aria-label="Undo">
        <Undo2 size={18} />
      </button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} type="button" aria-label="Redo">
        <Redo2 size={18} />
      </button>
    </div>
  );
}

function AttachmentsGallery({
  attachments,
  onCaption,
  onToast,
  onRemove
}: {
  attachments: Attachment[];
  onCaption: (attachmentId: string, caption: string) => void;
  onToast: (message: string) => void;
  onRemove: (attachmentId: string) => void;
}) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [imageContextMenu, setImageContextMenu] = useState<{ attachment: Attachment; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!previewAttachment) return;
    const handlePreviewKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewAttachment(null);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copyAttachmentImage(previewAttachment);
      }
    };
    window.addEventListener('keydown', handlePreviewKeyDown);
    return () => window.removeEventListener('keydown', handlePreviewKeyDown);
  }, [previewAttachment]);

  useEffect(() => {
    if (!imageContextMenu) return;
    const closeMenu = () => setImageContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [imageContextMenu]);

  async function copyAttachmentImage(attachment: Attachment) {
    if (!attachment.dataUrl) return;
    try {
      await api.clipboard.writeImage({ dataUrl: attachment.dataUrl });
      setImageContextMenu(null);
      onToast('Image copied');
    } catch {
      onToast('Unable to copy image');
    }
  }

  function openImageContextMenu(event: MouseEvent<HTMLImageElement>, attachment: Attachment) {
    event.preventDefault();
    setImageContextMenu({ attachment, x: event.clientX, y: event.clientY });
  }

  if (attachments.length === 0) {
    return <ServerRackImage />;
  }

  return (
    <>
      <div className="attachment-gallery">
        {attachments.map((attachment) => (
          <figure className="attachment-card" key={attachment.id}>
            {attachment.dataUrl && attachment.mimeType.startsWith('image/') ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.caption || attachment.name}
                onDoubleClick={() => setPreviewAttachment(attachment)}
                onContextMenu={(event) => openImageContextMenu(event, attachment)}
                title="Double-click to preview"
              />
            ) : (
              <div className="attachment-file"><Paperclip size={20} />{attachment.name}</div>
            )}
            <figcaption>
              <input placeholder="Image caption" value={attachment.caption} onChange={(event) => onCaption(attachment.id, event.target.value)} />
              <button className="text-button compact" onClick={() => onRemove(attachment.id)}>Remove</button>
            </figcaption>
          </figure>
        ))}
      </div>
      {imageContextMenu ? (
        <ImageContextMenu
          attachment={imageContextMenu.attachment}
          x={imageContextMenu.x}
          y={imageContextMenu.y}
          onCopy={() => void copyAttachmentImage(imageContextMenu.attachment)}
        />
      ) : null}
      {previewAttachment?.dataUrl ? (
        <div className="image-preview-backdrop" role="dialog" aria-modal="true" aria-label={previewAttachment.caption || previewAttachment.name} onClick={() => setPreviewAttachment(null)}>
          <figure className="image-preview" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button flat image-preview-close" onClick={() => setPreviewAttachment(null)} aria-label="Close image preview">
              <X size={24} />
            </button>
            <img src={previewAttachment.dataUrl} alt={previewAttachment.caption || previewAttachment.name} onContextMenu={(event) => openImageContextMenu(event, previewAttachment)} />
            <figcaption>{previewAttachment.caption || previewAttachment.name}</figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}

function ImageContextMenu({
  attachment,
  x,
  y,
  onCopy
}: {
  attachment: Attachment;
  x: number;
  y: number;
  onCopy: () => void;
}) {
  const left = Math.min(x, window.innerWidth - 190);
  const top = Math.min(y, window.innerHeight - 56);

  return (
    <div className="image-context-menu" style={{ left, top }} onPointerDown={(event) => event.stopPropagation()}>
      <button onClick={onCopy} aria-label={`Copy ${attachment.caption || attachment.name}`}>
        <FileText size={16} />
        <span>Copy image</span>
      </button>
    </div>
  );
}

function ServerRackImage() {
  return (
    <figure className="server-rack" aria-label="Server rack attachment">
      <div className="rack-frame">
        {Array.from({ length: 7 }).map((_, row) => (
          <div className="rack-row" key={row}>
            {Array.from({ length: 5 }).map((__, column) => (
              <span key={column} />
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}

function VersionHistory({ noteId, onClose, onRestore }: { noteId: string; onClose: () => void; onRestore: (note: Note) => void }) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);

  useEffect(() => {
    void api.history.list(noteId).then(setVersions);
  }, [noteId]);

  async function restore(versionId: string) {
    const note = await api.history.restore(versionId);
    onRestore(note);
    setVersions(await api.history.list(note.id));
  }

  return (
    <aside className="history-drawer">
      <header>
        <h2>Version History</h2>
        <button className="icon-button flat" onClick={onClose} aria-label="Close version history">
          <X size={22} />
        </button>
      </header>
      <ol className="history-list">
        {versions.map((entry, index) => (
          <li className={index === 0 ? 'current' : ''} key={entry.id}>
            <span className="history-dot" />
            <button onClick={() => restore(entry.id)}>
              <strong>{index === 0 ? 'Current Version' : entry.reason === 'restore' ? 'Restored version' : 'Saved draft'}</strong>
              <time>{new Date(entry.createdAt).toLocaleString()}</time>
              <small>Version {entry.versionNo}</small>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ExportDialog({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const [format, setFormat] = useState<'markdown' | 'html'>('markdown');
  const [strategy, setStrategy] = useState<ExportSensitiveStrategy>('mask');

  async function exportFile() {
    const result = format === 'markdown' ? await api.export.markdown(noteId, strategy) : await api.export.html(noteId, strategy);
    await api.file.saveText({
      ...result,
      filters: format === 'markdown' ? [{ name: 'Markdown', extensions: ['md'] }] : [{ name: 'HTML', extensions: ['html'] }]
    });
    onClose();
  }

  return (
    <div className="modal-backdrop">
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header className="dialog-header">
          <h2 id="export-title">Export Note</h2>
          <button className="icon-button flat" onClick={onClose} aria-label="Close dialog">
            <X size={24} />
          </button>
        </header>
        <div className="dialog-body">
          <div className="field-group">
            <label>Format</label>
            <div className="segmented-control">
              <button className={format === 'markdown' ? 'selected' : ''} onClick={() => setFormat('markdown')}>Markdown (.md)</button>
              <button className={format === 'html' ? 'selected' : ''} onClick={() => setFormat('html')}>HTML (.html)</button>
            </div>
          </div>
          <div className="field-group">
            <label>Sensitive Data Strategy</label>
            <div className="sensitive-options">
              <SensitiveOption active={strategy === 'mask'} label="Mask fields safely" description="Values will be replaced with asterisks (****)" onClick={() => setStrategy('mask')} />
              <SensitiveOption active={strategy === 'reveal'} danger label="Reveal as plaintext" description="Not recommended for sharing" onClick={() => setStrategy('reveal')} />
              <SensitiveOption active={strategy === 'exclude'} label="Exclude entirely" description="Sensitive blocks will be removed from the export" onClick={() => setStrategy('exclude')} />
            </div>
          </div>
        </div>
        <footer className="dialog-footer">
          <button className="text-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={exportFile}><Download size={19} />Export File</button>
        </footer>
      </section>
    </div>
  );
}

function SettingsDialog({
  settings,
  onBackupImported,
  onChangePassword,
  onClose,
  onSave
}: {
  settings: AppSettings;
  onBackupImported: () => Promise<void>;
  onChangePassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', nextPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isChangingPassword, setChangingPassword] = useState(false);

  async function exportBackup() {
    const result = await api.backup.export();
    await api.file.saveText({ ...result, filters: [{ name: 'JSON', extensions: ['json'] }] });
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const payload = JSON.parse(await file.text()) as BackupPayload;
    await api.backup.import(payload);
    await onBackupImported();
    event.target.value = '';
    onClose();
  }

  async function submitPasswordChange() {
    setPasswordError('');
    setPasswordMessage('');
    if (!passwordDraft.currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (passwordDraft.nextPassword.length < 8) {
      setPasswordError('Use at least 8 characters for the new password.');
      return;
    }
    if (passwordDraft.nextPassword !== passwordDraft.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const ok = await onChangePassword(passwordDraft.currentPassword, passwordDraft.nextPassword);
      if (!ok) {
        setPasswordError('Current password is incorrect.');
        return;
      }
      setPasswordDraft({ currentPassword: '', nextPassword: '', confirmPassword: '' });
      setPasswordMessage('Password updated.');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="modal-backdrop settings-backdrop">
      <section className="export-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="dialog-header">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-button flat" onClick={onClose} aria-label="Close settings">
            <X size={24} />
          </button>
        </header>
        <div className="dialog-body">
          <div className="field-group">
            <label>Privacy</label>
            <div className="setting-row">
              <span>Auto-lock after</span>
              <input
                type="number"
                min={1}
                max={120}
                value={draft.autoLockMinutes}
                onChange={(event) => setDraft({ ...draft, autoLockMinutes: Number(event.target.value) })}
              />
              <span>minutes</span>
            </div>
          </div>
          <div className="field-group">
            <label>Master Password</label>
            <div className="password-panel">
              <div className="password-grid">
                <input
                  aria-label="Current password"
                  placeholder="Current password"
                  type="password"
                  value={passwordDraft.currentPassword}
                  onChange={(event) => setPasswordDraft({ ...passwordDraft, currentPassword: event.target.value })}
                />
                <input
                  aria-label="New password"
                  placeholder="New password"
                  type="password"
                  value={passwordDraft.nextPassword}
                  onChange={(event) => setPasswordDraft({ ...passwordDraft, nextPassword: event.target.value })}
                />
                <input
                  aria-label="Confirm new password"
                  placeholder="Confirm new password"
                  type="password"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) => setPasswordDraft({ ...passwordDraft, confirmPassword: event.target.value })}
                />
              </div>
              <div className="password-actions">
                <button className="secondary-button" onClick={submitPasswordChange} disabled={isChangingPassword}>
                  <KeyRound size={17} />
                  Update Password
                </button>
                <small className={passwordError ? 'settings-error' : 'settings-message'}>{passwordError || passwordMessage}</small>
              </div>
            </div>
          </div>
          <div className="field-group">
            <label>Data</label>
            <div className="data-path">{draft.dataDirectory}</div>
            <div className="settings-actions">
              <button className="secondary-button" onClick={exportBackup}>
                <Download size={17} />
                Export Backup
              </button>
              <label className="secondary-button">
                <Paperclip size={17} />
                Import Backup
                <input className="hidden-file-input" type="file" accept="application/json" onChange={importBackup} />
              </label>
            </div>
          </div>
        </div>
        <footer className="dialog-footer">
          <button className="text-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={() => void onSave(draft)}>Save Settings</button>
        </footer>
      </section>
    </div>
  );
}

function SensitiveOption({
  active,
  danger,
  description,
  label,
  onClick
}: {
  active: boolean;
  danger?: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`sensitive-option ${active ? 'selected' : ''} ${danger ? 'danger' : ''}`} onClick={onClick}>
      <span className="radio-dot" />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function filterNotes(notes: NoteListItem[], filter: ViewFilter): NoteListItem[] {
  switch (filter.type) {
    case 'favorites':
      return notes.filter((note) => note.isFavorite);
    case 'recent':
      return [...notes].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    case 'folder':
      return notes.filter((note) => note.folder === filter.value);
    case 'tag':
      return notes.filter((note) => note.tags.includes(filter.value));
    default:
      return notes;
  }
}

function htmlFromPlainText(value: string): string {
  return `<p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
