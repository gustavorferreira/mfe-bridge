'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const [items, setItems] = useState([]);

  const bridge = useMemo(function () {
    return createBridge({
      role: 'child',
      channel: 'mfe-v1',
      allowedOrigins: ['http://localhost:3000'],
      clientId: 'results',
      autoHello: true,
      enableHeartbeat: true,
      debug: true,
    });
  }, []);

  useEffect(function () {
    bridge.start();

    const unsub = bridge.on(EVENTS.SEARCH_RESULT, function (payload) {
      setItems(Array.isArray(payload) ? payload : []);
    });

    return function () {
      unsub();
      bridge.destroy();
    };
  }, [bridge]);

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h2>📊 Resultados</h2>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>
          Nenhuma cidade encontrada.
        </p>
      ) : (
        <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th align="left">ID</th>
              <th align="left">Cidade</th>
              <th align="left">UF</th>
            </tr>
          </thead>
          <tbody>
            {items.map(function (c) {
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.uf}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
