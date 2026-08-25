/**
 * Policy engine tests (srs FR-P*, architecture.md §3 policy.ts).
 * Destructive tools require approval; catastrophic flags always denied.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine, DESTRUCTIVE_TOOLS } from '../dist/policy.js';

test('catastrophic patterns hard-denied in every mode', () => {
  for (const mode of ['allow-all', 'deny-list', 'require-approval']) {
    const engine = new PolicyEngine({ mode });
    const rmrf = engine.decide('shell', { cmd: 'rm -rf /' });
    assert.equal(rmrf.allowed, false, `${mode} must deny rm -rf /`);
    assert.match(rmrf.reason, /hard-denied/);
    assert.equal(engine.decide('exec', { args: ['--os-shell'] }).allowed, false);
    assert.equal(engine.decide('bash', { cmd: ':(){ :|:& };:' }).allowed, false);
  }
});

test('destructive tools require approval under require-approval mode', () => {
  const engine = new PolicyEngine({ mode: 'require-approval' });
  for (const tool of DESTRUCTIVE_TOOLS) {
    const d = engine.decide(tool, {});
    assert.equal(d.requiresApproval, true, `${tool} should require approval`);
  }
});

test('deny-list blocks listed tools only', () => {
  const engine = new PolicyEngine({ mode: 'deny-list', deny: ['webFetch'] });
  assert.equal(engine.decide('webFetch', { url: 'https://x' }).allowed, false);
  assert.equal(engine.decide('readFile', { path: '/tmp/a' }).allowed, true);
});

test('allow-always approval decision is remembered per tool', () => {
  let calls = 0;
  const engine = new PolicyEngine(
    { mode: 'require-approval' },
    () => { calls++; return 'allow-always'; }
  );
  const first = engine.decide('writeFile', { path: '/tmp/x.txt' });
  assert.equal(first.allowed, true);
  const second = engine.decide('writeFile', { path: '/tmp/y.txt' });
  assert.equal(second.allowed, true);
  assert.equal(second.requiresApproval, false);
  assert.equal(calls, 1, 'approver consulted exactly once');
});

test('rate limiter caps decisions per minute', () => {
  const engine = new PolicyEngine({ mode: 'allow-all', maxPerMinute: 3 });
  for (let i = 0; i < 3; i++) {
    const d = engine.decide('readFile', {});
    assert.equal(d.allowed, true);
  }
  const limited = engine.decide('readFile', {});
  assert.equal(limited.allowed, false);
  assert.match(limited.reason, /rate limit/i);
});
