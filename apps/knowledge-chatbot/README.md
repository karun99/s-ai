# S-AI Knowledge Chat

A small, deployable source grounded assistant. It indexes public web pages, retrieves relevant passages, and asks a second model pass to check citation support before returning an answer.

## Run locally

```sh
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Configure at least one chat provider and one embedding provider, then set a long random `ADMIN_TOKEN` to add sources from the page. Without KV credentials, the knowledge base is held in process memory and is lost when the process restarts. For hosted deployments, configure the Upstash REST variables for persistence.

## Deploy to Vercel

1. Import `karun99/s-ai` into Vercel.
2. Set the project **Root Directory** to `apps/knowledge-chatbot`.
3. Use Node.js 20.9 or newer and the default Next.js build settings.
4. Add provider, embedding, storage, and admin variables from `.env.example` in the Vercel project settings.
5. Deploy, then open the project URL and index public pages with the admin token.

Never put provider keys, the Upstash token, or `ADMIN_TOKEN` in `NEXT_PUBLIC_*` variables. Answers are public to visitors; only source management requires the admin token.

## Configuration

Chat providers: OpenRouter, NVIDIA, Gemini, or Azure OpenAI. The default provider selection prefers free providers and falls back across configured providers. `DEFAULT_PROVIDER` selects the preferred provider; a request can override it through the API.

Embedding providers: Gemini (default), OpenRouter, NVIDIA, or Azure OpenAI. Keep the selected embedding provider and model stable while a knowledge base contains indexed documents; vectors from different models cannot be compared.

Set both `KV_REST_API_URL` and `KV_REST_API_TOKEN` to enable persistent Upstash REST storage. Without both, local in-memory storage is used. The store has document, passage, and 5 MB serialized data limits.

## API

- `GET /api/status` — provider readiness, storage mode, and indexed source metadata.
- `POST /api/chat` — `{ "message": "...", "history": [] }`; returns a reviewed answer and citation sources.
- `POST /api/admin/ingest` — bearer-authenticated `{ "url": "https://..." }` ingestion.
- `DELETE /api/admin/documents` — bearer-authenticated knowledge base clear.

The web fetcher allows only public HTTP(S) hosts, validates every redirect, restricts ports, and caps response sizes. API requests have same-origin checks, request size limits, and in-process rate limits.
