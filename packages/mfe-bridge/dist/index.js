/**
 * @mfe/bridge
 * Universal, SSR-safe, framework-agnostic message bridge (Host <-> Iframe MFEs)
 *
 * Design goals:
 * - No window access at import time (SSR-safe)
 * - Security-by-default: origin allowlist + channel + signed envelope
 * - Minimal API: start/destroy/on/off/emit/send/broadcast/request/handle
 * - Works with React/Next/Vite/Vanilla
 */

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.addEventListener === 'function';
}

function now() {
  return Date.now();
}

function makeEnvelope(channel, type, payload, extra = {}) {
  return {
    __mfe_bridge__: true,
    v: 1,
    channel,
    type,
    payload,
    t: now(),
    ...extra,
  };
}

function isEnvelope(data) {
  return !!data && typeof data === 'object' && data.__mfe_bridge__ === true && data.v === 1;
}

function hasOriginAllowlist(allowedOrigins) {
  return Array.isArray(allowedOrigins) && allowedOrigins.length > 0;
}

function originAllowed(origin, allowedOrigins) {
  if (!hasOriginAllowlist(allowedOrigins)) return false;
  return allowedOrigins.includes(origin);
}

/**
 * @typedef {'host'|'child'} Role
 */

/**
 * @typedef {Object} BridgeOptions
 * @property {Role} role
 * @property {string} channel
 * @property {string[]} allowedOrigins
 * @property {boolean=} debug
 * @property {string=} clientId           // used in child HELLO (optional)
 * @property {boolean=} autoHello         // default true (child sends HELLO on start)
 */

/**
 * @typedef {Object} RegisterOptions
 * @property {string} origin  // expected origin for that iframe (recommended in prod)
 */

/**
 * @typedef {Object} RpcRequestOptions
 * @property {number=} timeoutMs
 * @property {string=} targetOrigin
 */

