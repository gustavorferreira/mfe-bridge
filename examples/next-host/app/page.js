"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createBridge } from "@mfe/bridge";
import { EVENTS } from "./events";

/* ===================== UI (INALTERADO) ===================== */

function Skeleton() {
  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          height: 16,
          width: 140,
          background: "#eee",
          borderRadius: 6,
          marginBottom: 10,
        }}
      />
      <div
        style={{
          height: 10,
          width: "80%",
          background: "#eee",
          borderRadius: 6,
          marginBottom: 6,
        }}
      />
      <div
        style={{
          height: 10,
          width: "60%",
          background: "#eee",
          borderRadius: 6,
        }}
      />
    </div>
  );
}

function OfflineCard(props) {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "#fafafa",
      }}
    >
      <div>
        <h4>{props.title}</h4>
        <p>{props.subtitle}</p>
        <button onClick={props.onRetry}>Tentar novamente</button>
      </div>
    </div>
  );
}

function MfePanel(props) {
  const showIframe = props.status === "ready";

  return (
    <div
      style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}
    >
      <div style={{ padding: 8, borderBottom: "1px solid #eee" }}>
        <b>{props.id}</b> — {props.status}
      </div>

      <div style={{ height: "calc(100% - 40px)" }}>
        {props.status === "loading" && <Skeleton />}
        {props.status === "offline" && (
          <OfflineCard
            title={`Módulo "${props.id}" indisponível`}
            subtitle={props.reason || "Falha ao carregar"}
            onRetry={props.onRetry}
          />
        )}

        <iframe
          ref={props.iframeRef}
          src={props.src}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: showIframe ? "block" : "none",
          }}
        />
      </div>
    </div>
  );
}

/* ===================== PAGE ===================== */

export default function Page() {
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  const [status, setStatus] = useState({
    search: { status: "loading" },
    results: { status: "loading" },
  });

  const host = useMemo(() => {
    return createBridge({
      role: "host",
      channel: "mfe-v1",
      allowedOrigins: ["http://localhost:3001", "http://localhost:3002"],
      debug: true,
      enableHeartbeat: true,
    });
  }, []);

  useEffect(() => {
    host.start();

    const offStatus = host.onStatus((id, s) => {
      setStatus((prev) => ({ ...prev, [id]: s }));
    });

    const t = setInterval(() => {
      if (searchRef.current?.contentWindow) {
        host.register("search", searchRef.current, {
          origin: "http://localhost:3001",
        });
      }
      if (resultsRef.current?.contentWindow) {
        host.register("results", resultsRef.current, {
          origin: "http://localhost:3002",
        });
      }
      if (searchRef.current && resultsRef.current) clearInterval(t);
    }, 50);

    // 🔹 Host apenas REPASSA o evento
    const unsub = host.on(EVENTS.SEARCH_SUBMIT, (payload) => {
      host.send("results", EVENTS.SEARCH_SUBMIT, payload);
    });

    return () => {
      clearInterval(t);
      offStatus();
      unsub();
      host.destroy();
    };
  }, [host]);

  return (
    <div>
      <div style={{ padding: 16 }}>
        <b>1. host (port 3000)</b>
      </div>

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 16,
          height: "100vh",
          paddingLeft: 16,
        }}
      >
        <MfePanel
          id="2. search (port 3001)"
          src="http://localhost:3001"
          iframeRef={searchRef}
          status={status.search.status}
          reason={status.search.reason}
          onRetry={() => host.retry("search")}
        />

        <MfePanel
          id="3. results (port 3002)"
          src="http://localhost:3002"
          iframeRef={resultsRef}
          status={status.results.status}
          reason={status.results.reason}
          onRetry={() => host.retry("results")}
        />
      </main>
    </div>
  );
}
