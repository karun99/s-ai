import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Index exports', () => {
  it('should export Swarm', async () => {
    const mod = await import('../dist/src/index.js');
    assert.ok(mod.Swarm);
  });

  it('should export Agent', async () => {
    const mod = await import('../dist/src/index.js');
    assert.ok(mod.Agent);
  });

  it('should export provider functions', async () => {
    const mod = await import('../dist/src/index.js');
    assert.ok(typeof mod.createProvider === 'function');
    assert.ok(typeof mod.getActiveProviderInstance === 'function');
    assert.ok(typeof mod.listProviders === 'function');
  });

  it('should export config functions', async () => {
    const mod = await import('../dist/src/index.js');
    assert.ok(typeof mod.getConfig === 'function');
    assert.ok(typeof mod.updateConfig === 'function');
    assert.ok(typeof mod.getActiveProvider === 'function');
  });

  it('should export KnowledgeGraph', async () => {
    const mod = await import('../dist/src/index.js');
    assert.ok(mod.KnowledgeGraph);
    assert.ok(typeof mod.getKnowledgeGraph === 'function');
  });

  it('should export CrawlEngine', async () => {
    const mod = await import('../dist/src/index.js');
    assert.ok(mod.CrawlEngine);
    assert.ok(typeof mod.getCrawlEngine === 'function');
  });

  it('should export MCP functions', async () => {
    const mod = await import('../dist/src/index.js');
    assert.ok(typeof mod.createSwarmMcpServer === 'function');
    assert.ok(typeof mod.startStdioMcp === 'function');
    assert.ok(typeof mod.getMcpClientManager === 'function');
  });
});
