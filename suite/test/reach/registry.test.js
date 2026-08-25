/**
 * Reach v2 registry tests (srs FR-R*) — ordered backends per channel,
 * failover marking, doctor report formatting. No network in unit tests:
 * backends are injected via the constructor / setBackends.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDefaultRegistry, ReachRegistry } from '../dist/reach/registry.js';
import { runDoctor, formatDoctorReport } from '../dist/reach/doctor.js';

const dataDir = mkdtempSync(join(tmpdir(), 'ow-reach-test-'));
process.env.OPENWORKER_DIR = dataDir; // keep cache writes out of $HOME
after(() => rmSync(dataDir, { recursive: true, force: true }));

test('default registry wires the documented channels with ordered backends', () => {
  const reg = buildDefaultRegistry();
  for (const channel of ['web', 'github', 'rss', 'arxiv']) {
    const backends = reg.getBackends(channel);
    assert.ok(backends.length >= 1, `channel ${channel} has backends`);
    assert.ok(backends.every(b => typeof b.id === 'string' && typeof b.probe === 'function'));
  }
});

test('read fails over to the next backend when the first throws', async () => {
  const calls = [];
  const reg = new ReachRegistry({
    web: [
      { id: 'broken', label: 'Broken', tier: 0, read: async () => { calls.push('broken'); throw new Error('backend down'); }, probe: async () => ({ ok: false }) },
      { id: 'healthy', label: 'Healthy', tier: 1, read: async () => { calls.push('healthy'); return 'fallback-body'; }, probe: async () => ({ ok: true }) }
    ]
  });
  const body = await reg.read('web', { url: 'https://example.com/x' });
  assert.equal(body, 'fallback-body');
  assert.deepEqual(calls, ['broken', 'healthy']);
});

test('all backends down => explicit error listing each failure (no silent degradation)', async () => {
  const reg = new ReachRegistry({
    rss: [{ id: 'down-1', label: 'Down', tier: 0, read: async () => { throw new Error('x'); }, probe: async () => ({ ok: false }) }]
  });
  await assert.rejects(
    () => reg.read('rss', { query: 'news' }),
    /all backends failed for channel "rss"/
  );
});

test('failed backend is marked unhealthy for a TTL and logged', async () => {
  let fail = true;
  const reg = new ReachRegistry({
    web: [
      { id: 'flaky', label: 'Flaky', tier: 0, read: async () => { if (fail) throw new Error('blip'); return 'ok'; }, probe: async () => ({ ok: true }) }
    ]
  });
  await assert.rejects(() => reg.read('web', { url: 'https://a.b/c' }));
  assert.equal(reg.isUnhealthy('web/flaky'), true);
  assert.ok(reg.getFailoverLog().some(e => e.event === 'failover'));
  // recovery clears the mark
  fail = false;
  reg.markHealthy('web/flaky');
  assert.equal(await reg.read('web', { url: 'https://a.b/c2' }), 'ok');
});

test('doctor probes injected backends and flags broken ones in the matrix', async () => {
  const reg = new ReachRegistry({
    web: [
      { id: 'probe-ok', label: 'Probe OK', tier: 0, probe: async () => ({ ok: true }), read: async () => '' },
      { id: 'probe-bad', label: 'Probe Bad', tier: 0, probe: async () => { throw new Error('timeout'); }, read: async () => '' }
    ]
  });
  const report = await runDoctor(ch => reg.getBackends(ch), { channels: ['web'] });
  const text = formatDoctorReport(report);
  assert.match(text, /probe-ok/);
  assert.match(text, /timeout|FAIL|✗|bad/i);
});
