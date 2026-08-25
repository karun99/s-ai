# S-AI v5.1 — Multi-Agent Swarm Intelligence

[![npm version](https://img.shields.io/npm/v/@saikarun/s-ai?color=6366f1&label=version)](https://www.npmjs.com/package/@saikarun/s-ai)
[![npm downloads](https://img.shields.io/npm/dm/@saikarun/s-ai?color=22c55e)](https://www.npmjs.com/package/@saikarun/s-ai)
[![License: MIT](https://img.shields.io/badge/license-MIT-ec4899)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-2c3e50)](package.json)
[![Build](https://img.shields.io/badge/build-passing-22c55e)](build/)

> **Published:** [`@saikarun/s-ai`](https://www.npmjs.com/package/@saikarun/s-ai) | **License:** MIT | **Platform:** Node.js >= 18 | **Module:** ESM (TypeScript)

A CLI-first multi-agent swarm system with **neural mapping (Digital Twin persona adaptation)**, **MCP Builder** (resource-efficient template-based MCP server creation), **Skill Creator** (customizable modular skill composition), **Research Mapper (Paperscape-style arXiv visualization)**, **Bhashini multilingual AI**, crawl4ai web scraping, MCP integration, knowledge graph, and bias-reduced consensus.

**No advanced hardware required** — runs on any device with a browser or Node.js. Zero inference cost with OpenRouter free models. Your data stays on your device.

## Demo

```bash
# Install & ask anything in 30 seconds
npx @saikarun/s-ai ask "What are the pros and cons of microservices?"
s-ai setup       # Interactive setup wizard
s-ai serve       # Start web dashboard
```

## Quick Start

```bash
npm install -g @saikarun/s-ai@latest    # Global install
npx @saikarun/s-ai ask "What are the pros and cons of microservices?"  # Or run directly
s-ai setup                               # Interactive setup wizard
s-ai serve                               # Start web dashboard
```

## Run with Docker

```bash
cp .env.example .env      # add your API keys
docker compose up -d --build
# Dashboard: http://localhost:3000
```

## Install from Source

```bash
git clone https://github.com/nsk/s-ai.git
cd s-ai
npm install            # postinstall builds dist/ automatically
```

## What's in v5.1

| Feature | Status |
|---------|--------|
| 6-agent swarm with bias-reduced consensus | Done |
| Neural mapping (Digital Twin persona) | Done |
| 20+ AI provider support | Done |
| crawl4ai web scraping | Done |
| MCP server + client integration | Done |
| Knowledge graph persistence | Done |
| AI Engine (prompt-to-app builder) | Done |
| Web dashboard with 4 themes | Done |
| **MCP Builder** (resource-efficient templates) | **New in 5.1** |
| **Skill Creator** (customizable modular skills) | **New in 5.1** |
| **Research Mapper** (Paperscape-style arXiv citation graph) | **New in 5.1** |
| **Bhashini Multilingual AI** (translation, TTS, ASR) | **New in 5.1** |
| **AI Studio** (video generation) | **New** |
| **Multi-platform builds** (Windows, macOS, Linux, Android, Docker) | **New in 5.1** |

---

## MCP Builder

Resource-efficient MCP server creation with pre-built templates. Each template is optimized for minimal memory footprint — ideal for edge devices, mobile, and low-resource environments.

```bash
# List available templates
s-ai engine mcp "list templates"

# Build from a template
s-ai engine mcp "Build a web search MCP server"

# Build from natural language
s-ai engine mcp "MCP server for bird call identification with 3 tools"
```

### Available Templates

| Template | Tools | Memory | Use Case |
|----------|-------|--------|----------|
| `data-api` | 5 | 8KB | CRUD operations on structured data |
| `web-search` | 3 | 4KB | Web search and content extraction |
| `file-system` | 4 | 2KB | Safe file operations with sandboxing |
| `ai-proxy` | 3 | 16KB | Multi-provider AI proxy |
| `knowledge-base` | 4 | 32KB | RAG-style document management |

### Programmatic Usage

```typescript
import { getMcpBuilder } from '@saikarun/s-ai';

const builder = getMcpBuilder({ lightweight: true });

// Build from template with customizations
const code = builder.buildFromTemplate('web-search', {
  name: 'my-search-server',
  removeTools: ['summarize'],
  addTools: [{ name: 'news', description: 'Search news', parameters: {} }],
});

// Memory-efficient — 4KB footprint
console.log(builder.getMemoryEstimate('web-search')); // 4096

// Build minimal server
const minimal = builder.buildMinimal('ping', [
  { name: 'ping', description: 'Health check', parameters: {} },
]);
```

### REST API

```
GET  /api/mcp-builder/templates    — List all templates with memory estimates
POST /api/mcp-builder/build        — Build MCP server from template or prompt
```

---

## Skill Creator

Customizable skill creation with modular composition. Skills can be created from templates, customized with additional tools, and hot-plugged into running swarms.

```bash
# List skill templates
s-ai engine skill "list templates"

# Create from template
s-ai engine skill "Build a data pipeline skill with extract, transform, load"

# Create from natural language
s-ai engine skill "Code review assistant with generate, review, refactor, explain"
```

### Available Skill Templates

| Template | Tools | Memory | Use Case |
|----------|-------|--------|----------|
| `api-wrapper` | 2 | 4KB | REST API wrapper with auth |
| `data-pipeline` | 4 | 8KB | ETL pipeline operations |
| `chat-agent` | 4 | 12KB | Customizable chat with persona & memory |
| `code-assistant` | 4 | 8KB | Code generation, review, refactoring |
| `notification-hub` | 2 | 4KB | Multi-channel notifications |

### Programmatic Usage

```typescript
import { getSkillCreator } from '@saikarun/s-ai';

const creator = getSkillCreator({ lightweight: true });

// Build from template
const skill = creator.buildFromTemplate('chat-agent', {
  name: 'ornith-assistant',
  description: 'Ornithology research assistant',
  addTools: [{
    name: 'identify_species',
    description: 'Identify bird species from description',
    inputSchema: { description: { type: 'string' } },
    handler: 'async ({ description }) => { ... }',
  }],
});

// Save to disk
creator.saveSkill('ornith-assistant', skill.skillJson, skill.indexCode);

// Memory estimate: 12KB
console.log(creator.getMemoryEstimate('chat-agent')); // 12288
```

### REST API

```
GET  /api/skill-creator/templates    — List all templates with memory estimates
POST /api/skill-creator/build        — Build skill from template or prompt
```

---

## Multi-Platform Builds

S-AI can be built as a standalone executable for every major platform. See [`build/`](build/) for full documentation.

| Platform | Artifact | Command |
|----------|----------|---------|
| Windows x64 | `s-ai.exe` | `npm run build:exe` |
| Windows x64 | `s-ai-setup.msi` | `npm run build:msi` |
| Linux x64 | `s-ai-linux` | `npm run build:exe` |
| Linux ARM64 | `s-ai-linux-arm64` | `npm run build:exe` |
| macOS x64 | `s-ai-macos` | `npm run build:exe` |
| macOS ARM64 | `s-ai-macos-arm64` | `npm run build:exe` |
| Android | `s-ai.apk` | `npm run build:apk` |
| Docker | `s-ai:latest` | `npm run build:docker` |

### Build All Platforms

```bash
npm run build:all    # Build everything (requires toolchains)
bash build/scripts/build-exe.sh    # Just executables
bash build/scripts/build-apk.sh    # Just Android APK
bash build/scripts/build-docker.sh # Just Docker
```

### CI/CD

GitHub Actions (`.github/workflows/build.yml`) automatically builds all platforms on push to `main` or version tags. Releases are created with all artifacts attached.

---

## Case Study: Ornith 1.5

[**Ornith 1.5**](docs/case-study-ornith-1.5.md) demonstrates S-AI deployed across 12 field stations in the Western Ghats for real-time avian ecology monitoring. Key results:

- **Survey cycle**: 4-6 months → 2-3 weeks
- **Species ID accuracy**: 78% → 94.2%
- **Hardware**: Raspberry Pi 5 (4GB) on solar power, $300/station
- **Memory footprint**: 68KB total (MCP servers + skills)
- **Connectivity**: Zero (fully offline with local Llama 3.2 3B)

Read the full case study: [`docs/case-study-ornith-1.5.md`](docs/case-study-ornith-1.5.md)

---

## CLI Commands

```
Core:        s-ai ask | setup | serve | status | help
Neural:      s-ai persona set | show | clear | node | profiles
Swarm:       s-ai swarm status | reset | agents
Graph:       s-ai graph query | stats | store
Research:    s-ai research search | map | graph
Bhashini:    s-ai bhashini translate | status | pipelines
Web:         s-ai crawl | search
MCP:         s-ai mcp serve | tools | servers
Providers:   s-ai provider list | set | test | models | model
Skills:      s-ai skill list | install | remove
AI Engine:   s-ai engine build | skill | mcp | swarm | list | ui
Config:      s-ai config | get | set | init | setup
```

## Supported Providers

OpenRouter (100+ models), OpenAI, Anthropic, Google AI, Ollama (local), Nvidia, Cohere, Grok (xAI), Kimi, Pi, Together AI, Fireworks AI, AWS Bedrock, Claude on AWS, Vertex AI, Azure Foundry, KoboldCPP, Oobabooga, MLC LLM, OpenAI-Compatible, **Bhashini (multilingual)**.

## Programmatic Usage

```typescript
import { Swarm, NeuralMap, searchArxiv, buildCitationGraph, getBhashiniProvider } from '@saikarun/s-ai';

// Neural mapping
const neuralMap = getNeuralMap();
neuralMap.setProfile({ name: 'Alice', bio: 'Senior architect' });

// Swarm
const swarm = new Swarm();
swarm.setPersonaContext(neuralMap.buildPersonaContext());
const result = await swarm.run('Should we use microservices?');

// Research Mapper
const arxivResult = await searchArxiv('quantum machine learning', 0, 10);
const graph = buildCitationGraph(arxivResult.papers);

// Bhashini translation
const bhashini = getBhashiniProvider();
const translated = await bhashini.translate('Hello', 'en', 'hi');

// MCP Builder (resource-efficient)
import { getMcpBuilder } from '@saikarun/s-ai';
const mcpBuilder = getMcpBuilder({ lightweight: true });
const serverCode = mcpBuilder.buildFromTemplate('web-search', { name: 'my-search' });

// Skill Creator (customizable)
import { getSkillCreator } from '@saikarun/s-ai';
const skillCreator = getSkillCreator({ lightweight: true });
const skill = skillCreator.buildFromTemplate('chat-agent', { name: 'my-agent' });
```

## Package Exports

```typescript
// Core
import { Swarm } from '@saikarun/s-ai/swarm';
import { Agent } from '@saikarun/s-ai/agent';
import { NeuralMap, getNeuralMap } from '@saikarun/s-ai/neural';
import { getConfig } from '@saikarun/s-ai/config';
import { createProvider } from '@saikarun/s-ai/providers';
import { KnowledgeGraph } from '@saikarun/s-ai/graph';
import { CrawlEngine } from '@saikarun/s-ai/crawl';
import { createSwarmMcpServer } from '@saikarun/s-ai/mcp';
import { getMcpClientManager } from '@saikarun/s-ai/mcp/client';

// Research Mapper (v5.1)
import { searchArxiv, buildCitationGraph } from '@saikarun/s-ai/arxiv';

// Bhashini Multilingual AI (v5.1)
import { getBhashiniProvider, BhashiniProvider } from '@saikarun/s-ai/bhashini';
import { getBhashiniTools } from '@saikarun/s-ai/bhashini/tools';
```

## Environment Variables

`OPENROUTER_API_KEY` | `OPENAI_API_KEY` | `ANTHROPIC_API_KEY` | `GOOGLE_API_KEY` | `OLLAMA_BASE_URL` | `NVIDIA_API_KEY` | `AWS_BEDROCK_REGION` | `AWS_ACCESS_KEY_ID` | `AWS_SECRET_ACCESS_KEY` | `AWS_SESSION_TOKEN` | `CLAUDE_AWS_API_KEY` | `VERTEX_AI_PROJECT_ID` | `VERTEX_AI_REGION` | `VERTEX_AI_ACCESS_TOKEN` | `FOUNDRY_RESOURCE` | `FOUNDRY_API_KEY` | `TOGETHER_API_KEY` | `FIREWORKS_API_KEY` | `COHERE_API_KEY` | `GROK_API_KEY` | `KIMI_API_KEY` | `PI_API_KEY` | `OPENAI_COMPATIBLE_BASE_URL` | `OPENAI_COMPATIBLE_API_KEY` | `SAI_PRIMARY_PROVIDER` | `BHASHINI_API_KEY` | `BHASHINI_USER_ID` | `BHASHINI_PIPELINE_ID`

## Documentation

- [Build System](build/README.md) — Multi-platform build instructions
- [Ornith 1.5 Case Study](docs/case-study-ornith-1.5.md) — Edge deployment case study
- [Docker Guide](Dockerfile) — Container deployment
- [API Reference](src/server.ts) — REST API endpoints

## License

MIT — Copyright (c) 2026 nsk

See [LICENSE](LICENSE) for the full text.
