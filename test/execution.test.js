import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Tool Registry', () => {
  it('should list all registered tools', async () => {
    const { listToolMeta } = await import('../dist/src/execution/registry.js');
    const tools = listToolMeta();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length >= 10);
  });

  it('should get tool metadata by name', async () => {
    const { getToolMeta } = await import('../dist/src/execution/registry.js');
    const meta = getToolMeta('readFile');
    assert.ok(meta);
    assert.equal(meta.name, 'readFile');
    assert.equal(meta.riskLevel, 'low');
    assert.equal(meta.category, 'filesystem');
    assert.equal(meta.reversible, false);
  });

  it('should return undefined for unknown tool', async () => {
    const { getToolMeta } = await import('../dist/src/execution/registry.js');
    const meta = getToolMeta('nonexistent');
    assert.equal(meta, undefined);
  });

  it('should get risk level for any tool', async () => {
    const { getRiskForTool } = await import('../dist/src/execution/registry.js');
    assert.equal(getRiskForTool('readFile'), 'low');
    assert.equal(getRiskForTool('writeFile'), 'medium');
    assert.equal(getRiskForTool('execShell'), 'high');
    assert.equal(getRiskForTool('unknown'), 'high');
  });

  it('should filter tools by risk level', async () => {
    const { getToolsByRisk } = await import('../dist/src/execution/registry.js');
    const lowRisk = getToolsByRisk('low');
    assert.ok(lowRisk.length >= 5);
    for (const t of lowRisk) {
      assert.equal(t.riskLevel, 'low');
    }
  });

  it('should filter tools by category', async () => {
    const { getToolsByCategory } = await import('../dist/src/execution/registry.js');
    const fsTools = getToolsByCategory('filesystem');
    assert.ok(fsTools.length >= 4);
    for (const t of fsTools) {
      assert.equal(t.category, 'filesystem');
    }
  });

  it('should have correct risk levels for dangerous tools', async () => {
    const { getToolMeta } = await import('../dist/src/execution/registry.js');
    const execShell = getToolMeta('execShell');
    assert.equal(execShell?.riskLevel, 'high');
    assert.equal(execShell?.requiresApproval, true);

    const sendEmail = getToolMeta('sendEmail');
    assert.equal(sendEmail?.riskLevel, 'high');
    assert.equal(sendEmail?.requiresApproval, true);
  });
});

describe('Execution Engine', () => {
  it('should create an execution plan', async () => {
    const { ExecutionEngine } = await import('../dist/src/execution/engine.js');
    const engine = new ExecutionEngine();
    const plan = engine.createPlan(
      [{ tool: 'readFile', params: { path: '/tmp/test.txt' }, reason: 'read test file' }],
      'test plan',
      0.85,
      2,
      1500
    );
    assert.ok(plan);
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].tool, 'readFile');
    assert.equal(plan.actions[0].riskLevel, 'low');
    assert.equal(plan.consensusScore, 0.85);
    assert.equal(plan.swarmRounds, 2);
  });

  it('should parse action plan from JSON in text', async () => {
    const { ExecutionEngine } = await import('../dist/src/execution/engine.js');
    const engine = new ExecutionEngine();
    const text = `Here's what I found:
\`\`\`json
{
  "actions": [
    { "tool": "readFile", "params": { "path": "/tmp/test.txt" }, "reason": "read file" }
  ],
  "rationale": "Need to read the file first"
}
\`\`\`
This should work.`;
    const plan = engine.parseActionPlan(text, 0.9, 3, 2000);
    assert.ok(plan);
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].tool, 'readFile');
  });

  it('should return null for text without action plan', async () => {
    const { ExecutionEngine } = await import('../dist/src/execution/engine.js');
    const engine = new ExecutionEngine();
    const plan = engine.parseActionPlan('This is just a regular response with no actions.', 0.8, 1, 1000);
    assert.equal(plan, null);
  });

  it('should execute a plan with auto-approved low risk', async () => {
    const { ExecutionEngine } = await import('../dist/src/execution/engine.js');
    const engine = new ExecutionEngine({ autoApproveLowRisk: true });
    const plan = engine.createPlan(
      [{ tool: 'readFile', params: { path: '/tmp/test.txt' }, reason: 'read file' }],
      'test', 0.8, 1, 1000
    );

    const report = await engine.executePlan(plan, async (tool, params) => {
      return { content: 'file content', path: params.path };
    });

    assert.equal(report.totalActions, 1);
    assert.equal(report.executed, 1);
    assert.equal(report.denied, 0);
  });

  it('should deny actions when no approval handler', async () => {
    const { ExecutionEngine } = await import('../dist/src/execution/engine.js');
    const engine = new ExecutionEngine({ autoApproveLowRisk: false });
    const plan = engine.createPlan(
      [{ tool: 'writeFile', params: { path: '/tmp/test.txt', content: 'hello' }, reason: 'write file' }],
      'test', 0.8, 1, 1000
    );

    const report = await engine.executePlan(plan, async () => ({}));
    assert.equal(report.denied, 1);
  });

  it('should always deny critical risk actions', async () => {
    const { ExecutionEngine } = await import('../dist/src/execution/engine.js');
    const engine = new ExecutionEngine({ autoApproveLowRisk: true });
    const plan = engine.createPlan(
      [{ tool: 'criticalTool', params: {}, reason: 'critical action' }],
      'test', 0.8, 1, 1000
    );

    const report = await engine.executePlan(plan, async () => ({}));
    assert.equal(report.denied, 1);
  });
});
