'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const [term, setTerm] = useState('');

  const bridge = useMemo(() => createBridge({
    role: 'child',
    channel: 'mfe-v1',
    allowedOrigins: ['http://localhost:3000'],
    clientId: 'search',
  }), []);

  useEffect(() => {
    bridge.start();
    return () => bridge.destroy();
  }, [bridge]);

  return (
    <div style={{ padding: 16 }}>
      <h2>🔍 Pesquisa</h2>
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Digite algo..."
        style={{ padding: 8, width: '100%', boxSizing: 'border-box' }}
      />
      <button
        onClick={() => bridge.emit(EVENTS.SEARCH_SUBMIT, { term })}
        style={{ marginTop: 8, padding: 10 }}
      >
        Pesquisar
      </button>

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        (Este MFE envia SEARCH_SUBMIT para o Host via @mfe/bridge)
      </p>
    </div>
  );
}
