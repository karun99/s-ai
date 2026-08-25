/**
 * Worker jobs (FR-W1, FR-W2, FR-W5) — definitions, cron parser, history ring.
 *
 * jobs.json model: { id, name, trigger(manual|schedule|event), task, tools[], policy }
 * Fires only while a host process lives (CLI watch or dashboard tab).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getJobsPath, loadOwConfig, appendLog } from '../config.js';
import type { OwJob } from '../config.js';

export interface JobRunRecord {
  jobId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'ok' | 'error' | 'skipped';
  error?: string;
  artifacts?: string[];
  durationMs?: number;
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface CronFields { minute: Set<number>; hour: Set<number>; dom: Set<number> | null; month: Set<number>; dow: Set<number> | null; }

/** Parse a standard 5-field cron expression. Supports *, step values, ranges, lists, names. */
export function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron expression must have 5 fields: "${expr}"`);
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dom: parts[2] === '*' ? null : parseField(parts[2], 1, 31),
    month: parseField(remapNames(parts[3], MONTH_NAMES), 1, 12),
    dow: parts[4] === '*' ? null : parseField(remapNames(parts[4], DAY_NAMES), 0, 6)
  };
}

function remapNames(field: string, names: string[]): string {
  let out = field.toLowerCase();
  names.forEach((name, i) => { out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), String(i)); });
  // cron allows both 0 and 7 for Sunday
  if (names === DAY_NAMES) out = out.replace(/\b7\b/g, '0');
  return out;
}

function parseField(field: string, min: number, max: number): Set<number> {
  const result = new Set<number>();
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart ? parseInt(stepPart, 10) : 1;
    if (!Number.isFinite(step) || step < 1) throw new Error(`bad cron step in "${field}"`);
    let lo = min; let hi = max;
    if (rangePart !== '*') {
      const m = rangePart.match(/^(\d+)(-(\d+))?$/);
      if (!m) throw new Error(`bad cron field "${part}"`);
      lo = parseInt(m[1], 10); hi = m[3] ? parseInt(m[3], 10) : lo;
    }
    if (lo < min || hi > max || lo > hi) throw new Error(`cron range out of bounds in "${part}"`);
    for (let v = lo; v <= hi; v += step) result.add(v);
  }
  return result;
}

export function cronMatches(fields: CronFields, d: Date): boolean {
  if (!fields.minute.has(d.getMinutes())) return false;
  if (!fields.hour.has(d.getHours())) return false;
  if (fields.month.size && !fields.month.has(d.getMonth() + 1)) return false;
  const domOk = !fields.dom || fields.dom.has(d.getDate());
  const dowOk = !fields.dow || fields.dow.has(d.getDay());
  // standard cron semantics: if both dom and dow are restricted, either may match
  if (fields.dom && fields.dow) return domOk || dowOk;
  return domOk && dowOk;
}

/** Next matching minute strictly after `from`. Returns null after 2 years of scanning. */
export function nextCronFire(expr: string, from: Date): Date | null {
  const fields = parseCron(expr);
  const t = new Date(from.getTime());
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60 * 2; i++) {
    if (cronMatches(fields, t)) return new Date(t.getTime());
    t.setMinutes(t.getMinutes() + 1);
  }
  return null;
}

/* ------------------------------ job store -------------------------------- */

interface JobsFile { version: number; jobs: OwJob[]; history: JobRunRecord[]; }

const HISTORY_RING_LIMIT_DEFAULT = 200;

function emptyJobsFile(): JobsFile { return { version: 1, jobs: [], history: [] }; }

export class JobStore {
  private path: string;
  private file: JobsFile;

  constructor(path?: string) {
    this.path = path ?? getJobsPath();
    this.file = this._load();
  }

  _load(): JobsFile {
    if (existsSync(this.path)) {
      try {
        const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as JobsFile;
        if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
        if (!Array.isArray(parsed.history)) parsed.history = [];
        return parsed;
      } catch { /* corrupt file starts fresh but preserves nothing silently */ }
    }
    return emptyJobsFile();
  }

  save(): void {
    writeFileSync(this.path, JSON.stringify(this.file, null, 2));
  }

  add(job: Omit<OwJob, 'id'> & { id?: string }): OwJob {
    const full: OwJob = { id: job.id ?? `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, ...job } as OwJob;
    if (full.trigger.type === 'schedule') parseCron(full.trigger.cron || ''); // validate eagerly
    this.file.jobs.push(full);
    this.save();
    return full;
  }

  remove(idOrName: string): boolean {
    const before = this.file.jobs.length;
    this.file.jobs = this.file.jobs.filter(j => j.id !== idOrName && j.name !== idOrName);
    if (this.file.jobs.length !== before) { this.save(); return true; }
    return false;
  }

  list(): OwJob[] { return [...this.file.jobs]; }

  get(idOrName: string): OwJob | undefined {
    return this.file.jobs.find(j => j.id === idOrName || j.name === idOrName);
  }

  /** FR-W5 — history ring buffer (bounded). */
  recordHistory(rec: JobRunRecord): void {
    const limit = loadOwConfig().jobs?.historyLimit ? HISTORY_RING_LIMIT_DEFAULT : HISTORY_RING_LIMIT_DEFAULT;
    this.file.history.push(rec);
    if (this.file.history.length > limit) this.file.history.splice(0, this.file.history.length - limit);
    this.save();
  }

  historyFor(idOrName: string): JobRunRecord[] {
    const job = this.get(idOrName);
    return this.file.history.filter(h => h.jobId === (job?.id ?? idOrName));
  }

  lastRun(idOrName: string): JobRunRecord | undefined {
    const hist = this.historyFor(idOrName);
    return hist[hist.length - 1];
  }

  /** Return schedule jobs due at `now` based on last fire time. */
  dueJobs(now: Date): Array<{ job: OwJob; scheduledFor: Date }> {
    const due: Array<{ job: OwJob; scheduledFor: Date }> = [];
    for (const job of this.file.jobs) {
      if (job.trigger.type !== 'schedule' || !job.trigger.cron) continue;
      const fields = parseCron(job.trigger.cron);
      if (!cronMatches(fields, now)) continue;
      const last = this.lastRun(job.id);
      // avoid double-firing within the same minute
      if (last) {
        const lastStart = new Date(last.startedAt);
        if (lastStart.getFullYear() === now.getFullYear() && lastStart.getMonth() === now.getMonth() &&
            lastStart.getDate() === now.getDate() && lastStart.getHours() === now.getHours() &&
            lastStart.getMinutes() === now.getMinutes()) continue;
      }
      due.push({ job, scheduledFor: new Date(now.getTime()) });
    }
    return due;
  }
}

/** Watch loop — call from `openworker jobs run` or the dashboard host process. */
export async function watchJobs(store: JobStore, runJob: (job: OwJob) => Promise<void>, intervalMs = 15_000, signal?: AbortSignal): Promise<void> {
  appendLog('jobs watch started');
  while (!signal?.aborted) {
    try {
      for (const { job } of store.dueJobs(new Date())) {
        await runJob(job);
      }
    } catch (err) {
      appendLog(`jobs watch error: ${(err as Error).message}`);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
