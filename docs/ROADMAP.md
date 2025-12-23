# Roadmap / Próximos passos (incluídos + futuros)

## Incluídos neste ZIP (já implementados)
1. **Core universal SSR-safe**
   - start()/destroy() para evitar `window is not defined`
2. **Eventos**
   - on/off/emit (child → host)
   - send/broadcast (host → child)
3. **Segurança**
   - allowlist de origin por instância
   - channel isolado
   - envelope assinado (__mfe_bridge__)
4. **RPC**
   - request() com timeout
   - handle() para responder
5. **Handshake**
   - child pode anunciar HELLO + clientId
   - host responde READY
6. **React adapter**
   - `useBridge()` e `BridgeProvider`

## Próximos passos recomendados (curto prazo)
- **TargetOrigin obrigatório em produção**
  - nunca usar "*" fora de dev
- **Schema validation**
  - validar payload por evento (ex: zod/yup ou validação manual)
- **Audit/logging**
  - callbacks para auditoria (ex: onInvalidMessage, onBlockedOrigin)
- **Policy plugin**
  - permitir/nega eventos por clientId e tipo

## Médio prazo
- **Handshake com token**
  - compartilhar um token por iframe (ex: via querystring) e validar no host
- **Rate limiting**
  - limitar mensagens por segundo por clientId
- **Queue/backpressure**
  - buffering quando MFE ainda não está READY
- **Broadcast groups**
  - broadcast por “grupo” (ex: same domain, same team)

## Longo prazo
- **Cross-tab**
  - opcional usar BroadcastChannel para comunicação entre abas
- **SharedWorker**
  - hub global para múltiplas janelas (quando fizer sentido)
- **Devtools**
  - painel para inspecionar eventos e tempos de RPC
