import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/main/services/localStore';

function createStore() {
  const dir = mkdtempSync(join(tmpdir(), 'secure-notes-'));
  const store = new LocalStore(join(dir, 'app.db'), dir);
  store.initialize();
  return {
    dir,
    store,
    cleanup: () => {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('LocalStore persists notes in SQLite and encrypts secret values', () => {
  const { dir, store, cleanup } = createStore();
  try {
    assert.equal(store.unlock('password').ok, true);
    const [first] = store.list('active');
    assert.ok(first);

    const note = store.get(first.id);
    const secret = note.secretFields[0];
    assert.ok(secret.encryptedValue);
    assert.equal(secret.value, undefined);
    assert.equal(store.revealSecret(secret.id), 'AKIAIOSFODNN7EXAMPLE');

    const saved = store.saveDraft({
      id: note.id,
      title: `${note.title} Updated`,
      body: 'rotated key material',
      bodyHtml: '<p><strong>rotated</strong> key material</p>',
      folder: 'Engineering',
      tags: ['DevOps', 'Sensitive'],
      isFavorite: true,
      attachments: [],
      secretFields: [
        {
          id: secret.id,
          noteId: note.id,
          label: secret.label,
          fieldType: secret.fieldType,
          maskedPreview: secret.maskedPreview,
          value: 'NEW-SECRET-VALUE'
        }
      ]
    });

    assert.equal(saved.isFavorite, true);
    assert.equal(store.revealSecret(secret.id), 'NEW-SECRET-VALUE');
    assert.equal(store.search('rotated')[0].id, note.id);
    assert.equal(store.search('NEW-SECRET')[0].matchType, 'secret');
    assert.match(store.exportMarkdown(note.id, 'reveal').content, /NEW-SECRET-VALUE/);
    assert.ok(store.listHistory(note.id).length >= 2);

    store.lock();
    assert.throws(() => store.list('active'), /locked/);

    const reopened = new LocalStore(join(dir, 'app.db'), dir);
    reopened.initialize();
    assert.equal(reopened.unlock('password').ok, true);
    assert.equal(reopened.revealSecret(secret.id), 'NEW-SECRET-VALUE');
    reopened.close();
  } finally {
    cleanup();
  }
});

test('LocalStore initializes and changes master password', () => {
  const { dir, store, cleanup } = createStore();
  try {
    assert.equal(store.status().initialized, false);
    assert.deepEqual(store.unlock('first-password'), { ok: true, firstRun: true });
    assert.equal(store.status().initialized, true);

    const [first] = store.list('active');
    const note = store.get(first.id);
    const secret = note.secretFields[0];
    assert.equal(store.revealSecret(secret.id), 'AKIAIOSFODNN7EXAMPLE');

    assert.deepEqual(store.changePassword({ currentPassword: 'wrong-password', nextPassword: 'second-password' }), { ok: false });
    assert.equal(store.revealSecret(secret.id), 'AKIAIOSFODNN7EXAMPLE');
    assert.deepEqual(store.changePassword({ currentPassword: 'first-password', nextPassword: 'second-password' }), { ok: true });
    assert.equal(store.revealSecret(secret.id), 'AKIAIOSFODNN7EXAMPLE');

    store.lock();
    const reopened = new LocalStore(join(dir, 'app.db'), dir);
    reopened.initialize();
    assert.deepEqual(reopened.unlock('first-password'), { ok: false, firstRun: false });
    assert.deepEqual(reopened.unlock('second-password'), { ok: true, firstRun: false });
    assert.equal(reopened.revealSecret(secret.id), 'AKIAIOSFODNN7EXAMPLE');
    reopened.close();
  } finally {
    cleanup();
  }
});

test('LocalStore exports and imports backup payloads', () => {
  const source = createStore();
  const target = createStore();
  try {
    assert.equal(source.store.unlock('password').ok, true);
    assert.equal(target.store.unlock('password').ok, true);
    const backup = JSON.parse(source.store.exportBackup().content);
    target.store.importBackup(backup);
    assert.equal(target.store.list('active').length, source.store.list('active').length);
  } finally {
    source.cleanup();
    target.cleanup();
  }
});
