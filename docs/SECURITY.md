# Segurança em produção (checklist)

## 1) Nunca use "*" em produção
- Use `targetOrigin` explícito por iframe.
- No host: `register(clientId, iframeEl, { origin: 'https://mfeX.seudominio' })`
- No child: `allowedOrigins: ['https://host.seudominio']`

## 2) allowlist estrita
- Evite permitir múltiplas origins se não precisar.

## 3) Handshake (HELLO/READY)
- Já implementado.
- Use `clientId` fixo e opcionalmente um token (médio prazo do roadmap).

## 4) Validação de payload
- Para eventos críticos, valide payload antes de executar ação.

## 5) Rate limit
- Se receber muitos eventos, implemente rate limit por clientId (roadmap).

## 6) Monitoramento
- Ative `debug` apenas em dev.
- Em produção, logue eventos inválidos e tentativas de origin não permitida.
