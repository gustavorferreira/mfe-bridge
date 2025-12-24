'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

export default function Page() {
  const [items, setItems] = useState([]);

  // 🔹 MOCK LOCAL — DONO DO DADO
  const CITIES = useMemo(() => [
    { id: 1, name: 'São Paulo', uf: 'SP' },
    { id: 2, name: 'Rio de Janeiro', uf: 'RJ' },
    { id: 3, name: 'Belo Horizonte', uf: 'MG' },
    { id: 4, name: 'Curitiba', uf: 'PR' },
    { id: 5, name: 'Florianópolis', uf: 'SC' },
    { id: 6, name: 'Porto Alegre', uf: 'RS' },
    { id: 7, name: 'Salvador', uf: 'BA' },
    { id: 8, name: 'Recife', uf: 'PE' },
    { id: 9, name: 'Fortaleza', uf: 'CE' },
    { id: 10, name: 'Manaus', uf: 'AM' },
  ], []);

  const bridge = useMemo(() => {
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

  useEffect(() => {
    bridge.start();

    // 🔹 inicial
    setItems(CITIES);

    // 🔹 lógica de negócio AQUI
    const unsub = bridge.on(EVENTS.SEARCH_SUBMIT, payload => {
      const term = payload?.term?.toLowerCase() || '';

      const filtered = CITIES.filter(c => {
        if (!term) return true;

        return (
          String(c.id).includes(term) ||
          c.name.toLowerCase().includes(term) ||
          c.uf.toLowerCase().includes(term)
        );
      });

      setItems(filtered);
    });

    return () => {
      unsub();
      bridge.destroy();
    };
  }, [bridge, CITIES]);

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
            {items.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.uf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
