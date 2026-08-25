/**
 * Routing adapter tests — aisuite-style provider:model parsing (FR-C1).
 * Mirrors suite/src/adapters/routing.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelId } from '../dist/adapters/routing.js';

test('parseModelId splits provider:model', () => {
  const parsed = parseModelId('openrouter:meta-llama/llama-3.1-8b-instruct:free');
  assert.equal(parsed.provider, 'openrouter');
  assert.equal(parsed.model, 'meta-llama/llama-3.1-8b-instruct:free');
});

test('parseModelId accepts bare provider', () => {
  const parsed = parseModelId('ollama');
  assert.equal(parsed.provider, 'ollama');
  assert.equal(parsed.model, undefined);
});

test('parseModelId rejects empty ids', () => {
  assert.throws(() => parseModelId(''), /empty provider:model id/);
  assert.throws(() => parseModelId(':llama'), /invalid provider:model id/);
});
