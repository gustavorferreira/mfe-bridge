# @mfe/bridge

Lib universal (framework-agnostic) para comunicação entre **Host** e **MFEs** (iframes) via `postMessage`.

## Instalação
```bash
npm i @mfe/bridge
```

## Uso (Child)
```js
import { createBridge } from '@mfe/bridge'

const bridge = createBridge({
  role: 'child',
  channel: 'mfe-v1',
  allowedOrigins: ['http://localhost:3000'],
  clientId: 'search'
})

bridge.start()
bridge.emit('SEARCH_SUBMIT', { term: 'abc' })
bridge.on('SEARCH_RESULT', console.log)
```

## Uso (Host)
```js
import { createBridge } from '@mfe/bridge'

const host = createBridge({
  role: 'host',
  channel: 'mfe-v1',
  allowedOrigins: ['http://localhost:3001','http://localhost:3002'],
})

host.start()
host.register('search', iframeElSearch, { origin: 'http://localhost:3001' })
host.register('results', iframeElResults, { origin: 'http://localhost:3002' })
```
