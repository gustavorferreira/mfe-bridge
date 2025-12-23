# @mfe/bridge-react

Adapter React para usar `@mfe/bridge` sem acoplamento.

## Hook
```js
import { useBridge } from '@mfe/bridge-react'

export function MyComp() {
  const { bridge } = useBridge()
  // bridge.start() normalmente é feito no Provider
}
```

## Provider
```js
import { BridgeProvider } from '@mfe/bridge-react'

<BridgeProvider options={{ role:'child', channel:'mfe-v1', allowedOrigins:['http://localhost:3000'] }}>
  <App/>
</BridgeProvider>
```
