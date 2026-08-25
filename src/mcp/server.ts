import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Swarm } from '../swarm/index.js';
import { getKnowledgeGraph } from '../memory/graph.js';
import { getCrawlEngine } from '../tools/crawl.js';
import { getConfig } from '../config.js';
import { getNeuralMap } from '../neural/index.js';

function createSwarmMcpServer(options: { swarmConfig?: Record<string, unknown> } = {}): McpServer {
  const mcp = new McpServer({ name: 'S-AI Swarm', version: '5.0.0' });
  const graph = getKnowledgeGraph();
  const swarm = new Swarm(options.swarmConfig);
  const neuralMap = getNeuralMap();

  mcp.tool('swarm_query', 'Query the multi-agent swarm for a bias-reduced, multi-perspective answer',
    { question: z.string().describe('The question to ask the swarm'), maxRounds: z.number().optional().default(2) },
    async ({ question, maxRounds }) => {
      const result = await swarm.run(question, { maxRounds });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ answer: result.content, consensus: result.consensus, rounds: result.rounds, elapsed: result.elapsed }, null, 2) }] };
    }
  );

  mcp.tool('crawl_web', 'Crawl web pages and extract content using crawl4ai',
    { urls: z.array(z.string()).describe('URLs to crawl'), query: z.string().optional().describe('Search query instead of URLs') },
    async ({ urls, query }) => {
      const engine = getCrawlEngine();
      let results;
      if (query) {
        results = await engine.search(query, { maxResults: 3 });
      } else {
        results = await engine.crawl(urls);
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  mcp.tool('graph_store', 'Store information in the knowledge graph',
    { type: z.string().describe('Node type'), label: z.string().describe('Node label'), content: z.string().optional().describe('Node content') },
    async ({ type, label, content }) => {
      const id = graph.addNode(type, label, { content });
      return { content: [{ type: 'text' as const, text: `Stored: ${type}/${label} (id: ${id})` }] };
    }
  );

  mcp.tool('graph_query', 'Query the knowledge graph',
    { query: z.string().describe('Search query') },
    async ({ query }) => {
      const results = graph.query(query);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  mcp.tool('graph_stats', 'Get knowledge graph statistics', {}, async () => {
    return { content: [{ type: 'text' as const, text: JSON.stringify(graph.getStats(), null, 2) }] };
  });

  mcp.tool('bias_analysis', 'Analyze text for potential biases',
    { text: z.string().describe('Text to analyze for bias') },
    async ({ text }) => {
      const biases: Array<{ type: string; count: number; examples: string[] }> = [];
      const patterns = [
        { name: 'confirmation_bias', regex: /only|always|never|definitely|obviously|clearly/gi },
        { name: 'cherry_picking', regex: /study shows|research proves|experts say/gi },
        { name: 'false_equivalence', regex: /same as|just like|no different/gi },
        { name: 'overgeneralization', regex: /all|every|none|nobody|everybody|always|never/gi },
        { name: 'emotional_manipulation', regex: /terrifying|disgusting|amazing|incredible|unbelievable/gi }
      ];
      for (const p of patterns) {
        const matches = text.match(p.regex);
        if (matches) biases.push({ type: p.name, count: matches.length, examples: matches.slice(0, 3) });
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({ biasScore: biases.length / patterns.length, biases, wordCount: text.split(/\s+/).length }, null, 2) }] };
    }
  );

  mcp.tool('persona_set', 'Create or update a user persona for neural mapping (Digital Twin adaptation)',
    { name: z.string().describe('User name'), bio: z.string().optional().describe('User biography/description'), worldview: z.string().optional().describe('User worldview perspective') },
    async ({ name, bio, worldview }) => {
      const profile = neuralMap.setProfile({ name, bio: bio || '', worldview: worldview || '' });
      swarm.setPersonaContext(neuralMap.buildPersonaContext());
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, profile: { name: profile.name, id: profile.id } }, null, 2) }] };
    }
  );

  mcp.tool('persona_get', 'Get the current active persona profile', {}, async () => {
    const profile = neuralMap.getProfile();
    if (!profile) return { content: [{ type: 'text' as const, text: 'No active persona. Use persona_set to create one.' }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }] };
  });

  mcp.tool('persona_clear', 'Remove the active persona and deactivate neural mapping', {}, async () => {
    neuralMap.clearProfile();
    swarm.setPersonaContext('');
    return { content: [{ type: 'text' as const, text: 'Persona cleared. Neural mapping deactivated.' }] };
  });

  mcp.tool('persona_add_node', 'Add a context node (link, text, or file) to the active persona',
    { type: z.enum(['link', 'text', 'file']).describe('Node type'), title: z.string().describe('Node title'), content: z.string().describe('Node content') },
    async ({ type, title, content }) => {
      const node = neuralMap.addContextNode({ type, title, content });
      swarm.setPersonaContext(neuralMap.buildPersonaContext());
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, node: { id: node.id, title: node.title, type: node.type } }, null, 2) }] };
    }
  );

  mcp.resource('Swarm Status', 's-ai://swarm/status', { description: 'Current swarm agent statuses' }, async () => {
    return { contents: [{ uri: 's-ai://swarm/status', text: JSON.stringify(swarm.getStatus(), null, 2), mimeType: 'application/json' }] };
  });

  mcp.resource('Knowledge Graph', 's-ai://graph', { description: 'The full knowledge graph' }, async () => {
    return { contents: [{ uri: 's-ai://graph', text: JSON.stringify(graph.graph, null, 2), mimeType: 'application/json' }] };
  });

  mcp.tool('research_search', 'Search arXiv papers and build a citation graph (Paperscape-style)',
    { query: z.string().describe('Search query (e.g. "quantum computing", "cat:cs.AI")'), maxResults: z.number().optional().default(10) },
    async ({ query, maxResults }) => {
      const { searchArxiv, buildCitationGraph } = await import('../tools/arxiv.js');
      const result = await searchArxiv(query, 0, maxResults);
      const graph = buildCitationGraph(result.papers);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ papers: result.papers.slice(0, 5).map(p => ({ id: p.arxivId, title: p.title, authors: p.authors.slice(0, 3), year: p.published.slice(0, 4), url: p.absLink })), graph: { nodes: graph.nodes.length, edges: graph.edges.length }, total: result.totalResults }, null, 2) }] };
    }
  );

  mcp.tool('bhashini_translate', 'Translate text between English and Indian languages using Bhashini API',
    { text: z.string().describe('Text to translate'), sourceLanguage: z.string().optional().default('en'), targetLanguage: z.string().describe('Target language code (hi, ta, te, bn, mr, gu, etc.)') },
    async ({ text, sourceLanguage, targetLanguage }) => {
      const { getBhashiniProvider } = await import('../providers/bhashini.js');
      const bhashini = getBhashiniProvider();
      const result = await bhashini.translate(text, sourceLanguage, targetLanguage);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ translatedText: result.targetText, sourceLanguage: result.sourceLanguage, targetLanguage: result.targetLanguage }, null, 2) }] };
    }
  );

  mcp.prompt('multi_perspective', 'Ask a question and get multi-perspective analysis',
    { question: z.string().describe('The question') },
    ({ question }) => ({ messages: [{ role: 'user', content: { type: 'text' as const, text: `Analyze this from multiple perspectives with bias reduction: ${question}` } }] })
  );

  mcp.tool('reach_doctor', 'Check all internet channel statuses (Agent-Reach style)', {}, async () => {
    const { doctor, formatReport } = await import('../reach/index.js');
    const results = doctor();
    return { content: [{ type: 'text' as const, text: formatReport(results) }] };
  });

  mcp.tool('reach_read', 'Read content from a URL using the best available channel (web, YouTube, GitHub, Twitter, Reddit, Bilibili)',
    { url: z.string().describe('The URL to read') },
    async ({ url }) => {
      const { getChannels } = await import('../reach/index.js');
      const channels = getChannels();
      for (const ch of channels) {
        if (ch.canHandle && ch.canHandle(url) && ch.read) {
          try {
            const content = await ch.read(url);
            return { content: [{ type: 'text' as const, text: content }] };
          } catch (err: any) {
            return { content: [{ type: 'text' as const, text: `[${ch.name}] Read failed: ${err.message}` }] };
          }
        }
      }
      return { content: [{ type: 'text' as const, text: `No channel available to read: ${url}` }] };
    }
  );

  mcp.tool('reach_channels', 'List all available internet channels and their backends', {}, async () => {
    const { getChannels } = await import('../reach/index.js');
    const channels = getChannels();
    const list = channels.map(c => ({
      name: c.name,
      description: c.description,
      backends: c.backends,
      tier: c.tier,
    }));
    return { content: [{ type: 'text' as const, text: JSON.stringify(list, null, 2) }] };
  });

  return mcp;
}

async function startStdioMcp(): Promise<void> {
  const mcp = createSwarmMcpServer();
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

export { createSwarmMcpServer, startStdioMcp };
