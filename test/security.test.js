import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('Auth', () => {
  let hashToken, generateAuthToken, revokeToken, getAuthConfig;
  before(async () => {
    ({ hashToken, generateAuthToken, revokeToken, getAuthConfig } = await import('../dist/src/security/auth.js'));
  });

  it('hashToken returns a hex string', () => {
    assert.match(hashToken('test-token'), /^[a-f0-9]{64}$/);
  });

  it('hashToken is deterministic', () => {
    assert.equal(hashToken('hello'), hashToken('hello'));
  });

  it('hashToken differs for different inputs', () => {
    assert.notEqual(hashToken('token-a'), hashToken('token-b'));
  });

  it('generateAuthToken returns s-ai prefixed token', () => {
    const token = generateAuthToken();
    assert.ok(token.startsWith('s-ai-'));
    assert.ok(token.length > 36);
  });

  it('getAuthConfig returns a mode', () => {
    const config = getAuthConfig();
    assert.ok(['local', 'lan', 'off'].includes(config.mode));
  });
});

describe('SSRF - isPrivateUrl', () => {
  let isPrivateUrl, validateUrlSafety, MAX_REDIRECTS, MAX_RESPONSE_BYTES, BLOCKED_HOSTS;
  before(async () => {
    ({ isPrivateUrl, validateUrlSafety, MAX_REDIRECTS, MAX_RESPONSE_BYTES, BLOCKED_HOSTS } = await import('../dist/src/security/ssrf.js'));
  });

  it('blocks localhost', () => {
    assert.equal(isPrivateUrl('http://localhost/admin'), true);
  });

  it('blocks 127.0.0.1', () => {
    assert.equal(isPrivateUrl('http://127.0.0.1:8080/secret'), true);
  });

  it('blocks ::1', () => {
    assert.equal(isPrivateUrl('http://[::1]/'), true);
  });

  it('blocks RFC1918 10.x', () => {
    assert.equal(isPrivateUrl('http://10.0.0.1/api'), true);
  });

  it('blocks RFC1918 172.16-31', () => {
    assert.equal(isPrivateUrl('http://172.16.0.1/'), true);
    assert.equal(isPrivateUrl('http://172.31.255.255/'), true);
  });

  it('blocks RFC1918 192.168', () => {
    assert.equal(isPrivateUrl('http://192.168.1.1/'), true);
  });

  it('blocks link-local 169.254', () => {
    assert.equal(isPrivateUrl('http://169.254.169.254/'), true);
  });

  it('blocks non-HTTP schemes', () => {
    assert.equal(isPrivateUrl('file:///etc/passwd'), true);
    assert.equal(isPrivateUrl('ftp://example.com'), true);
    assert.equal(isPrivateUrl('javascript:alert(1)'), true);
  });

  it('allows public HTTP URLs', () => {
    assert.equal(isPrivateUrl('https://example.com'), false);
    assert.equal(isPrivateUrl('http://google.com'), false);
  });

  it('handles invalid URLs', () => {
    assert.equal(isPrivateUrl('not-a-url'), true);
    assert.equal(isPrivateUrl(''), true);
  });

  it('BLOCKED_HOSTS includes expected entries', () => {
    assert.ok(BLOCKED_HOSTS.includes('localhost'));
    assert.ok(BLOCKED_HOSTS.includes('127.0.0.1'));
    assert.ok(BLOCKED_HOSTS.includes('::1'));
  });

  it('MAX_REDIRECTS is defined', () => {
    assert.equal(typeof MAX_REDIRECTS, 'number');
    assert.ok(MAX_REDIRECTS > 0);
  });

  it('MAX_RESPONSE_BYTES is defined', () => {
    assert.equal(typeof MAX_RESPONSE_BYTES, 'number');
    assert.ok(MAX_RESPONSE_BYTES > 0);
  });
});

describe('SSRF - validateUrlSafety', () => {
  let validateUrlSafety;
  before(async () => {
    ({ validateUrlSafety } = await import('../dist/src/security/ssrf.js'));
  });

  it('blocks localhost', async () => {
    const result = await validateUrlSafety('http://localhost/admin');
    assert.equal(result.safe, false);
  });

  it('blocks 127.0.0.1', async () => {
    const result = await validateUrlSafety('http://127.0.0.1/secret');
    assert.equal(result.safe, false);
  });

  it('blocks file:// scheme', async () => {
    const result = await validateUrlSafety('file:///etc/passwd');
    assert.equal(result.safe, false);
  });

  it('blocks private IP ranges', async () => {
    const result = await validateUrlSafety('http://10.0.0.1/');
    assert.equal(result.safe, false);
  });

  it('blocks 169.254 metadata endpoint', async () => {
    const result = await validateUrlSafety('http://169.254.169.254/latest/meta-data/');
    assert.equal(result.safe, false);
  });

  it('handles invalid URL format', async () => {
    const result = await validateUrlSafety('not-a-valid-url');
    assert.equal(result.safe, false);
  });
});

