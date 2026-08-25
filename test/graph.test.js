import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const TEST_GRAPH_DIR = join(homedir(), '.s-ai-test-graph');
if (!existsSync(TEST_GRAPH_DIR)) mkdirSync(TEST_GRAPH_DIR, { recursive: true });

after(() => {
  if (existsSync(TEST_GRAPH_DIR)) rmSync(TEST_GRAPH_DIR, { recursive: true, force: true });
});

describe('KnowledgeGraph', () => {
  it('should create a graph instance', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(TEST_GRAPH_DIR);
    assert.ok(graph);
    assert.ok(graph.graph);
  });

  it('should have default structure', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test1'));
    assert.equal(graph.graph.version, '2.0.0');
    assert.ok(Array.isArray(graph.graph.nodes));
    assert.ok(Array.isArray(graph.graph.edges));
  });

  it('should add nodes', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test2'));
    const id = graph.addNode('concept', 'Machine Learning');
    assert.ok(id);
    assert.equal(typeof id, 'string');
    assert.equal(graph.graph.nodes.length, 1);
  });

  it('should not duplicate nodes with same type and label', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test3'));
    const id1 = graph.addNode('concept', 'AI');
    const id2 = graph.addNode('concept', 'AI');
    assert.equal(id1, id2);
    assert.equal(graph.graph.nodes.length, 1);
  });

  it('should add edges between nodes', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test4'));
    const id1 = graph.addNode('concept', 'Deep Learning');
    const id2 = graph.addNode('concept', 'Neural Networks');
    graph.addEdge(id1, id2, 'subset_of');
    assert.equal(graph.graph.edges.length, 1);
    assert.equal(graph.graph.edges[0].relation, 'subset_of');
  });

  it('should not duplicate edges', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test5'));
    const id1 = graph.addNode('a', 'A');
    const id2 = graph.addNode('b', 'B');
    graph.addEdge(id1, id2, 'relates_to');
    graph.addEdge(id1, id2, 'relates_to');
    assert.equal(graph.graph.edges.length, 1);
  });

  it('should query nodes by text', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test6'));
    graph.addNode('topic', 'JavaScript Programming');
    graph.addNode('topic', 'Python Data Science');
    graph.addNode('topic', 'Rust Systems');
    const results = graph.query('JavaScript');
    assert.ok(results.length > 0);
    assert.ok(results[0].label.includes('JavaScript'));
  });

  it('should get node by id', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test7'));
    const id = graph.addNode('test', 'Findable');
    const node = graph.getNode(id);
    assert.ok(node);
    assert.equal(node.label, 'Findable');
  });

  it('should get edges for a node', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test8'));
    const id1 = graph.addNode('a', 'Source');
    const id2 = graph.addNode('b', 'Target');
    graph.addEdge(id1, id2, 'connects_to');
    const edges = graph.getEdges(id1);
    assert.equal(edges.length, 1);
  });

  it('should return stats', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test9'));
    graph.addNode('type1', 'Node1');
    graph.addNode('type2', 'Node2');
    const stats = graph.getStats();
    assert.equal(stats.nodes, 2);
    assert.ok(Array.isArray(stats.types));
  });

  it('should add conversations', async () => {
    const { KnowledgeGraph } = await import('../dist/src/memory/graph.js');
    const graph = new KnowledgeGraph(join(TEST_GRAPH_DIR, 'test10'));
    graph.addConversation('What is AI?', 'AI is artificial intelligence.');
    assert.ok(graph.graph.nodes.length > 0);
    assert.ok(graph.graph.edges.length > 0);
  });
});
