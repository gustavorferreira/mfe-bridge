'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const [items, setItems] = useState([]);

  const bridge = useMemo(() => createBridge({
    role: 'child',
    channel: 'mfe-v1',
    allowedOrigins: ['http://localhost:3000'],
    clientId: 'results',
  }), []);

  useEffect(() => {
    bridge.start();

    const unsub = bridge.on(EVENTS.SEARCH_RESULT, (payload) => {
      setItems(Array.isArray(payload) ? payload : []);
    });

    return () => {
      unsub();
      bridge.destroy();
    };
  }, [bridge]);

  return (
    <div style={{ padding: 16 }}>
      <h2>📊 Resultados</h2>
      <ul>
        {items.map((x) => (
          <li key={x.id}>
            {x.name} ({x.query})
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        (Este MFE recebe SEARCH_RESULT do Host via @mfe/bridge)
      </p>
    </div>
  );
}
