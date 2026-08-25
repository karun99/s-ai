/**
 * Update feed tests (FR-D3) — version comparison and feed evaluation are
 * pure functions; no network required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, evaluateUpdate, currentVersion } from '../dist/update.js';

test('compareVersions follows semver ordering', () => {
  assert.ok(compareVersions('0.2.0', '0.1.9') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.0') === 0);
  assert.ok(compareVersions('0.9.10', '0.9.9') > 0, 'numeric, not lexicographic');
  assert.ok(compareVersions('0.1.0', '0.2.0') < 0);
});

test('evaluateUpdate detects stable upgrades and up-to-date states', () => {
  const current = currentVersion();
  const newer = { releases: [{ version: bump(current), channel: 'stable' }] };
  const same = { releases: [{ version: current, channel: 'stable' }] };
  const upNewer = evaluateUpdate(newer);
  assert.equal(upNewer.upToDate, false);
  assert.equal(upNewer.latestStable.version, bump(current));
  assert.equal(evaluateUpdate(same).upToDate, true);
});

function bump(v) {
  const [maj, min] = v.split('.').map(Number);
  return `${maj}.${min + 1}.0`;
}
