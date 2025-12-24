/**
 * @mfe/bridge
 * Universal, SSR-safe, framework-agnostic message bridge (Host <-> Iframe MFEs)
 * v2 – with iframe status + retry + heartbeat
 */

/* ===================== helpers ===================== */

/**
 * Gera um identificador único.
 * Usado para correlacionar requisições RPC e respostas.
 */
function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

/**
 * Verifica se o código está rodando no browser.
 * Evita erros em SSR (Next.js, Node.js).
 */
function isBrowser() {
  return typeof window !== 'undefined' && typeof window.addEventListener === 'function';
}

/**
 * Retorna o timestamp atual em milissegundos.
 * Centraliza chamadas de Date.now().
 */
function now() {
  return Date.now();
}

/**
 * Cria o envelope padrão de mensagens do bridge.
 * Todas as mensagens trafegam nesse formato.
 */
function makeEnvelope(channel, type, payload, extra) {
  return Object.assign(
    {
      __mfe_bridge__: true, // marca interna do bridge
      v: 1,                 // versão do protocolo
      channel,              // canal lógico
      type,                 // tipo do evento/mensagem
      payload,              // dados da mensagem
      t: now(),             // timestamp
    },
    extra || {}
  );
}

/**
 * Verifica se o objeto recebido é um envelope válido do bridge.
 */
function isEnvelope(data) {
  return !!data && typeof data === 'object' && data.__mfe_bridge__ === true && data.v === 1;
}

/**
 * Verifica se a origin da mensagem é permitida.
 * Camada básica de segurança contra postMessage externo.
 */
function originAllowed(origin, allowedOrigins) {
  return Array.isArray(allowedOrigins) && allowedOrigins.includes(origin);
}

/* ===================== bridge ===================== */

/**
 * Cria uma instância do bridge de comunicação.
 * Pode atuar como host (container) ou child (iframe).
 */
