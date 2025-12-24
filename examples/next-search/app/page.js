'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const [term, setTerm] = useState('');

  const bridge = useMemo(function () {
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

  useEffect(function () {
    bridge.start();
    return function () {
      bridge.destroy();
    };
  }, [bridge]);

  // 🔹 debounce simples (300ms)
  useEffect(function () {
    const t = setTimeout(function () {
      bridge.emit(EVENTS.SEARCH_SUBMIT, { term });
    }, 300);

    return function () {
      clearTimeout(t);
    };
  }, [term, bridge]);

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h2>🔍 Pesquisa</h2>

      <input
        value={term}
        onChange={function (e) {
          setTerm(e.target.value);
        }}
        placeholder="Filtrar por ID, cidade ou UF..."
        style={{
          padding: 10,
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 14,
        }}
      />
    </div>
  );
}
