---
title: 'S-AI: a policy-gated multi-agent swarm with simulated-organoid intelligence and a local-first OpenWorker harness'
tags:
  - TypeScript
  - multi-agent systems
  - swarm intelligence
  - agentic AI
  - digital twin
  - execution safety
authors:
  - name: Sai Karun Nandipati
    orcid: 0009-0007-9218-9750
    affiliation: 1
affiliations:
  - name: Department of Data Science and Artificial Intelligence, PB Siddhartha College of Arts and Science
    index: 1
date: 25 September 2026
bibliography: paper.bib
---

# Summary

S-AI is a self-hosted, local-first "Artificial Mind": a multi-agent swarm that
reasons across specialized agents, reaches bias-reduced consensus, and acts
through a policy-gated execution layer instead of only answering questions. It
combines a Digital Twin persona-adaptation layer ("neural mapping"), a
Simulated Organoid Intelligence (SOI) for memory consolidation, an MCP Builder
and Skill Creator for extending tooling, a knowledge graph, multilingual
support (Bhashini), and an OpenWorker harness that installs natively on
Windows, macOS, Linux, Android, and Raspberry Pi, with scheduled jobs, reach
channels, and an encrypted credentials vault. Everything runs on the user's
own hardware with no required cloud dependency.

# Statement of need

Modern agentic frameworks give models *tools*, but rarely give users *control*
or *explainability* over when and how those tools execute. Users of
autonomous assistants need a system that (i) reasons from multiple
perspectives instead of a single model opinion, (ii) exposes every planned
action with a risk rating and an explicit approval gate, (iii) runs locally
so that keys and private data do not leave the device, and (iv) is installable
as a first-class desktop worker rather than a chat wrapper needing a hosted
deployment. S-AI addresses each of these needs in one package: consensus from
a 6-7 agent swarm, risk-rated action plans that pause for authorization, a
local-first runtime, and a native OpenWorker harness.

# State of the field

Multi-agent frameworks (e.g. CrewAI, AutoGen, LangGraph-style orchestration)
have popularized role-specialized agents, but they typically treat tool
calls as an optimization problem rather than a consent problem: a model may
execute any exposed tool on your behalf. Research on AI safety and
instrumental agency argues for the opposite posture — bounded, auditable
execution with explicit approval gates and sandboxing. Concurrently,
local-first personal AI has moved from a niche to a stated design goal,
motivated by privacy and by on-device economics. S-AI's contribution is the
synthesis of the two: swarm reasoning combined with a policy-gated execution
layer (approval gates, filesystem/shell sandboxing, SSRF protection, rate
limits) and a software-only simulated neural memory (SOI), all packaged as a
self-hosted OpenWorker with desktop installers.

# Software design

S-AI ships as a TypeScript/ESM package (`@saikarun/s-ai`) whose core
separation is *think* vs *act*. The `engine` runs the swarm and the
consensus mechanism; the `execution` layer takes the resulting plan, scores
each action for risk, and routes it through policy rules
(`allow` / `deny` / `require-approval`) before anything touches a real tool.
Key components: `neural` (Digital Twin persona adaptation from interaction
history), `soi` (simulated organoid memory consolidation), `mcp-builder`
and `skill-creator` (self-service capability extension), `reach` (Web,
YouTube, GitHub, RSS, arXiv channels with health checks), `vault`
(encrypted credential storage), and `suite/` (the OpenWorker CLI/daemon).
Security is enforced in CI (gitleaks, OSV-Scanner, govulncheck, Semgrep,
`npm audit`) and by construction (bearer-token auth, rate limiting, registry-
bound execution).

# Research impact statement

S-AI is a reference implementation of *bounded autonomy*: it demonstrates,
in deployable form, that an agentic system can combine multi-perspective
reasoning with explicit human-in-the-loop control over tool execution. Its
bias-reduced consensus and Digital Twin adaptation are measurable and
reproducible from a clean checkout (`npm install` + `npm test` within the
supported toolchain), and the security boundary is exercised by the
repository's CI pipelines. The package is published on npm and has been used
by the author's own agent-infrastructure research; broader adoption is
tracked in `paper/JOSS_SUBMISSION_READINESS.md`.

# AI usage disclosure

The code, documentation, and this paper were drafted with generative-AI
assistance (code scaffolding, copy-editing, test generation). All assisted
artifacts were reviewed, edited, and validated by the human author, who made
the design decisions. No AI rendered evaluative decisions in this submission.

# Acknowledgements

No direct funding was received.

# References