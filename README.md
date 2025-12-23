# @mfe/bridge — Comunicação segura para Micro-Frontends (iframe + postMessage)

Este repositório ZIP contém:

- **packages/mfe-bridge**: a lib core (universal, SSR-safe, ESM)
- **packages/mfe-bridge-react**: adapter React (hook + Provider opcional)
- **examples/next-host**: Host (orquestrador) em Next.js (App Router, JS)
- **examples/next-search**: MFE de pesquisa em Next.js (JS)
- **examples/next-results**: MFE de resultados em Next.js (JS)

## Requisitos
- Node 18+
- npm 9+ (ou pnpm/yarn)

## Rodar o exemplo (3 apps)
Na raiz:

```bash
npm install
npm install -w packages/mfe-bridge
npm install -w examples/next-host
npm install -w examples/next-search
npm install -w examples/next-results
npm run build -w packages/mfe-bridge
npm run dev
```

Portas padrão:
- Host: http://localhost:3000
- Search: http://localhost:3001
- Results: http://localhost:3002

## Ideia
- **Host** define layout e iframe slots
- **MFEs** são independentes e se comunicam com o host via **@mfe/bridge**

## Segurança (por padrão)
- allowlist de origins
- channel para isolar apps
- envelope assinado (__mfe_bridge__)
- listener só roda após `start()` (SSR-safe)
- host pode “bindar” clientId ao window do iframe (opcional)
- handshake "HELLO/READY" (opcional)
- RPC request/response com timeout (opcional)

## Roadmap (já incluído e extensível)
Veja `docs/ROADMAP.md`.
