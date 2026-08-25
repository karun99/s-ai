import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const TEST_DIR = join(homedir(), '.s-ai-test');
const TEST_CONFIG_DIR = join(TEST_DIR, 'config');

before(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  if (!existsSync(TEST_CONFIG_DIR)) mkdirSync(TEST_CONFIG_DIR, { recursive: true });
});

after(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('deepMerge', () => {
  it('should merge flat objects', async () => {
    const { deepMerge } = await import('../dist/src/config.js');
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 });
  });

  it('should merge nested objects deeply', async () => {
    const { deepMerge } = await import('../dist/src/config.js');
    const result = deepMerge(
      { providers: { openai: { apiKey: '' } } },
      { providers: { openai: { apiKey: 'test-key' } } }
    );
    assert.equal(result.providers.openai.apiKey, 'test-key');
  });

  it('should not mutate the original target', async () => {
    const { deepMerge } = await import('../dist/src/config.js');
    const target = { a: 1 };
    const result = deepMerge(target, { b: 2 });
    assert.equal(target.b, undefined);
    assert.equal(result.b, 2);
  });

  it('should overwrite arrays instead of merging them', async () => {
    const { deepMerge } = await import('../dist/src/config.js');
    const result = deepMerge({ arr: [1, 2] }, { arr: [3] });
    assert.deepStrictEqual(result.arr, [3]);
  });
});

describe('hashContent', () => {
  it('should return a consistent hash', async () => {
    const { hashContent } = await import('../dist/src/config.js');
    const h1 = hashContent('hello');
    const h2 = hashContent('hello');
    assert.equal(h1, h2);
    assert.equal(typeof h1, 'string');
    assert.equal(h1.length, 16);
  });

  it('should return different hashes for different inputs', async () => {
    const { hashContent } = await import('../dist/src/config.js');
    const h1 = hashContent('hello');
    const h2 = hashContent('world');
    assert.notEqual(h1, h2);
  });
});

describe('getConfig', () => {
  it('should return an object', async () => {
    const { getConfig } = await import('../dist/src/config.js');
    const config = getConfig();
    assert.equal(typeof config, 'object');
    assert.ok(config !== null);
  });

  it('should have providers section', async () => {
    const { getConfig } = await import('../dist/src/config.js');
    const config = getConfig();
    assert.ok(config.providers);
    assert.ok(config.providers.primary);
  });

  it('should have swarm section', async () => {
    const { getConfig } = await import('../dist/src/config.js');
    const config = getConfig();
    assert.ok(config.swarm);
    assert.equal(typeof config.swarm.consensusThreshold, 'number');
  });

  it('should have crawl4ai section', async () => {
    const { getConfig } = await import('../dist/src/config.js');
    const config = getConfig();
    assert.ok(config.crawl4ai);
  });

  it('should have mcp section', async () => {
    const { getConfig } = await import('../dist/src/config.js');
    const config = getConfig();
    assert.ok(config.mcp);
  });
});

describe('getActiveProvider', () => {
  it('should return provider name', async () => {
    const { getActiveProvider } = await import('../dist/src/config.js');
    const provider = getActiveProvider();
    assert.ok(provider.name);
    assert.equal(typeof provider.name, 'string');
  });
});

describe('getSwarmConfig', () => {
  it('should return swarm configuration', async () => {
    const { getSwarmConfig } = await import('../dist/src/config.js');
    const swarm = getSwarmConfig();
    assert.equal(typeof swarm.maxRounds, 'number');
    assert.equal(typeof swarm.consensusThreshold, 'number');
  });
});

describe('getMcpConfig', () => {
  it('should return mcp configuration', async () => {
    const { getMcpConfig } = await import('../dist/src/config.js');
    const mcp = getMcpConfig();
    assert.equal(typeof mcp.enabled, 'boolean');
  });
});

describe('getCrawlConfig', () => {
  it('should return crawl configuration', async () => {
    const { getCrawlConfig } = await import('../dist/src/config.js');
    const crawl = getCrawlConfig();
    assert.equal(typeof crawl.cacheEnabled, 'boolean');
  });
});

describe('getDataDir / getGraphDir / getCacheDir', () => {
  it('getDataDir should return a path string', async () => {
    const { getDataDir } = await import('../dist/src/config.js');
    const dir = getDataDir();
    assert.equal(typeof dir, 'string');
    assert.ok(dir.includes('.s-ai'));
  });

  it('getGraphDir should return a path string', async () => {
    const { getGraphDir } = await import('../dist/src/config.js');
    const dir = getGraphDir();
    assert.equal(typeof dir, 'string');
    assert.ok(dir.includes('graph'));
  });

  it('getCacheDir should return a path string', async () => {
    const { getCacheDir } = await import('../dist/src/config.js');
    const dir = getCacheDir();
    assert.equal(typeof dir, 'string');
    assert.ok(dir.includes('cache'));
  });
});
