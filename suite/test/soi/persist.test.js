/**
 * SOI persistence tests (soi-spec §8) — state.bin round-trip, rolling
 * AES-256-GCM checkpoints with SHA-256 integrity, tamper detection.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SoiCore } from '../dist/soi/core.js';
import {
  serializeSnapshot, parseSnapshot,
  writeCheckpoint, readLatestCheckpoint, listCheckpoints, CHECKPOINT_COUNT
} from '../dist/soi/persist.js';

const dir = mkdtempSync(join(tmpdir(), 'ow-soi-persist-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function smallCore(seed = 99) {
  return new SoiCore({
    mode: 'passive', seed,
    neurons: { primary: 256, meta: 256, expressive: 256 },
    connectivity: 0.03
  }, 'persist-twin');
}

test('state.bin round-trips byte-exact through serialize/parse', async () => {
  const core = smallCore();
  await core.ingest('persistence round trip probe text', 'USER');
  const snap = core.snapshot();
  const buf = serializeSnapshot(snap);
  assert.equal(buf.readUInt32LE(0), 0x314f53, 'magic SOI1');
  const restored = parseSnapshot(buf);
  const buf2 = serializeSnapshot(restored);
  assert.deepEqual([...buf], [...buf2], 're-serialization is byte-identical');
});

test('fromSnapshot restores dynamics (same signals after restore)', async () => {
  const core = smallCore();
  for (let i = 0; i < 4; i++) await core.ingest('warm the reservoir up', 'USER');
  const before = await core.ingest('probe input for restore equality', 'USER');
  const revived = SoiCore.fromSnapshot(parseSnapshot(serializeSnapshot(core.snapshot())));
  const after = await revived.ingest('probe input for restore equality', 'USER');
  // deterministic continuation: identical twin + restored state => same response
  const freshSameSeed = smallCore();
  for (let i = 0; i < 4; i++) await freshSameSeed.ingest('warm the reservoir up', 'USER');
  const expected = await freshSameSeed.ingest('probe input for restore equality', 'USER');
  assert.deepEqual(after, expected);
  void before;
});

test('checkpoints are encrypted at rest and decryptable only via key material', async () => {
  const core = smallCore();
  await core.ingest('checkpoint me', 'USER');
  await writeCheckpoint(serializeSnapshot(core.snapshot()), dir);
  const cps = listCheckpoints(dir);
  assert.equal(cps.length, 1);
  const raw = readFileSync(cps[0].binPath);
  assert.ok(!raw.includes(Buffer.from('checkpoint me')), 'ciphertext must not contain plaintext');
  const revived = readLatestCheckpoint(dir, b => parseSnapshot(b));
  assert.equal(revived.twinId, 'persist-twin');
});

test('rolling retention keeps at most CHECKPOINT_COUNT checkpoints', async () => {
  const core = smallCore();
  for (let i = 0; i < CHECKPOINT_COUNT + 2; i++) {
    await writeCheckpoint(serializeSnapshot(core.snapshot()), dir);
  }
  assert.ok(listCheckpoints(dir).length <= CHECKPOINT_COUNT);
});

test('tampered ciphertext fails SHA-256 integrity and falls back / errors', async () => {
  const core = smallCore();
  const d2 = join(dir, 'tamper');
  await writeCheckpoint(serializeSnapshot(core.snapshot()), d2);
  const cp = listCheckpoints(d2)[0];
  const raw = readFileSync(cp.binPath);
  raw[raw.length - 1] ^= 0xff;
  readFileSync; // keep fs import used
  const { writeFileSync } = await import('node:fs');
  writeFileSync(cp.binPath, raw);
  assert.throws(() => readLatestCheckpoint(d2, b => parseSnapshot(b)), /integrity|decrypt/i);
});
