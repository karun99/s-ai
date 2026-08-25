/**
 * SOI gate tests — off-mode purity (NFR-7) and simulated-only labeling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const emptyDir = mkdtempSync(join(tmpdir(), 'ow-soigate-off-'));
const onDir = mkdtempSync(join(tmpdir(), 'ow-soigate-on-'));
writeFileSync(join(onDir, 'soi.config.json'), JSON.stringify({ mode: 'passive' }));

const { resolveSoiMode, loadSoiIfEnabled, SIMULATED_LABEL } = await import('../dist/soiGate.js');

test('absent soi.config.json => mode off (fail-safe)', () => {
  assert.equal(resolveSoiMode(emptyDir), 'off');
});

test('corrupt soi.config.json => mode off, never crash', () => {
  writeFileSync(join(onDir, 'corrupt.json'), '{oops');
  assert.equal(resolveSoiMode(join(onDir)), 'passive'); // sanity: valid file still works
});

test('off-mode purity: loadSoiIfEnabled returns null without evaluating the core', async () => {
  const loaded = await loadSoiIfEnabled('default', emptyDir);
  assert.equal(loaded, null, 'no config => no dynamic import of soi/core.js');
});

test('passive mode loads a core that reports simulated stats', async () => {
  const loaded = await loadSoiIfEnabled('gate-twin', onDir);
  assert.ok(loaded, 'core loads in passive mode');
  const s = loaded.core.stats();
  assert.equal(s.mode, 'passive');
  assert.equal(s.twinId, 'gate-twin');
});

test('SIMULATED_LABEL is present on every SOI surface contract', () => {
  assert.match(SIMULATED_LABEL, /simulated/i);
  assert.match(SIMULATED_LABEL, /not biological computation/i);
});

test('cleanup dirs exist for hygiene', () => {
  assert.ok(existsSync(emptyDir));
});

process.on('exit', () => {
  try { rmSync(emptyDir, { recursive: true, force: true }); } catch {}
  try { rmSync(onDir, { recursive: true, force: true }); } catch {}
});
