'use client';

import { useEffect, useRef } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    const host = createBridge({
      role: 'host',
      channel: 'mfe-v1',
      allowedOrigins: ['http://localhost:3001', 'http://localhost:3002'],
      debug: true,
    });

    host.start();

    // Register iframes (bind origin per iframe for safer postMessage)
    const t = setInterval(() => {
      if (searchRef.current?.contentWindow) {
        try { host.register('search', searchRef.current, { origin: 'http://localhost:3001' }); } catch {}
      }
      if (resultsRef.current?.contentWindow) {
        try { host.register('results', resultsRef.current, { origin: 'http://localhost:3002' }); } catch {}
      }
      if (searchRef.current?.contentWindow && resultsRef.current?.contentWindow) clearInterval(t);
    }, 50);

    const unsub = host.on(EVENTS.SEARCH_SUBMIT, (payload) => {
      const term = payload?.term ?? '';
      const data = [
        { id: 1, name: 'Item A', query: term },
        { id: 2, name: 'Item B', query: term },
      ];
      host.send('results', EVENTS.SEARCH_RESULT, data);
    });

    return () => {
      clearInterval(t);
      unsub();
      host.destroy();
    };
  }, []);

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, height: '100vh' }}>
      <iframe
        ref={searchRef}
        src="http://localhost:3001"
        style={{ width: '100%', height: '100%', border: '1px solid #ccc' }}
        title="mfe-search"
      />
      <iframe
        ref={resultsRef}
        src="http://localhost:3002"
        style={{ width: '100%', height: '100%', border: '1px solid #ccc' }}
        title="mfe-results"
      />
    </main>
  );
}
