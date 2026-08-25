/**
 * Vault tests (srs FR-K1/K2) — OKF encrypted store with isolated dir.
 * AES-256-GCM + SHA-256; secrets never survive logging surfaces.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ow-vault-test-'));
process.env.OPENWORKER_DIR = dir;

const { setSecret, getSecret, deleteSecret, listSecrets, redactSecrets, safeEqual } =
  await import('../dist/vault.js');

const KEY = 'TESTKEY_openrouter';
const VALUE = 'sk-test-0123456789abcdef012345';

after(() => { rmSync(dir, { recursive: true, force: true }); });

test('set/get round-trips through the encrypted OKF store', () => {
  setSecret(KEY, VALUE);
  assert.equal(getSecret(KEY), VALUE);
});

test('secret material never appears in the redaction filter output', () => {
  const leaked = `error near api key ${VALUE} in module x`;
  assert.ok(!redactSecrets(leaked).includes(VALUE), 'loaded secret values must be redacted');
  // common credential shapes are masked even when unknown to the vault
  assert.ok(!redactSecrets('token ghp_abcdefghijklmnopqrstuvwxyz012345').includes('ghp_abcdefghijklmnopqrstuvwxyz'));
});

test('OKF files on disk are mode 0600 and contain no plaintext', () => {
  const { readdirSync } = await import('node:fs');
  const okfDir = join(dir, 'okf');
  for (const f of readdirSync(okfDir)) {
    const p = join(okfDir, f);
    assert.equal(statSync(p).mode & 0o777, 0o600, `${f} must be owner-only`);
    if (!f.endsWith('.idx')) {
      const raw = await import('node:fs');
      assert.ok(!raw.readFileSync(p, 'utf8').includes(VALUE), `${f} must not contain plaintext`);
    }
  }
});

test('deleteSecret removes the entry', () => {
  assert.equal(deleteSecret(KEY), true);
  assert.equal(getSecret(KEY), null);
});

test('listSecrets exposes key names only', () => {
  setSecret('K1', 'value-abcdef');
  const entries = listSecrets();
  assert.ok(entries.every(e => typeof e.key === 'string' && e.service === 'openworker'));
  assert.ok(entries.some(e => e.key === 'K1'));
});

test('safeEqual is a timing-safe equality check', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
});
