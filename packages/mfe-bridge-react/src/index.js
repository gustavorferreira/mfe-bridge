import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { createBridge } from '@mfe/bridge';

const BridgeCtx = createContext(null);

/**
 * BridgeProvider
 * - SSR-safe: createBridge does not touch window.
 * - start() is called inside useEffect.
 */
export function BridgeProvider({ options, children }) {
  const bridge = useMemo(() => createBridge(options), [options]);

  useEffect(() => {
    bridge.start();
    return () => bridge.destroy();
  }, [bridge]);

  return React.createElement(BridgeCtx.Provider, { value: { bridge } }, children);
}

export function useBridge() {
  const ctx = useContext(BridgeCtx);
  if (!ctx) {
    throw new Error('useBridge must be used inside <BridgeProvider>');
  }
  return ctx;
}