describe('Filesystem Sandbox', () => {
  let isPathInSandbox, WORKSPACE_ROOT;
  before(async () => {
    ({ isPathInSandbox, WORKSPACE_ROOT } = await import('../dist/src/security/sandbox.js'));
  });

  it('allows paths within workspace', () => {
    const result = isPathInSandbox(join(WORKSPACE_ROOT, 'project', 'file.txt'));
    assert.equal(result.safe, true);
  });

  it('allows paths in .s-ai/data', () => {
    const result = isPathInSandbox(join(homedir(), '.s-ai', 'data', 'graph', 'test.json'));
    assert.equal(result.safe, true);
  });

  it('blocks paths outside allowed roots', () => {
    const result = isPathInSandbox('/etc/passwd');
    assert.equal(result.safe, false);
  });

  it('blocks .ssh directory', () => {
    const result = isPathInSandbox(join(WORKSPACE_ROOT, '.ssh', 'id_rsa'));
    assert.equal(result.safe, false);
  });

  it('blocks .env files', () => {
    const result = isPathInSandbox(join(WORKSPACE_ROOT, '.env'));
    assert.equal(result.safe, false);
  });

  it('blocks credential files', () => {
    const result = isPathInSandbox(join(WORKSPACE_ROOT, 'credentials'));
    assert.equal(result.safe, false);
  });

  it('blocks key files', () => {
    const result = isPathInSandbox(join(WORKSPACE_ROOT, 'certs', 'server.key'));
    assert.equal(result.safe, false);
  });

  it('blocks .aws directory', () => {
    const result = isPathInSandbox(join(homedir(), '.aws', 'credentials'));
    assert.equal(result.safe, false);
  });
});

describe('Shell Command Sandbox', () => {
  let validateShellCommand;
  before(async () => {
    ({ validateShellCommand } = await import('../dist/src/security/sandbox.js'));
  });

  it('allows safe commands in safe mode', () => {
    const result = validateShellCommand('ls -la', { mode: 'safe' });
    assert.equal(result.allowed, true);
  });

  it('blocks rm in safe mode', () => {
    const result = validateShellCommand('rm -rf /', { mode: 'safe' });
    assert.equal(result.allowed, false);
  });

  it('blocks curl in safe mode', () => {
    const result = validateShellCommand('curl http://evil.com', { mode: 'safe' });
    assert.equal(result.allowed, false);
  });

  it('blocks command substitution', () => {
    const result = validateShellCommand('cat $(whoami)', { mode: 'safe' });
    assert.equal(result.allowed, false);
  });

  it('blocks backtick substitution', () => {
    const result = validateShellCommand('echo `whoami`', { mode: 'safe' });
    assert.equal(result.allowed, false);
  });

  it('allows commands in full mode', () => {
    const result = validateShellCommand('rm -rf /', { mode: 'full' });
    assert.equal(result.allowed, true);
  });

  it('allows allowed commands in restricted mode', () => {
    const result = validateShellCommand('git status', {
      mode: 'restricted',
      allowedCommands: ['git', 'ls', 'cat']
    });
    assert.equal(result.allowed, true);
  });

  it('blocks commands not in allowlist in restricted mode', () => {
    const result = validateShellCommand('rm -rf /', {
      mode: 'restricted',
      allowedCommands: ['git', 'ls', 'cat']
    });
    assert.equal(result.allowed, false);
  });

  it('blocks empty commands', () => {
    const result = validateShellCommand('', { mode: 'safe' });
    assert.equal(result.allowed, false);
  });
});

describe('Tool Registry - secure validation', () => {
  let validateToolParams, getToolMeta, listToolMeta, getRiskForTool;
  before(async () => {
    ({ validateToolParams, getToolMeta, listToolMeta, getRiskForTool } = await import('../dist/src/execution/registry.js'));
  });

  it('validates readFile params correctly', () => {
    assert.equal(validateToolParams('readFile', { path: '/tmp/test.txt' }).valid, true);
  });

  it('rejects readFile with missing path', () => {
    const result = validateToolParams('readFile', {});
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });

  it('validates writeFile with content', () => {
    assert.equal(validateToolParams('writeFile', { path: '/tmp/t.txt', content: 'hello' }).valid, true);
  });

  it('rejects writeFile missing content', () => {
    assert.equal(validateToolParams('writeFile', { path: '/tmp/t.txt' }).valid, false);
  });

  it('validates execShell with command', () => {
    assert.equal(validateToolParams('execShell', { command: 'ls -la' }).valid, true);
  });

  it('rejects execShell without command', () => {
    assert.equal(validateToolParams('execShell', {}).valid, false);
  });

  it('validates httpRequest with url', () => {
    assert.equal(validateToolParams('httpRequest', { url: 'https://example.com' }).valid, true);
  });

  it('validates httpRequest with method enum', () => {
    assert.equal(validateToolParams('httpRequest', { url: 'https://example.com', method: 'POST' }).valid, true);
  });

  it('rejects httpRequest with invalid method', () => {
    assert.equal(validateToolParams('httpRequest', { url: 'https://example.com', method: 'INVALID' }).valid, false);
  });

  it('rejects unknown tool', () => {
    const result = validateToolParams('nonexistentTool', {});
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('Unknown tool'));
  });

  it('execShell is classified as high risk', () => {
    const meta = getToolMeta('execShell');
    assert.ok(meta);
    assert.equal(meta.riskLevel, 'high');
    assert.equal(meta.requiresApproval, true);
  });

  it('getRiskForTool returns high for execShell and unknown', () => {
    assert.equal(getRiskForTool('execShell'), 'high');
    assert.equal(getRiskForTool('unknownTool'), 'high');
  });

  it('listToolMeta returns all registered tools', () => {
    const tools = listToolMeta();
    assert.ok(tools.length >= 12);
    const names = tools.map((t) => t.name);
    assert.ok(names.includes('readFile'));
    assert.ok(names.includes('execShell'));
    assert.ok(names.includes('httpRequest'));
    assert.ok(names.includes('crawlWeb'));
  });
});
