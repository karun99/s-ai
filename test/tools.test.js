import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('CrawlEngine', () => {
  it('should create a crawl engine', async () => {
    const { CrawlEngine } = await import('../dist/src/tools/crawl.js');
    const engine = new CrawlEngine();
    assert.ok(engine);
    assert.ok(engine.config);
  });

  it('should extract title from HTML', async () => {
    const { CrawlEngine } = await import('../dist/src/tools/crawl.js');
    const engine = new CrawlEngine();
    const title = engine._extractTitle('<html><head><title>Test Page</title></head></html>');
    assert.equal(title, 'Test Page');
  });

  it('should return Untitled for missing title', async () => {
    const { CrawlEngine } = await import('../dist/src/tools/crawl.js');
    const engine = new CrawlEngine();
    const title = engine._extractTitle('<html><head></head></html>');
    assert.equal(title, 'Untitled');
  });

  it('should extract content from HTML', async () => {
    const { CrawlEngine } = await import('../dist/src/tools/crawl.js');
    const engine = new CrawlEngine();
    const content = engine._extractContent('<html><body><p>Hello world</p></body></html>', 'http://test.com');
    assert.ok(content.includes('Hello world'));
    assert.ok(!content.includes('<p>'));
  });

  it('should strip script and style tags', async () => {
    const { CrawlEngine } = await import('../dist/src/tools/crawl.js');
    const engine = new CrawlEngine();
    const content = engine._extractContent(
      '<html><head><script>alert("x")</script><style>.x{color:red}</style></head><body>Content</body></html>',
      'http://test.com'
    );
    assert.ok(!content.includes('alert'));
    assert.ok(!content.includes('color'));
    assert.ok(content.includes('Content'));
  });

  it('should parse search results', async () => {
    const { CrawlEngine } = await import('../dist/src/tools/crawl.js');
    const engine = new CrawlEngine();
    const mockHtml = `
      <a class="result__a" href="https://example.com">Example Site</a>
      <a class="result__snippet">This is a snippet</a>
    `;
    const results = engine._parseSearchResults(mockHtml);
    assert.ok(Array.isArray(results));
  });

  it('should handle empty search results', async () => {
    const { CrawlEngine } = await import('../dist/src/tools/crawl.js');
    const engine = new CrawlEngine();
    const results = engine._parseSearchResults('');
    assert.deepStrictEqual(results, []);
  });
});

describe('File Tools', () => {
  it('should list available tools', async () => {
    const { listTools } = await import('../dist/src/tools/index.js');
    const tools = listTools();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length >= 5);
    const names = tools.map(t => t.name);
    assert.ok(names.includes('readFile'));
    assert.ok(names.includes('writeFile'));
    assert.ok(names.includes('listDir'));
    assert.ok(names.includes('searchFiles'));
    assert.ok(names.includes('execShell'));
  });

  it('should get a tool by name', async () => {
    const { getTool } = await import('../dist/src/tools/index.js');
    const tool = getTool('readFile');
    assert.ok(tool);
    assert.equal(tool.name, 'readFile');
  });

  it('should return undefined for unknown tool', async () => {
    const { getTool } = await import('../dist/src/tools/index.js');
    const tool = getTool('nonexistent');
    assert.equal(tool, undefined);
  });

  it('should return error for unknown tool via runTool', async () => {
    const { runTool } = await import('../dist/src/tools/index.js');
    const result = await runTool('nonexistent', {});
    assert.ok(result.error);
  });

  it('should execute readFile tool', async () => {
    const { runTool } = await import('../dist/src/tools/index.js');
    const result = await runTool('readFile', { path: '/nonexistent/file.txt' });
    assert.ok(result.error);
  });

  it('should list directory entries', async () => {
    const { runTool } = await import('../dist/src/tools/index.js');
    const result = await runTool('listDir', { path: '/tmp' });
    assert.ok(result.entries);
    assert.ok(result.count > 0);
  });

  it('should return error for nonexistent directory', async () => {
    const { runTool } = await import('../dist/src/tools/index.js');
    const result = await runTool('listDir', { path: '/nonexistent-dir-12345' });
    assert.ok(result.error);
  });
});
