/**
 * Vault (FR-K1, FR-K2) — OS keychain first, encrypted-file fallback (OKF scheme).
 *
 * Backends, in order of preference per platform:
 *   - macOS:    `security` generic passwords
 *   - Linux:    `secret-tool` (libsecret)
 *   - Windows:  DPAPI via PowerShell ProtectedData (per-user scope)
 *   - fallback: ~/.openworker/keys.enc — AES-256-GCM + SHA-256 integrity, mode 0600
 *
 * Keys NEVER appear in logs/errors/--verbose output: every log path funnels
 * through redactSecrets().
 */
import { spawnSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openworkerDir, appendLog } from './config.js';

export type VaultBackend = 'macos-security' | 'linux-secret-tool' | 'windows-dpapi' | 'okf-file';

const SERVICE = 'openworker';

/* ----------------------------- backend probing ---------------------------- */

function hasBinary(bin: string): boolean {
  const probe = spawnSync(bin, ['--help'], { encoding: 'utf8', timeout: 4000 });
  return !probe.error && probe.status !== null;
}

export function detectBackend(): VaultBackend {
  switch (process.platform) {
    case 'darwin': return hasBinary('security') ? 'macos-security' : 'okf-file';
    case 'linux':
      return process.env.TERMUX_VERSION ? 'okf-file'
        : (hasBinary('secret-tool') ? 'linux-secret-tool' : 'okf-file');
    case 'win32': return 'windows-dpapi';
    default: return 'okf-file';
  }
}

/* ------------------------------ OKF file store ----------------------------- */

interface OkfEntry { iv: string; tag: string; data: string; }
interface OkfFile { v: number; created: string; entries: Record<string, OkfEntry>; }

function masterKey(): Buffer {
  // Master key material lives outside keys.enc so rotating entries never re-keys itself.
  const dir = openworkerDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const keyFile = join(dir, '.vault-master');
  if (!existsSync(keyFile)) {
    writeFileSync(keyFile, randomBytes(32).toString('base64'), { mode: 0o600 });
  }
  return Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'base64');
}

function okfPath(): string { return join(openworkerDir(), 'keys.enc'); }

function readOkf(): OkfFile {
  const p = okfPath();
  if (!existsSync(p)) return { v: 1, created: new Date().toISOString(), entries: {} };
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as OkfFile;
  } catch {
    throw new Error('keys.enc is corrupt or tampered (SHA-256/GCM integrity failure)');
  }
}

function writeOkf(file: OkfFile): void {
  writeFileSync(okfPath(), JSON.stringify(file, null, 2), { mode: 0o600 });
}

function entryId(service: string, key: string): string {
  return `${createHash('sha256').update(`${service}::${key}`).digest('hex').slice(0, 32)}`;
}

function okfSet(id: string, value: string): void {
  const file = readOkf();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  file.entries[id] = { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: enc.toString('base64') };
  writeOkf(file);
}

