import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Swarm', () => {
  it('should create a swarm with default agents', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    assert.ok(swarm);
    assert.ok(swarm.agents.size >= 6);
    assert.equal(swarm.status, 'idle');
  });

  it('should have all required agent roles', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    const roles = [...swarm.agents.values()].map(a => a.role);
    assert.ok(roles.includes('orchestrator'));
    assert.ok(roles.includes('researcher'));
    assert.ok(roles.includes('analyst'));
    assert.ok(roles.includes('critic'));
    assert.ok(roles.includes('synthesizer'));
  });

  it('should add custom agents', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    const agent = swarm.addAgent('custom', 'CustomAgent', 'custom_role');
    assert.ok(agent);
    assert.equal(swarm.agents.size, 7);
  });

  it('should get agent by id', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    const agent = swarm.getAgent('orchestrator');
    assert.ok(agent);
    assert.equal(agent.name, 'Orchestrator');
  });

  it('should return correct status', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    const status = swarm.getStatus();
    assert.equal(status.status, 'idle');
    assert.ok(Array.isArray(status.agents));
    assert.equal(status.agents.length, 6);
  });

  it('should reset all agents', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    swarm.status = 'running';
    swarm.rounds = [{ round: 1 }];
    swarm.reset();
    assert.equal(swarm.status, 'idle');
    assert.deepStrictEqual(swarm.rounds, []);
  });

  it('should calculate consensus correctly', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    const score = swarm._calculateConsensus(
      'machine learning is a subset of artificial intelligence',
      'machine learning is part of artificial intelligence',
      'Both analyses agree on the definition of machine learning'
    );
    assert.equal(typeof score, 'number');
    assert.ok(score >= 0 && score <= 1);
  });

  it('should detect web research needs', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    assert.equal(swarm._needsWebResearch('We should search for latest news'), true);
    assert.equal(swarm._needsWebResearch('What is 2+2?'), false);
    assert.equal(swarm._needsWebResearch('Research the current market trends'), true);
  });

  it('should handle EventEmitter methods', async () => {
    const { Swarm } = await import('../dist/src/swarm/index.js');
    const swarm = new Swarm();
    let emitted = false;
    swarm.on('start', () => { emitted = true; });
    swarm.emit('start', {});
    assert.ok(emitted);
  });
});