export function createBridge(options) {
  const {
    role,
    channel,
    allowedOrigins,
    debug = false,
    clientId,
    autoHello = true,
  } = options;

  if (role !== 'host' && role !== 'child') {
    throw new Error(`Invalid role: ${role}`);
  }
  if (!channel || typeof channel !== 'string') {
    throw new Error('channel is required');
  }
  if (!hasOriginAllowlist(allowedOrigins)) {
    throw new Error('allowedOrigins must be a non-empty array');
  }

  /** @type {Map<string, Set<Function>>} */
  const eventHandlers = new Map();

  /** @type {Map<string, Function>} */
  const rpcHandlers = new Map();

  /** @type {Map<string, {resolve: Function, reject: Function, timer: any}>} */
  const pending = new Map();

  // Host-only: clientId -> { win, origin }
  /** @type {Map<string, {win: Window, origin: string}>} */
  const clients = new Map();

  // Host-only: sourceWindow -> clientId (filled by register or handshake)
  /** @type {WeakMap<Window, string>} */
  const winToClient = new WeakMap();

  let started = false;

  function log(...args) {
    if (debug) console.log('[mfe-bridge]', ...args);
  }

  function on(type, handler) {
    if (!eventHandlers.has(type)) eventHandlers.set(type, new Set());
    eventHandlers.get(type).add(handler);
    return () => off(type, handler);
  }

  function off(type, handler) {
    eventHandlers.get(type)?.delete(handler);
  }

  function emit(type, payload, targetOrigin) {
    if (!isBrowser()) return;

    const envelope = makeEnvelope(channel, type, payload);

    if (role === 'child') {
      const to = targetOrigin || allowedOrigins[0] || '*';
      window.parent.postMessage(envelope, to);
      return;
    }

    // host emit() behaves like broadcast() for convenience
    broadcast(type, payload, targetOrigin);
  }

  function register(clientId, iframeEl, opts) {
    if (role !== 'host') {
      throw new Error('register() is host-only');
    }
    const w = iframeEl?.contentWindow;
    if (!w) throw new Error(`iframe ${clientId} without contentWindow`);
    const origin = opts?.origin || allowedOrigins[0];
    clients.set(clientId, { win: w, origin });
    winToClient.set(w, clientId);
  }

  function unregister(clientId) {
    if (role !== 'host') return;
    clients.delete(clientId);
  }

  function send(clientId, type, payload, targetOrigin) {
    if (!isBrowser()) return;
    if (role !== 'host') throw new Error('send() is host-only');

    const c = clients.get(clientId);
    if (!c) throw new Error(`client not registered: ${clientId}`);

    const envelope = makeEnvelope(channel, type, payload);

    // In prod: prefer explicit per-iframe origin (register options)
    const to = targetOrigin || c.origin || allowedOrigins[0];
    c.win.postMessage(envelope, to);
  }

  function broadcast(type, payload, targetOrigin) {
    if (!isBrowser()) return;
    if (role !== 'host') throw new Error('broadcast() is host-only');

    const envelope = makeEnvelope(channel, type, payload);

    for (const [, c] of clients) {
      const to = targetOrigin || c.origin || allowedOrigins[0];
      c.win.postMessage(envelope, to);
    }
  }

  function handle(type, fn) {
    rpcHandlers.set(type, fn);
    return () => rpcHandlers.delete(type);
  }

  function request(type, payload, reqOpts = {}) {
    const { timeoutMs = 6000, targetOrigin } = reqOpts;

    if (!isBrowser()) {
      return Promise.reject(new Error('request() called outside browser runtime'));
    }

    // For host: require a "to" clientId in payload wrapper.
    // Safer API: hostRequest(clientId, type, payload)
    if (role === 'host') {
      return Promise.reject(new Error('Use hostRequest(clientId, type, payload, options) on host'));
    }

    const id = uid();
    const envelope = makeEnvelope(channel, type, payload, { id });

    const to = targetOrigin || allowedOrigins[0] || '*';
    window.parent.postMessage(envelope, to);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`RPC timeout: ${type}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
    });
  }

  function hostRequest(clientId, type, payload, reqOpts = {}) {
    const { timeoutMs = 6000, targetOrigin } = reqOpts;

    if (!isBrowser()) {
      return Promise.reject(new Error('hostRequest() called outside browser runtime'));
    }
    if (role !== 'host') {
      return Promise.reject(new Error('hostRequest() is host-only'));
    }

    const c = clients.get(clientId);
    if (!c) return Promise.reject(new Error(`client not registered: ${clientId}`));

    const id = uid();
    const envelope = makeEnvelope(channel, type, payload, { id });

    const to = targetOrigin || c.origin || allowedOrigins[0];
    c.win.postMessage(envelope, to);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`RPC timeout: ${type} -> ${clientId}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
    });
  }

  async function onMessage(ev) {
    // origin allowlist
    if (!originAllowed(ev.origin, allowedOrigins)) return;

    const data = ev.data;
    if (!isEnvelope(data)) return;
    if (data.channel !== channel) return;

    // Optional: host can bind events to a known clientId
    const sourceWin = ev.source;
    if (role === 'host' && sourceWin && typeof sourceWin === 'object') {
      // If host used register(), we have mapping. If not, handshake may create it.
      const knownClientId = winToClient.get(sourceWin);
      if (knownClientId) {
        log('from client', knownClientId, 'type', data.type);
      } else {
        // Still allow if origin is allowlisted (useful for early HELLO)
        log('from unknown window', 'type', data.type);
      }
    }

    // RPC reply
    if (data.replyTo) {
      const p = pending.get(data.replyTo);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(data.replyTo);
      p.resolve(data.payload);
      return;
    }

    // Handshake: child says HELLO; host responds READY
    if (role === 'host' && data.type === 'MFE_HELLO') {
      const incomingId = data.payload?.clientId;
      if (incomingId && ev.source) {
        // bind source window to clientId (even if not registered by iframe ref)
        winToClient.set(ev.source, incomingId);
      }

      // reply READY
      try {
        ev.source?.postMessage(
          makeEnvelope(channel, 'MFE_READY', { ok: true, channel }),
          ev.origin
        );
      } catch {}
      return;
    }

    // RPC request handling
    if (data.id && rpcHandlers.has(data.type)) {
      const fn = rpcHandlers.get(data.type);
      try {
        const result = await fn(data.payload, { origin: ev.origin });
        ev.source?.postMessage(
          makeEnvelope(channel, `${data.type}:reply`, result, { replyTo: data.id }),
          ev.origin
        );
      } catch (err) {
        ev.source?.postMessage(
          makeEnvelope(channel, `${data.type}:reply`, { error: true, message: err?.message || 'RPC error' }, { replyTo: data.id }),
          ev.origin
        );
      }
      return;
    }

    // Normal event
    const handlers = eventHandlers.get(data.type);
    if (!handlers || handlers.size === 0) return;
    for (const h of handlers) {
      try {
        await h(data.payload, { origin: ev.origin });
      } catch (e) {
        log('handler error', e);
      }
    }
  }

  function start() {
    if (!isBrowser() || started) return;
    window.addEventListener('message', onMessage);
    started = true;
    log('started', { role, channel });

    if (role === 'child' && autoHello) {
      // announce to host (optional)
      const hello = makeEnvelope(channel, 'MFE_HELLO', { clientId: clientId || uid() });
      window.parent.postMessage(hello, allowedOrigins[0] || '*');
    }
  }

  function destroy() {
    if (!isBrowser() || !started) return;
    window.removeEventListener('message', onMessage);
    for (const [, p] of pending) clearTimeout(p.timer);
    pending.clear();
    eventHandlers.clear();
    rpcHandlers.clear();
    clients.clear();
    started = false;
  }

  return {
    // lifecycle
    start,
    destroy,

    // events
    on,
    off,
    emit,

    // host-only routing
    register,
    unregister,
    send,
    broadcast,

    // RPC
    request,     // child-only
    hostRequest, // host-only
    handle,
  };
}