function okfGet(id: string): string | null {
  const file = readOkf();
  const entry = file.entries[id];
  if (!entry) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(entry.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(entry.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('vault entry failed GCM authentication — wrong key or tampered store');
  }
}

function okfDelete(id: string): boolean {
  const file = readOkf();
  if (!file.entries[id]) return false;
  delete file.entries[id];
  writeOkf(file);
  return true;
}

function okfList(): Array<{ service: string; key: string }> {
  // ids are hashed, so listing requires a sidecar alias table (non-secret names only).
  const aliasPath = join(openworkerDir(), 'keys.index.json');
  if (!existsSync(aliasPath)) return [];
  try {
    const idx = JSON.parse(readFileSync(aliasPath, 'utf8')) as Record<string, { service: string; key: string }>;
    return Object.values(idx);
  } catch { return []; }
}

function aliasRecord(id: string, service: string, key: string): void {
  const dir = openworkerDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const aliasPath = join(dir, 'keys.index.json');
  let idx: Record<string, { service: string; key: string }> = {};
  if (existsSync(aliasPath)) { try { idx = JSON.parse(readFileSync(aliasPath, 'utf8')); } catch {} }
  idx[id] = { service, key };
  writeFileSync(aliasPath, JSON.stringify(idx, null, 2), { mode: 0o600 });
}

/* ------------------------------- keychains -------------------------------- */

function macosSet(key: string, value: string): void {
  // Delete-then-add makes this idempotent.
  spawnSync('security', ['delete-generic-password', '-s', key, '-a', SERVICE], { timeout: 5000 });
  const res = spawnSync('security', ['add-generic-password', '-s', key, '-a', SERVICE, '-w', value], { timeout: 5000 });
  if (res.status !== 0) throw new Error('macOS keychain add-generic-password failed');
}
function macosGet(key: string): string | null {
  const res = spawnSync('security', ['find-generic-password', '-s', key, '-a', SERVICE, '-w'], { encoding: 'utf8', timeout: 5000 });
  if (res.status !== 0 || !res.stdout) return null;
  return res.stdout.trim();
}
function macosDelete(key: string): boolean {
  const res = spawnSync('security', ['delete-generic-password', '-s', key, '-a', SERVICE], { timeout: 5000 });
  return res.status === 0;
}

const SECRET_TOOL_ATTR = ['attribute-service', SERVICE, 'attribute-account'];

function linuxSet(key: string, value: string): void {
  const res = spawnSync('secret-tool', [...SECRET_TOOL_ATTR, key], { input: value, encoding: 'utf8', timeout: 5000 });
  if (res.status !== 0) throw new Error('secret-tool store failed');
}
function linuxGet(key: string): string | null {
  const res = spawnSync('secret-tool', ['lookup', ...SECRET_TOOL_ATTR, key], { encoding: 'utf8', timeout: 5000 });
  if (res.status !== 0 || !res.stdout) return null;
  return res.stdout.trim();
}
function linuxDelete(key: string): boolean {
  const res = spawnSync('secret-tool', ['clear', ...SECRET_TOOL_ATTR, key], { timeout: 5000 });
  return res.status === 0;
}

const PS_SNIPPET = (mode: 'protect' | 'unprotect') => `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$f=$args[0]; $o=$args[1]
if ('${mode}' -eq 'protect') {
  $bytes=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
  $enc=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  [IO.File]::WriteAllBytes($o,$enc)
} else {
  $enc=[IO.File]::ReadAllBytes($f)
  $dec=[Security.Cryptography.ProtectedData]::Unprotect($enc,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($dec))
}`;

function winTempName(): string { return join(process.env.TEMP || '.', `.ow-vault-${Date.now()}-${Math.random().toString(36).slice(2)}`); }

function dpapiProtect(value: string): Buffer {
  const inFile = winTempName(); const outFile = `${inFile}.out`;
  try {
    writeFileSync(inFile, value);
    const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_SNIPPET('protect'), inFile, outFile], { timeout: 20000 });
    if (res.status !== 0 || !existsSync(outFile)) throw new Error('DPAPI protect failed');
    return readFileSync(outFile);
  } finally {
    try { rmSync(inFile, { force: true }); } catch {}
    try { rmSync(`${inFile}.out`, { force: true }); } catch {}
  }
}

function dpapiUnprotect(blob: Buffer): string | null {
  const inFile = winTempName(); const outFile = `${inFile}.out`;
  try {
    writeFileSync(inFile, blob);
    const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_SNIPPET('unprotect'), inFile, outFile], { timeout: 20000 });
    if (res.status !== 0 || !existsSync(outFile)) return null;
    return readFileSync(outFile, 'utf8');
  } finally {
    try { rmSync(inFile, { force: true }); } catch {}
    try { rmSync(`${inFile}.out`, { force: true }); } catch {}
  }
}

/* ------------------------------- public API -------------------------------- */

const _loaded: Set<string> = new Set();

