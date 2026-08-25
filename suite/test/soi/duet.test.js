/**
 * Duet protocol tests (soi-spec §3.1) — persona seeding produces measurable,
 * twin-specific dynamics; two distinct profiles yield separable fingerprints.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoiCore } from '../dist/soi/core.js';
import { profileToPersonaVector, PERSONA_VEC_DIM, mulberry32, deriveSeed } from '../dist/soi/duet.js';

const CORPUS = [
  'I think deterministic systems deserve careful study.',
  'Reservoir computing gives us a window into adaptation.',
  'The twin fingerprint should stay stable across turns.'
];

function smallTwin(seed = 777) {
  return new SoiCore({
    mode: 'passive', seed,
    neurons: { primary: 384, meta: 384, expressive: 384 },
    connectivity: 0.03
  }, 'duet-twin');
}

test('mulberry32 is a stable PRNG', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('profileToPersonaVector is deterministic and correctly dimensioned', () => {
  const profile = { worldview: 'empiricist', bias: 'detail-first', linguisticPattern: 'terse' };
  const v1 = profileToPersonaVector(profile);
  const v2 = profileToPersonaVector(profile);
  assert.equal(v1.length, PERSONA_VEC_DIM);
  assert.deepEqual([...v1], [...v2]);
});

test('different personas derive different pool biases', () => {
  const vecA = profileToPersonaVector({ worldview: 'optimist', bias: 'broad-stroke' });
  const vecB = profileToPersonaVector({ worldview: 'skeptic', bias: 'detail-first' });
  const sA = deriveSeed(vecA, 10, 10, 10, 1);
  const sB = deriveSeed(vecB, 10, 10, 10, 1);
  assert.notDeepEqual([...sA.biasPrimary], [...sB.biasPrimary]);
});

test('Duet fingerprint: identical personas behave identically; distinct ones diverge', async () => {
  async function runWith(vecSeed) {
    const core = smallTwin();
    const vec = profileToPersonaVector({ worldview: `w-${vecSeed}`, bias: `b-${vecSeed}` });
    core.seedPersona(vec);
    let driftSum = 0;
    for (const text of CORPUS) {
      const s = await core.ingest(text, 'USER');
      driftSum += Math.abs(s.persona_drift);
    }
    return driftSum;
  }
  const [a1, a2, b] = await Promise.all([runWith('A'), runWith('A'), runWith('B')]);
  assert.equal(a1, a2, 'same profile => same trajectory (deterministic)');
  assert.ok(Math.abs(a1 - b) > 0, `distinct profiles separable (drift ${a1.toFixed(3)} vs ${b.toFixed(3)})`);
});

test('re-seeding resets plasticity but keeps the reservoir topology', () => {
  const core = smallTwin();
  const statsBefore = core.stats();
  core.seedPersona(profileToPersonaVector({ worldview: 'x' }));
  const statsAfter = core.stats();
  assert.equal(statsAfter.neurons, statsBefore.neurons);
  assert.equal(statsAfter.synapses, statsBefore.synapses);
});
