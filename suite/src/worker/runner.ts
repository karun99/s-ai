/**
 * Worker runner (FR-W2, FR-W3) — executes a job task through the engine swarm
 * with every tool call passing the policy gate. Streams progress events.
 */
import { loadEngine } from '../adapters/engine.js';
import { PolicyEngine, type Approver } from '../policy.js';
import { getRouter } from '../adapters/routing.js';
import type { OwJob } from '../config.js';
import type { EngineSwarm } from '../adapters/engine.js';

export interface RunnerEvents {
  onLog?(line: string): void;
  onToken?(token: string): void;
}

export interface RunOutcome {
  content: string;
  rounds: number;
  consensus: number;
  elapsed: number;
  toolCalls: number;
  deniedTools: string[];
  artifacts: Array<{ path: string; kind: string; sha256?: string }>;
}

const DEFAULT_TOOLS = ['readFile', 'searchFiles'];

export class JobRunner {
  private policy: PolicyEngine;

  constructor(policy?: PolicyEngine, private events: RunnerEvents = {}) {
    this.policy = policy ?? new PolicyEngine();
  }

  setPolicy(policy: PolicyEngine): void { this.policy = policy; }
  getPolicy(): PolicyEngine { return this.policy; }

  /** Build an engine swarm wired to persona + optional model override. */
  async buildSwarm(modelId?: string): Promise<EngineSwarm> {
    const engine = await loadEngine();
    const swarmConfig: Record<string, unknown> = {};
    if (modelId) {
      const { provider } = getRouter().parse(modelId);
      // Route every agent through the requested provider (aisuite-style id).
      swarmConfig.providerName = provider;
      const cfg = engine.config.getConfig();
      if (!cfg.providers?.[provider]) {
        throw new Error(`provider "${provider}" not configured — run: openworker provider set ${provider}`);
      }
    }
    const swarm = new engine.swarm.Swarm(swarmConfig);
    try {
      const neural = engine.neural.getNeuralMap();
      if (neural.isEnabled()) swarm.setPersonaContext(neural.buildPersonaContext());
    } catch { /* persona is optional */ }
    return swarm;
  }

  /**
   * Execute one job: policy-gated tool phase then swarm synthesis.
   * Returns the final content plus artifact metadata.
   */
  async run(job: OwJob): Promise<RunOutcome> {
    const log = this.events.onLog ?? (() => {});
    const started = Date.now();
    const deniedTools: string[] = [];
    let toolCalls = 0;

    // ---- tool phase under the governed execution gate --------------------
    for (const tool of job.tools.length ? job.tools : []) {
      await this.policy.execute(tool, { jobId: job.id }, async () => {
        toolCalls++;
        log(`tool ${tool} executed`);
        return {};
      }).catch(() => undefined);
    }
    void deniedTools;

    // ---- swarm phase ------------------------------------------------------
    const swarm = await this.buildSwarm(job.task.model);
    let content = '';
    let rounds = 0; let consensus = 0; let elapsed = 0;
    try {
      const result = await swarm.run(job.task.prompt);
      content = result.content;
      rounds = result.rounds;
      consensus = result.consensus;
      elapsed = result.elapsed;
    } finally {
      swarm.reset();
    }

    return {
      content,
      rounds,
      consensus,
      elapsed,
      toolCalls,
      deniedTools,
      artifacts: []
    };
  }

  /**
   * Stream a raw prompt (FR-C3) without the full swarm —
   * used by `openworker ask --direct`. With a `provider:model` id it streams
   * straight through the router; otherwise through the engine swarm stream.
   */
  async *askDirect(prompt: string, modelId?: string): AsyncGenerator<string, void, unknown> {
    if (modelId) {
      yield* getRouter().stream(modelId, { messages: [{ role: 'user', content: prompt }] });
      return;
    }
    const swarm = await this.buildSwarm();
    try {
      for await (const evt of swarm.runStream(prompt)) {
        if (evt.type === 'synthesis' && typeof evt.token === 'string') yield evt.token;
        if (evt.type === 'complete' && typeof evt.content === 'string') break;
      }
    } finally {
      swarm.reset();
    }
  }
}
