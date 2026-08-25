/**
 * Config tests (architecture.md §3 config.ts) — isolated OPENWORKER_DIR.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ow-config-test-'));
process.env.OPENWORKER_DIR = dir;

const {
  loadOwConfig, updateOwConfig, saveOwConfig, resetOwConfigCache,
  openworkerDir, getConfigPath, DEFAULT_CONFIG, deepMerge
} = await import('../dist/config.js');

beforeEach(() => { resetOwConfigCache(); });

after(() => { rmSync(dir, { recursive: true, force: true }); });

test('defaults are returned when no config file exists', () => {
  assert.equal(existsSync(getConfigPath()), false);
  const cfg = loadOwConfig();
  assert.deepEqual(cfg.policy, DEFAULT_CONFIG.policy);
  assert.equal(cfg.server.host, '127.0.0.1', 'loopback default (NFR-9)');
});

test('updateOwConfig persists and merges partial updates', () => {
  updateOwConfig({ policy: { default: 'deny-list' }, providers: { primary: 'openrouter' } });
  resetOwConfigCache();
  const cfg = loadOwConfig();
  assert.equal(cfg.policy.default, 'deny-list');
  assert.equal(cfg.providers.primary, 'openrouter');
  assert.equal(cfg.server.port, DEFAULT_CONFIG.server.port, 'unrelated keys untouched');
  const raw = JSON.parse(readFileSync(getConfigPath(), 'utf8'));
  assert.equal(raw.policy.default, 'deny-list');
});

test('corrupt config falls back to defaults instead of crashing', () => {
  saveOwConfig({ ...DEFAULT_CONFIG });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(getConfigPath(), '{not json', { mode: 0o600 });
  resetOwConfigCache();
  const cfg = loadOwConfig();
  assert.deepEqual(cfg.policy, DEFAULT_CONFIG.policy);
});

test('openworkerDir honours env override', () => {
  assert.equal(openworkerDir(), dir);
});

test('deepMerge is recursive for objects, replaces arrays/scalars', () => {
  const merged = deepMerge({ a: { b: 1, c: 2 }, list: [1], s: 'x' }, { a: { b: 9 }, list: [2, 3], s: 'y' });
  assert.deepEqual(merged, { a: { b: 9, c: 2 }, list: [2, 3], s: 'y' });
});