export function setSecret(key: string, value: string): { backend: VaultBackend } {
  const backend = detectBackend();
  try {
    if (backend === 'macos-security') macosSet(key, value);
    else if (backend === 'linux-secret-tool') linuxSet(key, value);
    else if (backend === 'windows-dpapi') {
      const blobFile = join(openworkerDir(), '.dpapi', `${entryId(SERVICE, key)}.bin`);
      mkdirSync(join(openworkerDir(), '.dpapi'), { recursive: true });
      writeFileSync(blobFile, dpapiProtect(value));
    } else okfSet(entryId(SERVICE, key), value);
  } catch {
    okfSet(entryId(SERVICE, key), value);
  }
  aliasRecord(entryId(SERVICE, key), SERVICE, key);
  _loaded.add(value);
  appendLog(`vault set ${key} backend=${backend}`);
  return { backend };
}

export function getSecret(key: string): string | null {
  const backend = detectBackend();
  try {
    let value: string | null = null;
    if (backend === 'macos-security') value = macosGet(key);
    else if (backend === 'linux-secret-tool') value = linuxGet(key);
    else if (backend === 'windows-dpapi') {
      const blobFile = join(openworkerDir(), '.dpapi', `${entryId(SERVICE, key)}.bin`);
      if (existsSync(blobFile)) value = dpapiUnprotect(readFileSync(blobFile));
    }
    if (value !== null && value !== undefined) { _loaded.add(value); return value; }
  } catch { /* fall through to OKF */ }
  const value = okfGet(entryId(SERVICE, key));
  if (value !== null) _loaded.add(value);
  return value;
}

export function deleteSecret(key: string): boolean {
  const backend = detectBackend();
  let removed = false;
  try {
    if (backend === 'macos-security') removed = macosDelete(key);
    else if (backend === 'linux-secret-tool') removed = linuxDelete(key);
    else if (backend === 'windows-dpapi') {
      const blobFile = join(openworkerDir(), '.dpapi', `${entryId(SERVICE, key)}.bin`);
      if (existsSync(blobFile)) { rmSync(blobFile); removed = true; }
    }
  } catch { /* ignore */ }
  const okfRemoved = okfDelete(entryId(SERVICE, key));
  appendLog(`vault delete ${key}`);
  return removed || okfRemoved;
}

export function listSecrets(): Array<{ service: string; key: string }> {
  return okfList().map(e => ({ service: e.service, key: e.key }));
}

/**
 * FR-K2 — redaction filter. Replaces known secret values plus common
 * credential shapes. Used by every logging/error surface in the harness.
 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /AKIA[0-9A-Z]{12,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
  /AIzaSy[A-Za-z0-9_-]{30,}/g
];

export function redactSecrets(text: string): string {
  let out = text ?? '';
  for (const value of _loaded) {
    if (value && value.length >= 6) out = out.split(value).join('***REDACTED***');
  }
  for (const pattern of CREDENTIAL_PATTERNS) out = out.replace(pattern, match => `${match.slice(0, 4)}***REDACTED***`);
  return out;
}

/** Timing-safe comparison helper exposed for token checks (NFR-9). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(createHash('sha256').update(a).digest());
  const bb = Buffer.from(createHash('sha256').update(b).digest());
  return timingSafeEqual(ab, bb);
}

/**
 * Migration helper (FR-C9): pull plaintext apiKeys out of an imported s-ai
 * config into the vault and strip them from the returned sanitized copy.
 */
export function extractKeysToVault(config: Record<string, any>): { sanitized: Record<string, any>; moved: Array<{ provider: string; keyName: string }> } {
  const sanitized: Record<string, any> = JSON.parse(JSON.stringify(config));
  const moved: Array<{ provider: string; keyName: string }> = [];
  const providers = sanitized?.providers;
  if (providers && typeof providers === 'object') {
    for (const [name, pcfg] of Object.entries(providers)) {
      if (pcfg && typeof pcfg === 'object' && typeof (pcfg as any).apiKey === 'string' && (pcfg as any).apiKey.length > 0) {
        setSecret(`provider:${name}:apiKey`, (pcfg as any).apiKey);
        delete (pcfg as any).apiKey;
        moved.push({ provider: name, keyName: `provider:${name}:apiKey` });
      }
    }
  }
  return { sanitized, moved };
}
