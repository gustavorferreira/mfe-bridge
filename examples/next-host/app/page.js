'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createBridge } from '@mfe/bridge';
import { EVENTS } from './events';

/* ===================== UI (INALTERADO) ===================== */

function Skeleton() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ height: 16, width: 140, background: '#eee', borderRadius: 6, marginBottom: 10 }} />
      <div style={{ height: 10, width: '80%', background: '#eee', borderRadius: 6, marginBottom: 6 }} />
      <div style={{ height: 10, width: '60%', background: '#eee', borderRadius: 6 }} />
    </div>
  );
}

function OfflineCard(props) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#fafafa' }}>
      <div>
        <h4>{props.title}</h4>
        <p>{props.subtitle}</p>
        <button onClick={props.onRetry}>Tentar novamente</button>
      </div>
    </div>
  );
}

function MfePanel(props) {
  var showIframe = props.status === 'ready';

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: 8, borderBottom: '1px solid #eee' }}>
        <b>{props.id}</b> — {props.status}
      </div>

      <div style={{ height: 'calc(100% - 40px)' }}>
        {props.status === 'loading' && <Skeleton />}
        {props.status === 'offline' && (
          <OfflineCard
            title={'Módulo "' + props.id + '" indisponível'}
            subtitle={props.reason || 'Falha ao carregar'}
            onRetry={props.onRetry}
          />
        )}

        <iframe
          ref={props.iframeRef}
          src={props.src}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            display: showIframe ? 'block' : 'none',
          }}
        />
      </div>
    </div>
  );
}

/* ===================== PAGE ===================== */

export default function Page() {
  var searchRef = useRef(null);
  var resultsRef = useRef(null);

  var [status, setStatus] = useState({
    search: { status: 'loading' },
    results: { status: 'loading' },
  });

  // 🔹 MOCK CENTRAL (fonte da verdade)
  var CITIES = useMemo(function () {
    return [
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
    ];
  }, []);

  var host = useMemo(function () {
    return createBridge({
      role: 'host',
      channel: 'mfe-v1',
      allowedOrigins: ['http://localhost:3001', 'http://localhost:3002'],
      debug: true,
      enableHeartbeat: true,
    });
  }, []);

  useEffect(function () {
    host.start();

    var offStatus = host.onStatus(function (id, s) {
      setStatus(function (prev) {
        return Object.assign({}, prev, { [id]: s });
      });
    });

    var t = setInterval(function () {
      if (searchRef.current && searchRef.current.contentWindow) {
        try {
          host.register('search', searchRef.current, { origin: 'http://localhost:3001' });
        } catch (_) {}
      }
      if (resultsRef.current && resultsRef.current.contentWindow) {
        try {
          host.register('results', resultsRef.current, { origin: 'http://localhost:3002' });
        } catch (_) {}
      }
      if (searchRef.current && resultsRef.current) clearInterval(t);
    }, 50);

    // 🔹 envia lista completa ao iniciar
    host.onStatus(function (id, s) {
      if (id === 'results' && s.status === 'ready') {
        host.send('results', EVENTS.SEARCH_RESULT, CITIES);
      }
    });

    // 🔹 filtro ao pesquisar
    var unsub = host.on(EVENTS.SEARCH_SUBMIT, function (payload) {
      var term = payload && payload.term ? payload.term.toLowerCase() : '';

      var filtered = CITIES.filter(function (c) {
        return c.name.toLowerCase().includes(term);
      });

      host.send('results', EVENTS.SEARCH_RESULT, filtered);
    });

    return function () {
      clearInterval(t);
      offStatus();
      unsub();
      host.destroy();
    };
  }, [host, CITIES]);

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, height: '100vh', padding: 16 }}>
      <MfePanel
        id="search"
        src="http://localhost:3001"
        iframeRef={searchRef}
        status={status.search.status}
        reason={status.search.reason}
        onRetry={function () {
          host.retry('search');
        }}
      />

      <MfePanel
        id="results"
        src="http://localhost:3002"
        iframeRef={resultsRef}
        status={status.results.status}
        reason={status.results.reason}
        onRetry={function () {
          host.retry('results');
        }}
      />
    </main>
  );
}