export function createBridge(options) {
  var role = options.role;                 // 'host' ou 'child'
  var channel = options.channel;           // canal lógico
  var allowedOrigins = options.allowedOrigins;
  var debug = !!options.debug;

  var clientId = options.clientId;
  var autoHello = options.autoHello !== false;

  var handshakeTimeoutMs = options.handshakeTimeoutMs || 4000;
  var enableHeartbeat = !!options.enableHeartbeat;
  var heartbeatIntervalMs = options.heartbeatIntervalMs || 2000;
  var heartbeatTimeoutMs = options.heartbeatTimeoutMs || 7000;

  // Validações iniciais
  if (role !== 'host' && role !== 'child') {
    throw new Error('Invalid role');
  }
  if (!channel) {
    throw new Error('channel is required');
  }
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    throw new Error('allowedOrigins must be non-empty');
  }

  var started = false;

  /* ===================== internals ===================== */

  /** Handlers de eventos simples (pub/sub) */
  var eventHandlers = new Map();

  /** Handlers de RPC (request/response) */
  var rpcHandlers = new Map();

  /** Requisições RPC pendentes aguardando resposta */
  var pending = new Map();

  /** (host) clientes registrados */
  var clients = new Map(); // clientId -> { win, origin, iframeEl, src, handshakeTimer }

  /** Mapeia window -> clientId */
  var winToClient = new WeakMap();

  /** Status de cada cliente */
  var clientStatus = new Map(); // clientId -> { status, lastSeen, reason }

  /** Observadores de mudança de status */
  var statusHandlers = new Set();

  /** Timers de heartbeat */
  var hostHeartbeatTimer = null;
  var childHeartbeatTimer = null;

  /**
   * Log interno condicionado ao modo debug.
   */
  function log() {
    if (debug) console.log('[mfe-bridge]', ...arguments);
  }

  /**
   * Atualiza o status de um cliente e notifica observadores.
   */
  function setStatus(id, status, reason) {
    var obj = {
      status: status,
      lastSeen: now(),
    };
    if (reason) obj.reason = reason;

    clientStatus.set(id, obj);

    statusHandlers.forEach(function (h) {
      try {
        h(id, obj);
      } catch (_) {}
    });
  }

  /* ===================== public api ===================== */

  /**
   * Registra um listener para mudanças de status dos MFEs.
   */
  function onStatus(handler) {
    statusHandlers.add(handler);
    return function () {
      statusHandlers.delete(handler);
    };
  }

  /**
   * Retorna o status atual de um cliente.
   */
  function getStatus(id) {
    return clientStatus.get(id);
  }

  /**
   * Registra um listener para um tipo de evento.
   */
  function on(type, handler) {
    if (!eventHandlers.has(type)) eventHandlers.set(type, new Set());
    eventHandlers.get(type).add(handler);
    return function () {
      eventHandlers.get(type).delete(handler);
    };
  }

  /**
   * Remove um listener de evento.
   */
  function off(type, handler) {
    if (eventHandlers.has(type)) eventHandlers.get(type).delete(handler);
  }

  /**
   * Emite um evento.
   * - Child → parent
   * - Host → broadcast
   */
  function emit(type, payload, targetOrigin) {
    if (!isBrowser()) return;

    var envelope = makeEnvelope(channel, type, payload);

    if (role === 'child') {
      window.parent.postMessage(envelope, targetOrigin || allowedOrigins[0] || '*');
      return;
    }

    broadcast(type, payload, targetOrigin);
  }

  /**
   * (host) Registra um iframe como cliente.
   * Inicia handshake e controle de status.
   */
  function register(id, iframeEl, opts) {
    if (role !== 'host') throw new Error('register is host-only');

    var w = iframeEl && iframeEl.contentWindow;
    if (!w) throw new Error('iframe without contentWindow');

    var origin = (opts && opts.origin) || allowedOrigins[0];

    clients.set(id, {
      win: w,
      origin: origin,
      iframeEl: iframeEl,
      src: iframeEl.src,
      handshakeTimer: null,
    });

    winToClient.set(w, id);
    setStatus(id, 'loading');

    var timeout = (opts && opts.handshakeTimeoutMs) || handshakeTimeoutMs;
    var c = clients.get(id);

    if (c.handshakeTimer) clearTimeout(c.handshakeTimer);

    c.handshakeTimer = setTimeout(function () {
      var s = clientStatus.get(id);
      if (s && s.status === 'loading') {
        setStatus(id, 'offline', 'handshake_timeout');
      }
    }, timeout);
  }

  /**
   * (host) Remove um cliente registrado.
   */
  function unregister(id) {
    var c = clients.get(id);
    if (c && c.handshakeTimer) clearTimeout(c.handshakeTimer);
    clients.delete(id);
    clientStatus.delete(id);
  }

  /**
   * (host) Envia mensagem para um cliente específico.
   */
  function send(id, type, payload, targetOrigin) {
    if (role !== 'host') throw new Error('send is host-only');
    var c = clients.get(id);
    if (!c) throw new Error('client not registered');

    c.win.postMessage(makeEnvelope(channel, type, payload), targetOrigin || c.origin);
  }

  /**
   * (host) Envia mensagem para todos os clientes registrados.
   */
  function broadcast(type, payload, targetOrigin) {
    if (role !== 'host') throw new Error('broadcast is host-only');

    clients.forEach(function (c) {
      c.win.postMessage(makeEnvelope(channel, type, payload), targetOrigin || c.origin);
    });
  }

  /**
   * Registra um handler RPC (request/response).
   */
  function handle(type, fn) {
    rpcHandlers.set(type, fn);
    return function () {
      rpcHandlers.delete(type);
    };
  }

  /**
   * (child) Envia uma requisição RPC ao host.
   */
  function request(type, payload, opts) {
    if (role === 'host') {
      return Promise.reject(new Error('use hostRequest on host'));
    }

    opts = opts || {};
    var id = uid();
    var to = opts.targetOrigin || allowedOrigins[0];

    window.parent.postMessage(makeEnvelope(channel, type, payload, { id: id }), to);

    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        pending.delete(id);
        reject(new Error('RPC timeout'));
      }, opts.timeoutMs || 6000);

      pending.set(id, { resolve: resolve, reject: reject, timer: timer });
    });
  }

  /**
   * (host) Envia uma requisição RPC a um cliente específico.
   */
  function hostRequest(id, type, payload, opts) {
    if (role !== 'host') {
      return Promise.reject(new Error('hostRequest is host-only'));
    }

    opts = opts || {};
    var c = clients.get(id);
    if (!c) return Promise.reject(new Error('client not registered'));

    var reqId = uid();
    var to = opts.targetOrigin || c.origin;

    c.win.postMessage(makeEnvelope(channel, type, payload, { id: reqId }), to);

    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        pending.delete(reqId);
        reject(new Error('RPC timeout'));
      }, opts.timeoutMs || 6000);

      pending.set(reqId, { resolve: resolve, reject: reject, timer: timer });
    });
  }

  /**
   * (host) Recarrega o iframe e reinicia o handshake.
   */
  function retry(id, opts) {
    if (role !== 'host') throw new Error('retry is host-only');
    var c = clients.get(id);
    if (!c || !c.iframeEl) throw new Error('client not registered');

    opts = opts || {};
    setStatus(id, 'loading', 'retry');

    var src = c.src;
    if (opts.bustCache !== false) {
      src += (src.indexOf('?') >= 0 ? '&' : '?') + '__retry__=' + Date.now();
    }

    c.iframeEl.src = src;

    if (c.handshakeTimer) clearTimeout(c.handshakeTimer);
    c.handshakeTimer = setTimeout(function () {
      var s = clientStatus.get(id);
      if (s && s.status === 'loading') {
        setStatus(id, 'offline', 'handshake_timeout');
      }
    }, handshakeTimeoutMs);
  }

  /* ===================== message handler ===================== */

  /**
   * Handler global de mensagens postMessage.
   * Responsável por eventos, RPC, handshake e heartbeat.
   */
  async function onMessage(ev) {
    if (!originAllowed(ev.origin, allowedOrigins)) return;

    var data = ev.data;
    if (!isEnvelope(data) || data.channel !== channel) return;

    // Resposta RPC
    if (data.replyTo) {
      var p = pending.get(data.replyTo);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(data.replyTo);
      p.resolve(data.payload);
      return;
    }

    // Handshake inicial
    if (role === 'host' && data.type === 'MFE_HELLO') {
      var id = data.payload && data.payload.clientId;
      if (id && ev.source) {
        winToClient.set(ev.source, id);

        var c = clients.get(id);
        if (c && c.handshakeTimer) {
          clearTimeout(c.handshakeTimer);
          c.handshakeTimer = null;
        }

        setStatus(id, 'ready');
      }

      ev.source.postMessage(makeEnvelope(channel, 'MFE_READY', { ok: true }), ev.origin);
      return;
    }

    // Heartbeat
    if (role === 'host' && data.type === 'MFE_PING') {
      var pid = data.payload && data.payload.clientId;
      if (pid && clientStatus.has(pid)) {
        var s = clientStatus.get(pid);
        clientStatus.set(pid, Object.assign({}, s, { lastSeen: now() }));
      }
      return;
    }

    // Execução de RPC
    if (data.id && rpcHandlers.has(data.type)) {
      try {
        var res = await rpcHandlers.get(data.type)(data.payload);
        ev.source.postMessage(
          makeEnvelope(channel, data.type + ':reply', res, { replyTo: data.id }),
          ev.origin
        );
      } catch (e) {
        ev.source.postMessage(
          makeEnvelope(
            channel,
            data.type + ':reply',
            { error: true, message: e.message },
            { replyTo: data.id }
          ),
          ev.origin
        );
      }
      return;
    }

    // Eventos simples
    var handlers = eventHandlers.get(data.type);
    if (handlers) {
      handlers.forEach(function (h) {
        try {
          h(data.payload);
        } catch (_) {}
      });
    }
  }

  /* ===================== lifecycle ===================== */

  /**
   * Inicia o bridge (ativa listeners, handshake e heartbeat).
   */
  function start() {
    if (!isBrowser() || started) return;
    window.addEventListener('message', onMessage);
    started = true;
    log('started', role);

    if (role === 'host' && enableHeartbeat) {
      hostHeartbeatTimer = setInterval(function () {
        var t = now();
        clientStatus.forEach(function (s, id) {
          if (s.status === 'ready' && t - s.lastSeen > heartbeatTimeoutMs) {
            setStatus(id, 'offline', 'heartbeat_timeout');
          }
        });
      }, Math.max(500, heartbeatTimeoutMs / 2));
    }

    if (role === 'child') {
      var myId = clientId || uid();

      if (autoHello) {
        window.parent.postMessage(
          makeEnvelope(channel, 'MFE_HELLO', { clientId: myId }),
          allowedOrigins[0]
        );
      }

      if (enableHeartbeat) {
        childHeartbeatTimer = setInterval(function () {
          window.parent.postMessage(
            makeEnvelope(channel, 'MFE_PING', { clientId: myId }),
            allowedOrigins[0]
          );
        }, heartbeatIntervalMs);
      }
    }
  }

  /**
   * Encerra o bridge, removendo listeners e timers.
   */
  function destroy() {
    if (!isBrowser() || !started) return;
    window.removeEventListener('message', onMessage);

    pending.forEach(function (p) {
      clearTimeout(p.timer);
    });

    if (hostHeartbeatTimer) clearInterval(hostHeartbeatTimer);
    if (childHeartbeatTimer) clearInterval(childHeartbeatTimer);

    eventHandlers.clear();
    rpcHandlers.clear();
    pending.clear();
    clients.clear();
    clientStatus.clear();
    statusHandlers.clear();

    started = false;
  }

  return {
    start,
    destroy,

    on,
    off,
    emit,

    register,
    unregister,
    send,
    broadcast,

    request,
    hostRequest,
    handle,

    onStatus,
    getStatus,
    retry,
  };
}
