'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const [term, setTerm] = useState('');

  const bridge = useMemo(() => {
    return createBridge({
      role: 'child',
      channel: 'mfe-v1',
      allowedOrigins: ['http://localhost:3000'],
      clientId: 'search',
      autoHello: true,
      enableHeartbeat: true,
      debug: true,
    });
  }, []);

  useEffect(() => {
    bridge.start();
    return () => bridge.destroy();
  }, [bridge]);

  useEffect(() => {
    const t = setTimeout(() => {
      bridge.emit(EVENTS.SEARCH_SUBMIT, { term });
    }, 300);

    return () => clearTimeout(t);
  }, [term, bridge]);

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h2>🔍 Pesquisa</h2>

      <input
        value={term}
        onChange={e => setTerm(e.target.value)}
        placeholder="Filtrar por ID, cidade ou UF..."
        style={{ padding: 10, width: '100%', fontSize: 14 }}
      />
    </div>
  );
}
