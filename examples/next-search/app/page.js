'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const [term, setTerm] = useState('');

  // cria bridge apenas uma vez
  const bridge = useMemo(function () {
    return createBridge({
      role: 'child',
      channel: 'mfe-v1',
      allowedOrigins: ['http://localhost:3000'], // HOST
      clientId: 'search',

      // ✅ recomendado
      autoHello: true,
      enableHeartbeat: true,
      heartbeatIntervalMs: 2000,
      debug: true,
    });
  }, []);

  useEffect(function () {
    bridge.start();

    return function () {
      bridge.destroy();
    };
  }, [bridge]);

  function submit() {
    bridge.emit(EVENTS.SEARCH_SUBMIT, { term: term });
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h2>🔍 Pesquisa</h2>

      <input
        value={term}
        onChange={function (e) {
          setTerm(e.target.value);
        }}
        placeholder="Digite algo..."
        style={{
          padding: 8,
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: 8,
        }}
      />

      <button
        onClick={submit}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Pesquisar
      </button>

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        (Este MFE envia <b>SEARCH_SUBMIT</b> para o Host via @mfe/bridge)
      </p>
    </div>
  );
}
