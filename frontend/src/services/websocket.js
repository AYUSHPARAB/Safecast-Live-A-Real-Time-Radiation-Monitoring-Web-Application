const CHANNELS = ["map", "current", "alerts", "stats", "heatmap"];
const listeners = new Map(CHANNELS.map((channel) => [channel, new Set()]));

let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

function getWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase) {
    const url = new URL(apiBase, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    return url.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function emit(channel, data) {
  const channelListeners = listeners.get(channel);
  if (!channelListeners) return;

  channelListeners.forEach((listener) => {
    listener(data);
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function hasActiveListeners() {
  return Array.from(listeners.values()).some((channelListeners) => (
    channelListeners.size > 0
  ));
}

function scheduleReconnect() {
  if (!hasActiveListeners()) return;

  clearReconnectTimer();
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
  reconnectAttempts += 1;

  reconnectTimer = setTimeout(() => {
    socket = null;
    connectWebSocket();
  }, delay);
}

export function connectWebSocket() {
  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
    return socket;
  }

  try {
    socket = new WebSocket(getWebSocketUrl());
  } catch (error) {
    console.error("WebSocket connection failed:", error);
    scheduleReconnect();
    return null;
  }

  socket.addEventListener("open", () => {
    reconnectAttempts = 0;
    clearReconnectTimer();
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      if (!message?.channel) return;
      emit(message.channel, message.data);
    } catch (error) {
      console.error("Bad WebSocket message:", error);
    }
  });

  socket.addEventListener("close", () => {
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    socket?.close();
  });

  return socket;
}

export function subscribeLiveUpdates(channel, listener) {
  if (!listeners.has(channel)) {
    listeners.set(channel, new Set());
  }

  listeners.get(channel).add(listener);
  connectWebSocket();

  return () => {
    listeners.get(channel)?.delete(listener);

    if (!hasActiveListeners()) {
      clearReconnectTimer();
      socket?.close();
      socket = null;
    }
  };
}

export function closeWebSocket() {
  clearReconnectTimer();
  socket?.close();
  socket = null;
}
