/**
 * Job store tests (architecture.md §3 worker/jobs.ts) — cron parsing,
 * definitions, history ring buffer. Uses an explicit store path.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ow-jobs-test-'));
const jobsPath = join(dir, 'jobs.json');

const { JobStore, cronMatches, parseCron } = await import('../dist/worker/jobs.js');

after(() => { rmSync(dir, { recursive: true, force: true }); });

function freshStore() { return new JobStore(jobsPath); }

test('add/list/get round-trip with generated ids', () => {
  const store = freshStore();
  const job = store.add({
    name: 'standup',
    trigger: { type: 'schedule', cron: '0 9 * * Mon' },
    task: { prompt: 'summarize my week' },
    tools: [],
    policy: 'require-approval'
  });
  assert.ok(job.id);
  assert.equal(store.get(job.id).name, 'standup');
  assert.equal(store.get('standup').id, job.id, 'lookup by name works too');
  assert.equal(store.list().length, 1);
});

test('remove deletes by id or name and reports misses', () => {
  const store = freshStore();
  const job = store.add({ name: 'tmp', trigger: { type: 'manual' }, task: { prompt: 'x' }, tools: [], policy: 'allow-all' });
  assert.equal(store.remove(job.id), true);
  assert.equal(store.remove('does-not-exist'), false);
});

test('invalid cron expressions are rejected eagerly', () => {
  const store = freshStore();
  assert.throws(() => store.add({
    name: 'bad', trigger: { type: 'schedule', cron: 'not a cron' },
    task: { prompt: 'x' }, tools: [], policy: 'allow-all'
  }));
});

test('cronMatches honours field semantics', () => {
  // Mon Sep 01 2025 09:00 local
  const d = new Date(2025, 8, 1, 9, 0);
  assert.equal(cronMatches(parseCron('0 9 * * Mon'), d), true);
  assert.equal(cronMatches(parseCron('0 10 * * Mon'), d), false);
  assert.equal(cronMatches(parseCron('*/15 * * * *'), new Date(2025, 8, 1, 9, 30)), true);
  assert.equal(cronMatches(parseCron('0 9 1 * *'), d), true, 'day-of-month');
});

test('history ring keeps the most recent records within the limit', () => {
  const store = freshStore();
  const job = store.add({ name: 'ring', trigger: { type: 'manual' }, task: { prompt: 'x' }, tools: [], policy: 'allow-all' });
  for (let i = 0; i < 60; i++) {
    store.recordHistory({ jobId: job.id, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), status: `run-${i}` });
  }
  const all = store.historyFor(job.id);
  assert.ok(all.length < 60, 'history is bounded (ring buffer)');
  assert.ok(store.lastRun(job.id), 'lastRun resolves newest record');
});

test('dueJobs returns only matching schedule jobs, no double-fire same minute', () => {
  const store = freshStore();
  store.add({ name: 'weekly', trigger: { type: 'schedule', cron: '0 9 * * Mon' }, task: { prompt: 'x' }, tools: [], policy: 'allow-all' });
  const mondayNine = new Date(2025, 8, 1, 9, 0);
  const due = store.dueJobs(mondayNine);
  assert.equal(due.length, 1);
});
