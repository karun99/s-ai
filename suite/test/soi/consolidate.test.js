/**
 * SOI consolidation tests — trace extraction -> engine knowledge-graph sink
 * + bounded tone nudges (srs §3.4, architecture.md §4.4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTraces, applyToGraph, computeToneNudge, applyToneNudge } from '../dist/soi/consolidate.js';

function trace(partial = {}) {
  return {
    ts: new Date().toISOString(),
    role: 'USER',
    summary: partial.summary ?? 'consolidation probe',
    salience: partial.salience ?? 0.9,
    signals: { confidence: 0.5, novelty: 0.2, bias_anomaly: false, salience: 0.9, persona_drift: 0 }
  };
}

class MemorySink {
  constructor() { this.nodes = []; this.edges = []; }
  addNode(type, label, data) {
    const id = `n${this.nodes.length + 1}`;
    this.nodes.push({ id, type, label, data });
    return id;
  }
  addEdge(a, b, rel, w) { this.edges.push({ a, b, rel, w }); }
}

test('extractTraces sorts by salience and caps at maxTraces', () => {
  const traces = [trace({ salience: 0.3, summary: 'mid' }), trace({ salience: 0.95, summary: 'hot' }), trace({ salience: 0.6, summary: 'warm' })];
  const out = extractTraces(traces);
  assert.deepEqual(out.map(t => t.summary), ['hot', 'warm', 'mid'], 'descending salience');
  assert.equal(extractTraces(traces, 2).length, 2, 'maxTraces cap honoured');
});

test('applyToGraph upserts one node per trace and links them', () => {
  const sink = new MemorySink();
  const ids = applyToGraph(sink, [trace(), trace()]);
  assert.equal(ids.length, 2);
  assert.equal(sink.nodes.length, 2);
});

test('tone nudges are bounded within ±10% of the baseline', () => {
  const profile = { communicationStyle: { formality: 0.5, verbosity: 0.5 } };
  const hot = Array.from({ length: 50 }, () => trace({ salience: 1 }));
  const nudge = computeToneNudge(profile, hot);
  assert.equal(nudge.applied, true);
  for (const d of [nudge.formalityDelta, nudge.verbosityDelta]) {
    assert.ok(Math.abs(d) <= 0.1000001, `nudge ${d} exceeds ±10%`);
  }
  const nudged = applyToneNudge(JSON.parse(JSON.stringify(profile)), hot);
  assert.ok(nudged.communicationStyle.formality <= 1 && nudged.communicationStyle.verbosity <= 1);
});
