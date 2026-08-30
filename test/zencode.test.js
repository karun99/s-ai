import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ZenCode (HTML abbreviation expander)', () => {
  it('should export expandAbbreviation', async () => {
    const { expandAbbreviation } = await import('../dist/src/tools/zencode.js');
    assert.equal(typeof expandAbbreviation, 'function');
  });

  it('should expand a simple abbreviation (div>a)', async () => {
    const { expandAbbreviation } = await import('../dist/src/tools/zencode.js');
    const html = expandAbbreviation('div>a');
    assert.ok(html);
    assert.ok(html.includes('<div>'));
    assert.ok(html.includes('<a'));
    assert.ok(html.includes('</a>'));
    assert.ok(html.includes('</div>'));
  });

  it('should expand sibling + and multiplication *', async () => {
    const { expandAbbreviation } = await import('../dist/src/tools/zencode.js');
    const html = expandAbbreviation('ul>li*3');
    assert.ok(html);
    const count = (html.match(/<li>/g) || []).length;
    assert.equal(count, 3);
  });

  it('should support id and class abbreviations', async () => {
    const { expandAbbreviation } = await import('../dist/src/tools/zencode.js');
    const html = expandAbbreviation('div#page.main');
    assert.ok(html);
    assert.ok(html.includes('id="page"'));
    assert.ok(html.includes('class="main"'));
  });

  it('should return null for empty input', async () => {
    const { expandAbbreviation } = await import('../dist/src/tools/zencode.js');
    assert.equal(expandAbbreviation(''), null);
    assert.equal(expandAbbreviation(null), null);
  });

  it('should be registered as a tool via listTools', async () => {
    const { listTools } = await import('../dist/src/tools/index.js');
    const tools = listTools();
    const names = tools.map(t => t.name);
    assert.ok(names.includes('zencode'));
  });

  it('should run zencode via runTool', async () => {
    const { runTool } = await import('../dist/src/tools/index.js');
    const result = await runTool('zencode', { abbreviation: 'div>span' });
    assert.ok(result.html);
    assert.ok(result.html.includes('<span>'));
  });
});
