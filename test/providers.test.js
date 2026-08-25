import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('listProviders', () => {
  it('should return an array of provider names', async () => {
    const { listProviders } = await import('../dist/src/providers/index.js');
    const providers = listProviders();
    assert.ok(Array.isArray(providers));
    assert.ok(providers.length >= 6);
  });

  it('should include openai', async () => {
    const { listProviders } = await import('../dist/src/providers/index.js');
    const providers = listProviders();
    assert.ok(providers.includes('openai'));
  });

  it('should include anthropic', async () => {
    const { listProviders } = await import('../dist/src/providers/index.js');
    const providers = listProviders();
    assert.ok(providers.includes('anthropic'));
  });

  it('should include google', async () => {
    const { listProviders } = await import('../dist/src/providers/index.js');
    const providers = listProviders();
    assert.ok(providers.includes('google'));
  });

  it('should include openrouter', async () => {
    const { listProviders } = await import('../dist/src/providers/index.js');
    const providers = listProviders();
    assert.ok(providers.includes('openrouter'));
  });

  it('should include ollama', async () => {
    const { listProviders } = await import('../dist/src/providers/index.js');
    const providers = listProviders();
    assert.ok(providers.includes('ollama'));
  });

  it('should include nvidia', async () => {
    const { listProviders } = await import('../dist/src/providers/index.js');
    const providers = listProviders();
    assert.ok(providers.includes('nvidia'));
  });
});

describe('BaseProvider', () => {
  it('should throw on unimplemented complete()', async () => {
    const { BaseProvider } = await import('../dist/src/providers/index.js');
    const provider = new BaseProvider('test', {});
    await assert.rejects(
      () => provider.complete([{ role: 'user', content: 'hi' }]),
      { message: /complete\(\) not implemented/ }
    );
  });

  it('should throw on unimplemented stream()', async () => {
    const { BaseProvider } = await import('../dist/src/providers/index.js');
    const provider = new BaseProvider('test', {});
    try {
      const gen = provider.stream([]);
      await gen.next();
      assert.fail('Expected error from stream()');
    } catch (e) {
      assert.ok(e.message.includes('stream() not implemented'));
    }
  });

  it('should return error status from healthCheck()', async () => {
    const { BaseProvider } = await import('../dist/src/providers/index.js');
    const provider = new BaseProvider('test', {});
    const result = await provider.healthCheck();
    assert.equal(result.ok, false);
    assert.equal(result.provider, 'test');
  });

  it('should set name and config', async () => {
    const { BaseProvider } = await import('../dist/src/providers/index.js');
    const provider = new BaseProvider('test', { apiKey: 'key', baseUrl: 'http://test.com' });
    assert.equal(provider.name, 'test');
    assert.equal(provider.apiKey, 'key');
    assert.equal(provider.baseUrl, 'http://test.com');
  });
});

describe('createProvider', () => {
  it('should throw for unknown provider', async () => {
    const { createProvider } = await import('../dist/src/providers/index.js');
    assert.throws(
      () => createProvider('nonexistent'),
      /Provider.*not configured|Unknown provider/
    );
  });
});
