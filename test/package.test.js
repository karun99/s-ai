import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

describe('package.json', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

  it('should have name "s-ai"', () => {
    assert.equal(pkg.name, 's-ai');
  });

  it('should have version', () => {
    assert.ok(pkg.version);
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  });

  it('should have author "nsk"', () => {
    assert.equal(pkg.author, 'nsk');
  });

  it('should have MIT license', () => {
    assert.equal(pkg.license, 'MIT');
  });

  it('should have type "module"', () => {
    assert.equal(pkg.type, 'module');
  });

  it('should have main entry point', () => {
    assert.ok(pkg.main);
    assert.ok(pkg.main.startsWith('./'));
  });

  it('should have exports field', () => {
    assert.ok(pkg.exports);
    assert.ok(pkg.exports['.']);
  });

  it('should have bin entries', () => {
    assert.ok(pkg.bin);
    assert.ok(pkg.bin['s-ai']);
    assert.ok(pkg.bin['s-ai-mcp']);
  });

  it('should have engines requirement >= 18', () => {
    assert.ok(pkg.engines);
    assert.ok(pkg.engines.node.includes('18'));
  });

  it('should have files array for npm publish', () => {
    assert.ok(Array.isArray(pkg.files));
    assert.ok(pkg.files.includes('bin/'));
    assert.ok(pkg.files.includes('dist/'));
    assert.ok(pkg.files.includes('public/'));
    assert.ok(pkg.files.includes('skills/'));
  });

  it('should have required dependencies', () => {
    assert.ok(pkg.dependencies);
    assert.ok(pkg.dependencies['express']);
    assert.ok(pkg.dependencies['zod']);
    assert.ok(pkg.dependencies['@modelcontextprotocol/sdk']);
  });

  it('should have test script', () => {
    assert.ok(pkg.scripts.test);
    assert.ok(pkg.scripts.test.includes('node --test'));
  });

  it('should have validate script', () => {
    assert.ok(pkg.scripts.validate);
  });

  it('should NOT have preferGlobal', () => {
    assert.equal(pkg.preferGlobal, undefined);
  });
});

describe('config.default.json', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'config.default.json'), 'utf8'));

  it('should have providers section', () => {
    assert.ok(config.providers);
    assert.equal(config.providers.primary, 'openrouter');
  });

  it('should have all 6 providers configured', () => {
    assert.ok(config.providers.openrouter);
    assert.ok(config.providers.openai);
    assert.ok(config.providers.anthropic);
    assert.ok(config.providers.google);
    assert.ok(config.providers.ollama);
    assert.ok(config.providers.nvidia);
  });

  it('should have swarm config', () => {
    assert.ok(config.swarm);
    assert.equal(typeof config.swarm.consensusThreshold, 'number');
    assert.equal(typeof config.swarm.maxRounds, 'number');
  });

  it('should have crawl4ai config', () => {
    assert.ok(config.crawl4ai);
    assert.equal(typeof config.crawl4ai.cacheEnabled, 'boolean');
  });

  it('should have mcp config', () => {
    assert.ok(config.mcp);
    assert.equal(typeof config.mcp.enabled, 'boolean');
    assert.ok(Array.isArray(config.mcp.servers));
  });

  it('should have server config', () => {
    assert.ok(config.server);
    assert.equal(typeof config.server.port, 'number');
  });
});
