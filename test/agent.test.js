import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Agent', () => {
  it('should create an agent with correct properties', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    assert.equal(agent.name, 'TestBot');
    assert.equal(agent.role, 'analyst');
    assert.equal(agent.status, 'idle');
    assert.ok(agent.id);
    assert.equal(agent.id.length, 8);
  });

  it('should have default metrics', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    assert.deepStrictEqual(agent.metrics, { tokens: 0, cost: 0, calls: 0, errors: 0 });
  });

  it('should start with empty history', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    assert.deepStrictEqual(agent.history, []);
  });

  it('should set provider via setProvider()', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    const mockProvider = { complete: async () => ({ content: 'ok', model: 'test' }) };
    const result = agent.setProvider(mockProvider);
    assert.equal(result, agent);
    assert.equal(agent.provider, mockProvider);
  });

  it('should reset agent state', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    agent.history = [{ role: 'user', content: 'test' }];
    agent.status = 'thinking';
    agent.reset();
    assert.deepStrictEqual(agent.history, []);
    assert.equal(agent.status, 'idle');
  });

  it('should generate a system prompt', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    const prompt = agent._systemPrompt();
    assert.ok(prompt.includes('TestBot'));
    assert.ok(prompt.includes('analyst'));
    assert.ok(prompt.includes('S-AI'));
  });

  it('should think and return a result', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'critic');
    const mockProvider = {
      complete: async () => ({ content: 'analysis result', model: 'test', usage: { total_tokens: 10 } })
    };
    agent.setProvider(mockProvider);
    const result = await agent.think({ message: 'test question' });
    assert.equal(result.content, 'analysis result');
    assert.equal(result.agent, 'TestBot');
    assert.equal(result.role, 'critic');
    assert.equal(result.error, undefined);
    assert.equal(agent.metrics.calls, 1);
    assert.equal(agent.metrics.tokens, 10);
    assert.equal(agent.history.length, 2);
  });

  it('should handle think errors gracefully', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    const mockProvider = {
      complete: async () => { throw new Error('API down'); }
    };
    agent.setProvider(mockProvider);
    const result = await agent.think('test');
    assert.ok(result.error);
    assert.ok(result.content.includes('ERROR'));
    assert.equal(agent.metrics.errors, 1);
    assert.equal(agent.status, 'error');
  });

  it('should handle string context in think()', async () => {
    const { Agent } = await import('../dist/src/swarm/agent.js');
    const agent = new Agent('TestBot', 'analyst');
    const mockProvider = {
      complete: async () => ({ content: 'ok', model: 'test', usage: { total_tokens: 5 } })
    };
    agent.setProvider(mockProvider);
    const result = await agent.think('simple string');
    assert.equal(result.content, 'ok');
  });
});
