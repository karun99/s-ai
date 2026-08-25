import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, resolve, relative } from 'node:path';
import { homedir } from 'node:os';

interface ToolParameter {
  type: string;
  description: string;
  default?: unknown;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const SAFE_ROOTS = [homedir(), process.cwd()];

function isPathSafe(targetPath: string): boolean {
  const resolved = resolve(targetPath);
  return SAFE_ROOTS.some(root => resolved === root || resolved.startsWith(root + '/'));
}

const TOOLS: Record<string, ToolDefinition> = {
  readFile: {
    name: 'readFile',
    description: 'Read a file from the filesystem',
    parameters: { path: { type: 'string', description: 'File path to read' } },
    async execute({ path }) {
      if (!isPathSafe(path as string)) return { error: 'Access denied: path outside allowed directories' };
      if (!existsSync(path as string)) return { error: `File not found: ${path}` };
      const content = readFileSync(path as string, 'utf8');
      return { content, path, size: content.length };
    }
  },

  writeFile: {
    name: 'writeFile',
    description: 'Write content to a file',
    parameters: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' }
    },
    async execute({ path, content }) {
      if (!isPathSafe(path as string)) return { error: 'Access denied: path outside allowed directories' };
      const dir = dirname(path as string);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(path as string, content as string);
      return { success: true, path, bytesWritten: (content as string).length };
    }
  },

  listDir: {
    name: 'listDir',
    description: 'List files and directories in a path',
    parameters: { path: { type: 'string', description: 'Directory path' } },
    async execute({ path }) {
      if (!isPathSafe(path as string)) return { error: 'Access denied: path outside allowed directories' };
      if (!existsSync(path as string)) return { error: `Directory not found: ${path}` };
      const entries = readdirSync(path as string, { withFileTypes: true }).map(e => ({
        name: e.name, type: e.isDirectory() ? 'directory' : 'file',
        path: join(path as string, e.name)
      }));
      return { entries, count: entries.length };
    }
  },

  searchFiles: {
    name: 'searchFiles',
    description: 'Search for files matching a pattern',
    parameters: {
      path: { type: 'string', description: 'Root directory' },
      pattern: { type: 'string', description: 'Filename pattern (simple string match)' },
      maxResults: { type: 'number', description: 'Max results', default: 20 }
    },
    async execute({ path, pattern, maxResults = 20 }) {
      if (!isPathSafe(path as string)) return { error: 'Access denied: path outside allowed directories' };
      if (!existsSync(path as string)) return { error: `Directory not found: ${path}` };
      const results: string[] = [];
      function walk(dir: string): void {
        if (results.length >= (maxResults as number)) return;
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (results.length >= (maxResults as number)) return;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) walk(fullPath);
            else if (entry.name.toLowerCase().includes((pattern as string).toLowerCase())) results.push(fullPath);
          }
        } catch {}
      }
      walk(path as string);
      return { results, count: results.length };
    }
  }
};

function getTool(name: string): ToolDefinition | undefined { return TOOLS[name]; }
function listTools(): Array<{ name: string; description: string }> { return Object.values(TOOLS).map(t => ({ name: t.name, description: t.description })); }

async function runTool(name: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = TOOLS[name];
  if (!tool) return { error: `Unknown tool: ${name}` };
  return await tool.execute(params);
}

export { TOOLS, getTool, listTools, runTool };
export type { ToolParameter, ToolDefinition };
